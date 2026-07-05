/**
 * PaymentConnector — the contract every payment gateway adapter implements.
 *
 * This is the seam that lets FOODS expand to new countries by adding a class
 * instead of editing route handlers. The orchestrator (see orchestrator.js) is
 * the ONLY caller of these methods; routes never touch a gateway SDK directly.
 *
 * All money in Phase 1 is still passed as { amount, currency } with amount in
 * MAJOR units (e.g. 1500.00 NGN), matching the current Flutterwave code. The
 * minor-unit Money value type is a Phase 2 change and deliberately not here yet.
 *
 * @typedef {Object} ChargeIntent
 * @property {number} amount            Amount in major units (e.g. 1500.00).
 * @property {string} currency         ISO-4217, e.g. 'NGN'.
 * @property {string} reference        Idempotency / tx reference owned by FOODS.
 * @property {string} redirectUrl      Where the gateway returns the buyer.
 * @property {Object} customer         { email, name, phone }.
 * @property {Object} [meta]           Arbitrary metadata echoed back on webhooks.
 * @property {string} [description]    Human description for the gateway UI.
 *
 * @typedef {Object} ChargeResult
 * @property {string} reference        The tx reference (echoes intent.reference).
 * @property {string|null} redirectLink Hosted-checkout link, or null in dev mode.
 *
 * @typedef {Object} ChargeStatus
 * @property {boolean} successful
 * @property {string}  reference
 * @property {string}  providerTxId    The gateway's own transaction id.
 * @property {number}  amount
 * @property {string}  currency
 * @property {string}  method          Normalized: 'card' | 'bank' | 'momo' | ...
 * @property {Object}  raw             The untouched provider payload.
 *
 * @typedef {Object} PayoutDestination
 * @property {string} bankCode
 * @property {string} accountNumber
 * @property {string} [accountName]
 *
 * @typedef {Object} TransferResult
 * @property {boolean} accepted
 * @property {string}  [providerTransferId]
 * @property {string}  [failureReason]
 *
 * @typedef {Object} NormalizedEvent
 * @property {'charge.succeeded'|'charge.failed'|'transfer.completed'|'transfer.failed'|'chargeback.opened'|'unknown'} type
 * @property {string}  reference        FOODS tx reference this event concerns.
 * @property {string}  [providerTxId]
 * @property {number}  [amount]
 * @property {string}  [currency]
 * @property {string}  dedupeKey        Stable key for processed_webhooks.
 * @property {Object}  raw
 */

/**
 * Base class documenting the contract. Concrete connectors extend this and
 * override the methods they support. Capability fields (`id`, `countries`,
 * `currencies`, `methods`, `configured`) are read by the orchestrator's router.
 */
class PaymentConnector {
  /** @returns {string} stable id, e.g. 'flutterwave' */
  get id() { throw new Error('connector must define id'); }

  /** @returns {string[]} ISO-3166 country codes this rail settles */
  get countries() { return []; }

  /** @returns {string[]} ISO-4217 currencies this rail settles */
  get currencies() { return []; }

  /** @returns {string[]} payment methods, e.g. ['card','bank','momo'] */
  get methods() { return []; }

  /** @returns {boolean} true when live credentials are present */
  get configured() { return false; }

  /** @param {ChargeIntent} intent @returns {Promise<ChargeResult>} */
  async createCharge(intent) { throw new Error(`${this.id}: createCharge not implemented`); }

  /** @param {{reference?:string, providerTxId?:string}} ref @returns {Promise<ChargeStatus>} */
  async verifyCharge(ref) { throw new Error(`${this.id}: verifyCharge not implemented`); }

  /** @param {PayoutDestination} dest @param {{amount:number,currency:string,reference:string,narration?:string}} money @returns {Promise<TransferResult>} */
  async payout(dest, money) { throw new Error(`${this.id}: payout not implemented`); }

  /** @param {{providerTxId:string,reference:string}} charge @param {{amount:number,currency:string}} money @returns {Promise<TransferResult>} */
  async refund(charge, money) { throw new Error(`${this.id}: refund not implemented`); }

  /** @param {Object} headers @param {Buffer|string} rawBody @returns {boolean} */
  verifyWebhookSignature(headers, rawBody) { return false; }

  /** @param {Object} headers @param {Object} body @returns {NormalizedEvent} */
  parseWebhook(headers, body) { return { type: 'unknown', reference: '', dedupeKey: '', raw: body }; }
}

/** Thrown by the orchestrator when no eligible connector exists for a context. */
class NoRouteError extends Error {
  constructor(context) {
    super(`No payment connector for ${context.country ?? '?'} / ${context.currency ?? '?'} / ${context.method ?? 'any'}`);
    this.name = 'NoRouteError';
    this.code = 'NO_PAYMENT_ROUTE';
    this.context = context;
  }
}

module.exports = { PaymentConnector, NoRouteError };
