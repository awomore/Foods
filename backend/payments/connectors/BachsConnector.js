'use strict';

const crypto = require('crypto');
const { PaymentConnector } = require('../PaymentConnector');
const { exponentOf } = require('../money');

/**
 * BachsConnector — the global rail (docs.bachs.io).
 *
 * Money in is a hosted checkout session priced with a raw amount (`pricing`),
 * so a food cart needs no Bachs catalog product. Our tx_ref travels as the
 * session's `reference`. Bachs can only fetch a session by its own checkout_id,
 * so the orchestrator stores reference → checkout_id (gateway_charges, mig 071)
 * and passes it back as `providerCheckoutId` on verify.
 *
 * Bachs money is a decimal STRING in major units ("1500.00"), never minor units.
 * This seam is major-unit numbers (Phase 1 contract), converted at the edge.
 *
 * Env:
 *   BACHS_SECRET_KEY      sk_sandbox_… (sandbox API) or sk_live_… (live API)
 *   BACHS_WEBHOOK_SECRET  the webhook endpoint's signing secret
 *   BACHS_API_BASE        optional override of the API base URL
 *   APP_BASE_URL          public API origin; the checkout returns to
 *                         ${APP_BASE_URL}/api/payments/return (must be public https)
 *
 * Payouts to cooks (Bachs Connect transfers) are not wired yet.
 */

const SANDBOX = 'https://sandbox-api.bachs.io';
const LIVE = 'https://api.bachs.io';

// Charge statuses that mean the money was collected (payments/statuses guide).
const PAID = new Set(['succeeded', 'accepted', 'overpaid']);

function decimal(amount, currency) {
  const exp = exponentOf(currency);
  const n = Number(amount);
  if (!Number.isFinite(n) || n <= 0) throw new Error(`bachs: invalid amount "${amount}"`);
  return n.toFixed(exp);
}

/** Bachs metadata: at most 20 keys, string values. */
function toMetadata(meta = {}) {
  return Object.fromEntries(
    Object.entries(meta)
      .filter(([, v]) => v != null)
      .slice(0, 20)
      .map(([k, v]) => [k, typeof v === 'string' ? v : JSON.stringify(v)]),
  );
}

class BachsConnector extends PaymentConnector {
  constructor({
    secret = process.env.BACHS_SECRET_KEY,
    webhookSecret = process.env.BACHS_WEBHOOK_SECRET,
    baseUrl = process.env.BACHS_API_BASE,
    appBaseUrl = process.env.APP_BASE_URL,
    fetchImpl = (...a) => fetch(...a),
  } = {}) {
    super();
    this._secret = secret;
    this._webhookSecret = webhookSecret;
    this._base = baseUrl || (String(secret ?? '').startsWith('sk_live_') ? LIVE : SANDBOX);
    this._appBase = String(appBaseUrl ?? '').replace(/\/+$/, '');
    this._fetch = fetchImpl;
  }

  get id() { return 'bachs'; }

  // Global: no country restriction. Currencies are those Bachs collects in.
  get countries() { return []; }
  get currencies() { return ['NGN', 'USD', 'GHS', 'KES', 'TZS', 'UGX', 'XAF', 'XOF', 'RWF', 'MWK', 'ZMW']; }
  get methods() { return ['card', 'bank', 'momo', 'crypto']; }
  get configured() { return Boolean(this._secret); }

