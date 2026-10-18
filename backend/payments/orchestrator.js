const { NoRouteError } = require('./PaymentConnector');
const { FlutterwaveConnector } = require('./connectors/FlutterwaveConnector');
const { StripeConnector } = require('./connectors/StripeConnector');
const { BachsConnector } = require('./connectors/BachsConnector');

/**
 * Payment orchestrator — the single entry point routes use for money movement.
 *
 * Routes call createCharge / verifyCharge / payout / refund / ingestWebhook and
 * never see a gateway. The orchestrator selects a connector by context (country,
 * currency, method, health) and delegates. Today there is one registered
 * connector (Flutterwave), so routing is trivial — but the seam is what lets a
 * second connector (Paystack, Stripe, a mobile-money rail) drop in without any
 * route changing. That is the whole point of Phase 1.
 */
/**
 * reference → rail that created the charge (table gateway_charges, mig 071).
 * Lazily bound to the db so tests can construct an orchestrator without one.
 */
const dbRegistry = {
  async record(row) {
    const { sql } = require('../supabase/db');
    await sql`
      INSERT INTO gateway_charges (reference, connector, provider_checkout_id, user_id, amount, currency)
      VALUES (${row.reference}, ${row.connector}, ${row.providerCheckoutId ?? null}, ${row.userId ?? null},
              ${row.amount ?? null}, ${row.currency ?? null})
      ON CONFLICT (reference) DO UPDATE SET
        connector = EXCLUDED.connector,
        provider_checkout_id = COALESCE(EXCLUDED.provider_checkout_id, gateway_charges.provider_checkout_id)
    `;
  },
  async lookup(reference) {
    if (!reference) return null;
    const { sql } = require('../supabase/db');
    const [row] = await sql`SELECT connector, provider_checkout_id FROM gateway_charges WHERE reference = ${reference}`;
    return row ? { connector: row.connector, providerCheckoutId: row.provider_checkout_id } : null;
  },
};

class PaymentOrchestrator {
  constructor(connectors, { registry = dbRegistry, preferred = () => process.env.PAYMENT_RAIL } = {}) {
    /** @type {import('./PaymentConnector').PaymentConnector[]} */
    this._connectors = connectors;
    this._registry = registry;
    this._preferred = preferred;
  }

  /**
   * The connector for a NEW charge. PAYMENT_RAIL (e.g. "bachs") picks a rail
   * when it is configured and can serve the context; otherwise the usual
   * ranking applies. Unset, nothing changes from single-rail behaviour.
   */
  selectForCharge(context = {}) {
    const want = this._preferred?.();
    if (want) {
      const c = this._eligible(context).find((x) => x.id === want && x.configured);
      if (c) return c;
    }
    return this.select(context);
  }

  /**
   * The connector that created an EXISTING charge, plus its provider ids.
   * References with no registry row predate it and belong to the default rail.
   */
  async connectorForReference(reference, context = {}) {
    const row = await this._registry.lookup(reference).catch((err) => {
      console.error('[Payments] charge registry lookup failed:', err.message);
      return null;
    });
    const connector = (row && this.byId(row.connector)) || this.select(context);
    return { connector, providerCheckoutId: row?.providerCheckoutId ?? null };
  }

  /** All connectors that could serve this context, ranked. */
  _eligible({ country, currency, method } = {}) {
    return this._connectors.filter((c) => {
      if (country && c.countries.length && !c.countries.includes(country)) return false;
      if (currency && c.currencies.length && !c.currencies.includes(currency)) return false;
      if (method && c.methods.length && !c.methods.includes(method)) return false;
      return true;
    });
  }

  /**
   * Pick a connector for a context. Prefers configured (live) connectors; falls
   * back to an eligible-but-unconfigured connector so dev mode still resolves.
   * @returns {import('./PaymentConnector').PaymentConnector}
   */
  select(context = {}) {
    const eligible = this._eligible(context);
    if (!eligible.length) throw new NoRouteError(context);
    return eligible.find((c) => c.configured) ?? eligible[0];
  }

  /** Look up a connector by id (e.g. to parse a webhook from a known provider). */
  byId(id) {
    return this._connectors.find((c) => c.id === id) ?? null;
  }

  /**
   * Money in. Returns { reference, redirectLink, devMode }. When the selected
   * connector has no live credentials we return a dev-mode stub, preserving the
   * exact behavior the routes had before (payment_link: null, dev_mode: true).
   */
  async createCharge(intent, context = {}) {
    const connector = this.selectForCharge({ currency: intent.currency, ...context });
    if (!connector.configured) {
      console.log('[DEV] Payment initiated:', intent.reference, 'Amount:', intent.amount, intent.currency);
      return { reference: intent.reference, redirectLink: null, devMode: true };
    }
    const result = await connector.createCharge(intent);
    // Every later verify/refund must go to this rail; without the row a Bachs
    // charge could never be verified, so a failed write fails the charge.
    await this._registry.record({
      reference: intent.reference, connector: connector.id, providerCheckoutId: result.providerCheckoutId,
      userId: intent.meta?.user_id, amount: intent.amount, currency: intent.currency,
    });
    return { ...result, connector: connector.id, devMode: false };
  }

