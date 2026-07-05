const { PaymentConnector } = require('../PaymentConnector');

/**
 * StripeConnector — SCAFFOLD for FOODS's global (non-Africa) payment rail.
 *
 * ┌─ STATUS: not integrated yet. This is deliberate infrastructure-ahead-of-use. ─┐
 * │ The class implements the PaymentConnector contract and declares its routing   │
 * │ capabilities so the orchestrator can already reason about it, but every        │
 * │ money-movement method throws until the real integration lands. It stays        │
 * │ INERT because `configured` is false until STRIPE_SECRET_KEY is set — so        │
 * │ registering it changes NO current behavior (Flutterwave keeps every flow).     │
 * └───────────────────────────────────────────────────────────────────────────────┘
 *
 * WHY IT'S A STUB, NOT A REAL INTEGRATION:
 * Stripe onboards merchants by the entity's country and does NOT onboard
 * Nigerian-registered businesses. Going live requires a US (or UK/EU) entity +
 * banking first. Per the plan, Stripe is integrated AFTER US registration. This
 * scaffold means that day is a credential-drop + filling in the method bodies,
 * not a re-architecture. See memory/payments_architecture.md (global direction).
 *
 * INTEGRATION CHECKLIST (do these once the US entity + Stripe account exist):
 *   1. `npm i stripe` and `const Stripe = require('stripe');` here.
 *   2. Set env: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET (, STRIPE_PUBLISHABLE_KEY on the client).
 *   3. Implement createCharge (PaymentIntent / Checkout Session), verifyCharge
 *      (retrieve PaymentIntent), refund (Refunds API).
 *   4. Payouts to cooks → Stripe Connect (connected accounts + transfers); the
 *      current `payout(dest, money)` bank-account shape is Flutterwave-specific,
 *      so Connect payouts will extend PayoutDestination (e.g. a connectedAccountId).
 *   5. Webhooks → add a raw-body Stripe route; verify via
 *      stripe.webhooks.constructEvent(rawBody, sig, STRIPE_WEBHOOK_SECRET);
 *      map event types in parseWebhook (skeleton below).
 *   6. Thread buyer COUNTRY into the orchestrator context so US/EU/etc. traffic
 *      routes here while Africa stays on Flutterwave (currencies like USD overlap;
 *      country is the real discriminator — see capability notes below).
 *
 * Money is still MAJOR units { amount, currency } at this seam (Phase 1 contract),
 * even though the ledger is minor-unit internally. Keep that boundary when implementing.
 */
class StripeConnector extends PaymentConnector {
  constructor({ secret = process.env.STRIPE_SECRET_KEY, webhookSecret = process.env.STRIPE_WEBHOOK_SECRET } = {}) {
    super();
    this._secret = secret;
    this._webhookSecret = webhookSecret;
    // this._stripe = secret ? require('stripe')(secret) : null;  // ← uncomment at integration
  }

  get id() { return 'stripe'; }

  // Representative Stripe merchant/buyer markets — intentionally EXCLUDES the
  // African countries Flutterwave settles, so country-based routing sends each
  // region to the right rail. Expand to Stripe's full supported list at integration.
  get countries() {
    return ['US', 'CA', 'GB', 'IE', 'DE', 'FR', 'ES', 'IT', 'NL', 'BE', 'AT', 'PT',
            'FI', 'SE', 'DK', 'NO', 'CH', 'PL', 'AU', 'NZ', 'SG', 'JP', 'HK', 'AE', 'MX', 'BR'];
  }

