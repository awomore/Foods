const { PaymentConnector } = require('../PaymentConnector');

const FW_BASE = 'https://api.flutterwave.com/v3';

/**
 * FlutterwaveConnector — the current FOODS payment rail, extracted verbatim from
 * routes/payments.js, routes/wallet.js and routes/earnings.js into the shared
 * PaymentConnector contract. Behavior is intentionally identical; this is a
 * refactor, not a rewrite.
 *
 * Flutterwave settles NGN plus several other African currencies and USD/EUR/GBP,
 * so it is FOODS's core African rail. Capability fields below are read by the
 * orchestrator's router.
 */
class FlutterwaveConnector extends PaymentConnector {
  constructor({ secret = process.env.FLUTTERWAVE_SECRET_KEY, webhookHash = process.env.FLUTTERWAVE_WEBHOOK_HASH } = {}) {
    super();
    this._secret = secret;
    this._webhookHash = webhookHash;
  }

  get id() { return 'flutterwave'; }
  get countries() { return ['NG', 'GH', 'KE', 'UG', 'ZA', 'TZ', 'RW', 'ZM']; }
  get currencies() { return ['NGN', 'GHS', 'KES', 'UGX', 'ZAR', 'TZS', 'RWF', 'ZMW', 'USD', 'EUR', 'GBP']; }
  get methods() { return ['card', 'bank', 'momo', 'ussd']; }
  get configured() { return Boolean(this._secret); }

  _authHeaders(extra = {}) {
    return { Authorization: `Bearer ${this._secret}`, ...extra };
  }

  /** Normalize Flutterwave's payment_type into our shared method vocabulary. */
  static _method(paymentType) {
    switch (paymentType) {
      case 'card': return 'card';
      case 'account':
      case 'banktransfer':
      case 'bank_transfer': return 'bank';
      case 'mobilemoney':
      case 'mobilemoneyghana':
      case 'mpesa': return 'momo';
      case 'ussd': return 'ussd';
      default: return paymentType || 'unknown';
    }
  }

  /** @param {import('../PaymentConnector').ChargeIntent} intent */
  async createCharge(intent) {
    const payload = {
      tx_ref: intent.reference,
      amount: parseFloat(intent.amount).toFixed(2),
      currency: intent.currency,
      redirect_url: intent.redirectUrl,
      customer: {
        email: intent.customer?.email,
        phonenumber: intent.customer?.phone,
        name: intent.customer?.name,
      },
      customizations: {
        title: 'FOODSbyme',
        description: intent.description ?? 'FOODSbyme order',
        logo: 'https://foodsbyme.com/logo.png',
      },
      meta: intent.meta ?? {},
    };

    const fwRes = await fetch(`${FW_BASE}/payments`, {
      method: 'POST',
      headers: this._authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload),
    });
    const fwData = await fwRes.json();

    if (fwData.status !== 'success') {
      const err = new Error(fwData.message ?? 'Payment provider error');
      err.code = 'CONNECTOR_CHARGE_FAILED';
      err.detail = fwData;
      throw err;
    }

    return { reference: intent.reference, redirectLink: fwData.data.link };
  }

  /** @param {{reference?:string, providerTxId?:string}} ref */
  async verifyCharge({ reference, providerTxId } = {}) {
    const endpoint = providerTxId
      ? `${FW_BASE}/transactions/${providerTxId}/verify`
      : `${FW_BASE}/transactions/verify_by_reference?tx_ref=${encodeURIComponent(reference)}`;

    const fwRes = await fetch(endpoint, { headers: this._authHeaders() });
    const fwData = await fwRes.json();

    const ok = fwData.status === 'success' && fwData.data?.status === 'successful';
    return {
      successful: ok,
      reference: fwData.data?.tx_ref ?? reference,
      providerTxId: fwData.data?.id != null ? String(fwData.data.id) : undefined,
      amount: fwData.data?.amount != null ? parseFloat(fwData.data.amount) : undefined,
      currency: fwData.data?.currency,
      method: FlutterwaveConnector._method(fwData.data?.payment_type),
      meta: fwData.data?.meta ?? {},
      raw: fwData,
    };
  }

  /**
   * Cook payout via Flutterwave Transfers. Mirrors flutterwaveTransfer() in
   * routes/earnings.js, returning a normalized TransferResult.
   * @param {import('../PaymentConnector').PayoutDestination} dest
   * @param {{amount:number,currency:string,reference:string,narration?:string}} money
   */
  async payout(dest, money) {
    const fwRes = await fetch(`${FW_BASE}/transfers`, {
      method: 'POST',
      headers: this._authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({
        account_bank: dest.bankCode,
        account_number: dest.accountNumber,
        amount: money.amount,
        narration: money.narration ?? `FOODSbyme payout - ${money.reference}`,
        currency: money.currency,
        reference: money.reference,
        beneficiary_name: dest.accountName ?? undefined,
      }),
    });
    const fwData = await fwRes.json().catch(() => ({ status: 'error' }));

    if (fwData.status === 'success') {
      return { accepted: true, providerTransferId: fwData.data?.id != null ? String(fwData.data.id) : undefined };
    }
    return { accepted: false, failureReason: fwData.message ?? 'Transfer rejected by Flutterwave' };
  }

  /**
   * Reverse a charge (full or partial) back to the buyer. Mirrors the refund
   * call in routes/orders.js; passing money.amount enables partial refunds.
   * @param {{providerTxId:string,reference:string}} charge
   * @param {{amount?:number,currency?:string}} money
   */
  async refund(charge, money = {}) {
    const body = money.amount != null ? { amount: money.amount } : {};
    const fwRes = await fetch(`${FW_BASE}/transactions/${charge.providerTxId}/refund`, {
      method: 'POST',
      headers: this._authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(body),
    });
    const fwData = await fwRes.json().catch(() => ({ status: 'error' }));

    if (fwData.status === 'success') {
      return { accepted: true, providerTransferId: fwData.data?.id != null ? String(fwData.data.id) : undefined };
    }
    return { accepted: false, failureReason: fwData.message ?? 'Refund rejected by Flutterwave' };
  }

  /** verif-hash header check, matching routes/payments.js webhook handler. */
  verifyWebhookSignature(headers) {
    const signature = headers['verif-hash'];
    // Caller decides the fail-open/closed policy for a missing hash (see orchestrator).
    if (!this._webhookHash) return null; // null = "no secret configured"
    return signature === this._webhookHash;
  }

  /** @returns {import('../PaymentConnector').NormalizedEvent} */
  parseWebhook(headers, body) {
    const { event, data } = body ?? {};
    const reference = data?.tx_ref ?? String(data?.id ?? event ?? '');
    const dedupeKey = reference;

    let type = 'unknown';
    if (event === 'charge.completed' && data?.status === 'successful') type = 'charge.succeeded';
    else if (event === 'charge.failed') type = 'charge.failed';
    else if (event === 'transfer.completed') type = 'transfer.completed';

    return {
      type,
      reference: data?.tx_ref ?? reference,
      providerTxId: data?.id != null ? String(data.id) : undefined,
      amount: data?.amount != null ? parseFloat(data.amount) : undefined,
      currency: data?.currency,
      dedupeKey,
      raw: body,
    };
  }
}

module.exports = { FlutterwaveConnector };