  /**
   * Verify a charge server-side (never trust the browser redirect) with the
   * rail that created it. In dev mode all verifications succeed, matching the
   * previous route behavior.
   */
  async verifyCharge(ref, context = {}) {
    const { connector, providerCheckoutId } = await this.connectorForReference(ref.reference, context);
    if (!connector.configured) {
      console.log('[DEV] Payment verified (mock):', ref.reference ?? ref.providerTxId);
      return { successful: true, reference: ref.reference, providerTxId: ref.providerTxId, devMode: true };
    }
    const status = await connector.verifyCharge({ ...ref, providerCheckoutId: ref.providerCheckoutId ?? providerCheckoutId });
    return { ...status, connector: connector.id, devMode: false };
  }

  /** Money out to a creator's bank account. */
  async payout(dest, money, context = {}) {
    const connector = this.select({ currency: money.currency, ...context });
    return connector.payout(dest, money);
  }

  /**
   * Reverse a charge (full or partial) back to the buyer via the gateway. In dev
   * mode (no live connector) the gateway call is skipped and treated as accepted,
   * matching the prior route behavior which gated the FW refund on a set secret.
   */
  async refund(charge, money = {}, context = {}) {
    const { connector } = await this.connectorForReference(charge.reference, { currency: money.currency, ...context });
    if (!connector.configured) {
      console.log('[DEV] Refund skipped (no live connector):', charge.reference ?? charge.providerTxId);
      return { accepted: true, devMode: true };
    }
    return connector.refund(charge, money);
  }

  /** Poll a payout/transfer's status (for payout reconciliation). */
  async verifyTransfer(providerTransferId, context = {}) {
    return this.select(context).verifyTransfer(providerTransferId);
  }

  /** Resolve a bank account to its owner (KYC-lite for payouts). */
  async verifyBankAccount(acct, context = {}) {
    return this.select(context).verifyBankAccount(acct);
  }

  /** List banks for a country (for payout account setup UIs). */
  async listBanks(country = 'NG', context = {}) {
    return this.select({ country, ...context }).listBanks(country);
  }

  /** Identity (BVN/NIN) lookup for fleet/creator onboarding. */
  async kycLookup(type, value, context = {}) {
    return this.select(context).kycLookup(type, value);
  }

  /**
   * Webhook ingest: verify signature, then normalize. Fail-closed in production
   * when the connector's secret is unset — matching the current Flutterwave
   * handler. Returns { ok, event } where event is a NormalizedEvent, or
   * { ok:false, reason } when the signature check fails.
   */
  ingestWebhook(connectorId, headers, body, { rawBody, isProduction = process.env.NODE_ENV === 'production' } = {}) {
    const connector = this.byId(connectorId);
    if (!connector) return { ok: false, reason: 'unknown_connector' };

    // Signatures are computed over the exact bytes received (Bachs HMACs the
    // raw body); parsing uses the JSON. Flutterwave only reads a header.
    const sig = connector.verifyWebhookSignature(headers, rawBody ?? body);
    if (sig === null) {
      // No secret configured. Reject in production, allow in dev (prior behavior).
      if (isProduction) return { ok: false, reason: 'no_secret' };
    } else if (sig === false) {
      return { ok: false, reason: 'bad_signature' };
    }

    return { ok: true, event: connector.parseWebhook(headers, body) };
  }
}

// Default registry. Adding a connector here (and nowhere else) is how a new
// rail — and eventually a new country — comes online.
//
// Flutterwave is listed FIRST so it wins any overlap (e.g. a USD charge with no
// buyer country) — preserving today's behavior. StripeConnector is a SCAFFOLD:
// inert until STRIPE_SECRET_KEY is set (configured === false), so it changes no
// current flow. Once configured post-US-registration, country-scoped non-Africa
// traffic routes to it. See connectors/StripeConnector.js integration checklist.
//
// BachsConnector is inert until BACHS_SECRET_KEY is set, and even then takes
// new charges only when PAYMENT_RAIL=bachs; charges it took are always routed
// back to it through gateway_charges.
const orchestrator = new PaymentOrchestrator([
  new FlutterwaveConnector(),
  new BachsConnector(),
  new StripeConnector(),
]);

module.exports = { orchestrator, PaymentOrchestrator };