  async _request(method, path, body, { idempotencyKey } = {}) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);
    try {
      const res = await this._fetch(`${this._base}${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${this._secret}`,
          'Content-Type': 'application/json',
          ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });
      const text = await res.text();
      let data = {};
      try { data = text ? JSON.parse(text) : {}; } catch { data = { detail: text }; }
      if (!res.ok) {
        const err = new Error(`bachs ${method} ${path} → ${res.status}: ${data.detail ?? data.error_code ?? 'error'}`);
        err.status = res.status;
        err.detail = data;
        throw err;
      }
      return data;
    } finally {
      clearTimeout(timeout);
    }
  }

  _returnUrl(reference, status) {
    const q = new URLSearchParams({ ref: reference, provider: 'bachs', ...(status ? { status } : {}) });
    return `${this._appBase}/api/payments/return?${q}`;
  }

  /** @param {import('../PaymentConnector').ChargeIntent} intent */
  async createCharge(intent) {
    if (!this._appBase.startsWith('https://')) {
      const err = new Error('bachs: APP_BASE_URL must be a public https URL for the checkout to return to');
      err.code = 'CONNECTOR_CHARGE_FAILED';
      throw err;
    }
    const currency = String(intent.currency).toUpperCase();
    const c = intent.customer ?? {};
    const body = {
      pricing: { currency, amount: decimal(intent.amount, currency) },
      reference: intent.reference,
      success_url: this._returnUrl(intent.reference),
      cancel_url: this._returnUrl(intent.reference, 'cancelled'),
      metadata: toMetadata({ ...intent.meta, reference: intent.reference }),
      customer_creation: 'if_required',
      expires_in_minutes: 60,
    };
    // Only pass a customer Bachs will accept: a real-looking email is required.
    if (c.email && /@/.test(c.email) && !/@foodsbyme\.app$/.test(c.email)) {
      body.customer = { email: c.email, ...(c.name ? { name: c.name } : {}), ...(c.phone ? { phone_number: `+${String(c.phone).replace(/\D/g, '')}` } : {}) };
    }
    try {
      const s = await this._request('POST', '/v1/checkout-sessions', body, { idempotencyKey: intent.reference });
      return { reference: intent.reference, redirectLink: s.checkout_url, providerCheckoutId: s.checkout_id };
    } catch (err) {
      err.code = 'CONNECTOR_CHARGE_FAILED';
      throw err;
    }
  }

  /** @param {{reference?:string, providerCheckoutId?:string}} ref */
  async verifyCharge(ref) {
    if (!ref.providerCheckoutId) {
      return { successful: false, reference: ref.reference, raw: { error: 'no Bachs checkout recorded for this reference' } };
    }
    const s = await this._request('GET', `/v1/checkout-sessions/${encodeURIComponent(ref.providerCheckoutId)}`);
    const charge = s.charge ?? null;
    const status = String(charge?.status ?? '').toLowerCase();
    const successful = s.status === 'completed' && PAID.has(status);
    return {
      successful,
      reference: s.reference ?? ref.reference,
      providerTxId: charge?.payment_id ?? null,
      amount: Number(charge?.amount_paid ?? charge?.amount ?? s.amount ?? 0),
      currency: String(charge?.currency ?? s.currency ?? '').toUpperCase(),
      method: charge?.payment_method ?? s.payment_method ?? null,
      // claims.js trusts meta.user_id as the payer; it is ours, set at creation.
      meta: s.metadata ?? {},
      raw: s,
    };
  }

  /** @param {{providerTxId:string,reference:string}} charge @param {{amount?:number,currency?:string}} money */
  async refund(charge, money = {}) {
    if (!charge.providerTxId) return { accepted: false, failureReason: 'No Bachs payment id for this charge' };
    const body = {
      charge_id: charge.providerTxId,
      reference: `RF-${charge.reference ?? charge.providerTxId}-${Date.now()}`,
      ...(money.amount != null && money.currency ? { amount: decimal(money.amount, money.currency) } : {}),
      reason: 'requested_by_customer',
    };
    try {
      const r = await this._request('POST', '/v1/refunds', body, { idempotencyKey: body.reference });
      return { accepted: r.status !== 'failed', providerTransferId: r.refund_id, failureReason: r.status === 'failed' ? 'Refund failed at Bachs' : undefined };
    } catch (err) {
      return { accepted: false, failureReason: err.message };
    }
  }

  async payout() {
    const err = new Error('bachs: payouts to cooks (Connect transfers) are not wired yet');
    err.code = 'CONNECTOR_NOT_IMPLEMENTED';
    throw err;
  }

  async verifyTransfer() { return { status: 'pending', raw: { note: 'bachs payouts not wired' } }; }
  async listBanks() { return []; }

  /**
   * X-Bachs-Signature-V2: "t=<unix>,v1=<hex>[,v1=<hex>]" — HMAC-SHA256 of
   * "<t>.<raw body>" with the endpoint's signing secret. Any v1 may match (a
   * secret rotation signs with both). Deliveries older than 5 minutes are
   * refused. Convention (orchestrator.ingestWebhook): null = no secret set.
   */
  verifyWebhookSignature(headers, rawBody, { now = Date.now(), toleranceSeconds = 300 } = {}) {
    if (!this._webhookSecret) return null;
    if (rawBody == null || (typeof rawBody !== 'string' && !Buffer.isBuffer(rawBody))) return false;
    const header = headers['x-bachs-signature-v2'];
    let t; let sigs = [];
    if (header) {
      for (const part of String(header).split(',')) {
        const i = part.indexOf('=');
        if (i < 0) continue;
        const k = part.slice(0, i).trim(); const v = part.slice(i + 1).trim();
        if (k === 't') t = v; else if (k === 'v1') sigs.push(v);
      }
    } else {
      t = headers['x-bachs-timestamp'];
      if (headers['x-bachs-signature']) sigs = [String(headers['x-bachs-signature'])];
    }
    const ts = Number(t);
    if (!Number.isFinite(ts) || !sigs.length) return false;
    if (Math.abs(now / 1000 - ts) > toleranceSeconds) return false;
    const body = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(rawBody, 'utf8');
    const expected = crypto.createHmac('sha256', this._webhookSecret)
      .update(Buffer.concat([Buffer.from(`${ts}.`, 'utf8'), body])).digest('hex');
    const exp = Buffer.from(expected, 'utf8');
    return sigs.some(s => {
      const got = Buffer.from(s, 'utf8');
      return got.length === exp.length && crypto.timingSafeEqual(got, exp);
    });
  }

  /** @returns {import('../PaymentConnector').NormalizedEvent} */
  parseWebhook(headers, body) {
    const type = body?.type;
    const d = body?.data ?? {};
    let normalized = 'unknown';
    // Either may arrive first; the order is confirmed on whichever comes, once
    // (confirmOrderCharge re-verifies with Bachs and is idempotent).
    if (type === 'collection.succeeded' || type === 'checkout.completed') normalized = 'charge.succeeded';
    else if (type === 'collection.failed') normalized = 'charge.failed';
    else if (type === 'dispute.created') normalized = 'chargeback.opened';
    return {
      type: normalized,
      reference: d.reference ?? d.metadata?.reference ?? '',
      providerTxId: d.charge_id ?? undefined,
      providerCheckoutId: d.checkout_id ?? undefined,
      amount: d.amount != null ? Number(d.amount) : undefined,
      currency: d.currency ? String(d.currency).toUpperCase() : undefined,
      dedupeKey: body?.id ?? `${type}:${d.reference ?? d.checkout_id ?? ''}`,
      raw: body,
    };
  }
}

module.exports = { BachsConnector };