  // Stripe settles 135+ currencies; these are the ones FOODS will price in first.
  // Note: USD/EUR/GBP overlap Flutterwave — the orchestrator disambiguates by
  // COUNTRY, so callers must pass buyer country once this rail is live.
  get currencies() {
    return ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'NZD', 'SGD', 'JPY', 'CHF',
            'SEK', 'DKK', 'NOK', 'PLN', 'HKD', 'AED', 'MXN', 'BRL'];
  }

  get methods() { return ['card', 'wallet']; } // wallet = Apple Pay / Google Pay / Link

  /** Inert until a live secret is present — this is what keeps the scaffold safe. */
  get configured() { return Boolean(this._secret); }

  _pending(method) {
    const err = new Error(`stripe: ${method} not implemented — Stripe integration is pending US entity registration + credentials (see StripeConnector integration checklist)`);
    err.code = 'CONNECTOR_NOT_IMPLEMENTED';
    return err;
  }

  /** @param {import('../PaymentConnector').ChargeIntent} intent */
  async createCharge(intent) {
    // Integration: create a PaymentIntent / Checkout Session, return { reference, redirectLink }.
    throw this._pending('createCharge');
  }

  /** @param {{reference?:string, providerTxId?:string}} ref */
  async verifyCharge(ref) {
    // Integration: retrieve the PaymentIntent and normalize to ChargeStatus.
    throw this._pending('verifyCharge');
  }

  /**
   * @param {import('../PaymentConnector').PayoutDestination} dest
   * @param {{amount:number,currency:string,reference:string,narration?:string}} money
   */
  async payout(dest, money) {
    // Integration: Stripe Connect transfer to the cook's connected account.
    throw this._pending('payout');
  }

  /** @param {{providerTxId:string,reference:string}} charge @param {{amount?:number,currency?:string}} money */
  async refund(charge, money = {}) {
    // Integration: stripe.refunds.create({ payment_intent, amount }). amount enables partials.
    throw this._pending('refund');
  }

  /** Bank-account resolution is a Flutterwave/Africa concept; Stripe uses Connect onboarding instead. */
  async verifyBankAccount(acct) {
    throw this._pending('verifyBankAccount');
  }

  /** Non-critical (matches Flutterwave): return [] so callers fall back gracefully. */
  async listBanks(country) {
    return [];
  }

  /** Identity/KYC for Stripe cooks is handled by Connect account onboarding, not a lookup call. */
  async kycLookup(type, value) {
    throw this._pending('kycLookup');
  }

  /**
   * Stripe signs webhooks with an HMAC in the `stripe-signature` header, verified
   * against STRIPE_WEBHOOK_SECRET. Convention (see orchestrator.ingestWebhook):
   *   null  = no secret configured (prod fail-closes, dev allows)
   *   false = signature present but invalid / not yet verifiable
   * Until integration we fail CLOSED whenever a secret is set, so no unverified
   * Stripe webhook is ever accepted before the real verification is wired in.
   */
  verifyWebhookSignature(headers, rawBody) {
    if (!this._webhookSecret) return null;
    // Integration: return this._stripe.webhooks.constructEvent(rawBody, headers['stripe-signature'], this._webhookSecret) != null;
    return false;
  }

  /** @returns {import('../PaymentConnector').NormalizedEvent} Skeleton mapping — filled in at integration. */
  parseWebhook(headers, body) {
    const { type, data } = body ?? {};
    const obj = data?.object ?? {};
    const reference = obj.metadata?.reference ?? obj.id ?? '';

    // Intended mapping (Stripe event type -> our normalized vocab):
    //   payment_intent.succeeded         -> charge.succeeded
    //   payment_intent.payment_failed    -> charge.failed
    //   charge.refunded                  -> (refund handled via our own flow)
    //   transfer.created / paid          -> transfer.completed
    //   charge.dispute.created           -> chargeback.opened
    let normalized = 'unknown';
    if (type === 'payment_intent.succeeded') normalized = 'charge.succeeded';
    else if (type === 'payment_intent.payment_failed') normalized = 'charge.failed';
    else if (type === 'charge.dispute.created') normalized = 'chargeback.opened';

    return {
      type: normalized,
      reference,
      providerTxId: obj.id != null ? String(obj.id) : undefined,
      amount: obj.amount != null ? obj.amount / 100 : undefined, // Stripe amounts are minor units
      currency: obj.currency ? obj.currency.toUpperCase() : undefined,
      dedupeKey: body?.id ?? reference, // Stripe event id is a stable dedupe key
      raw: body,
    };
  }
}

module.exports = { StripeConnector };
