/**
 * Fez Delivery API client
 * Auth: static API Key as Bearer token + separate Secret Key header.
 * Both are issued by Fez after KYC approval.
 */

const FEZ_BASE    = process.env.FEZ_BASE_URL ?? 'https://apisandbox.fezdelivery.co/v1';
const FEZ_API_KEY = process.env.FEZ_API_KEY;
const FEZ_SENDER_NAME    = process.env.FEZ_SENDER_NAME    ?? 'FOODSbyme';
const FEZ_SENDER_ADDRESS = process.env.FEZ_SENDER_ADDRESS ?? 'Lagos, Nigeria';
const FEZ_SENDER_PHONE   = process.env.FEZ_SENDER_PHONE   ?? '';

function getHeaders() {
  if (!FEZ_API_KEY) {
    throw new Error('FEZ_API_KEY must be set in environment variables');
  }
  return {
    'Content-Type':  'application/json',
    'Authorization': `Bearer ${FEZ_API_KEY}`,
    'secret-key':    FEZ_API_KEY,
  };
}

async function fezRequest(method, path, body) {
  const res = await fetch(`${FEZ_BASE}${path}`, {
    method,
    headers: getHeaders(),
    body: body ? JSON.stringify(body) : undefined,
  });
  return res;
}

/**
 * Get delivery cost estimate.
 * @param {string} pickUpState - Cook's Nigerian state (e.g. "Lagos")
 * @param {string} recipientState - Customer's Nigerian state
 * @param {number} weight - in kg
 * @returns {{ fee: number, currency: 'NGN' }}
 */
async function getQuote(pickUpState, recipientState, weight = 1) {
  const res = await fezRequest('POST', '/order/cost', {
    state: recipientState,
    pickUpState,
    weight,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Fez quote failed ${res.status}: ${text}`);
  }

  const json = await res.json();
  const fee = json?.data?.cost ?? json?.cost ?? json?.amount ?? 0;
  return { fee: Number(fee), currency: 'NGN' };
}

/**
 * Dispatch a Fez rider for an order.
 * @returns {{ fezOrderNumber: string, batchId: string }}
 */
async function dispatchOrder(params) {
  const {
    orderId,
    recipientAddress,
    recipientState,
    recipientName,
    recipientPhone,
    valueOfItem,
    weight = 1,
    cookAddress = FEZ_SENDER_ADDRESS,
    cookPhone   = FEZ_SENDER_PHONE,
  } = params;

  const batchId = `FB-${orderId.slice(0, 8)}-${Date.now()}`;

  const payload = [{
    recipientAddress,
    recipientState,
    recipientName:  recipientName  || 'Customer',
    recipientPhone: recipientPhone || '',
    uniqueID:       orderId,
    BatchID:        batchId,
    valueOfItem:    Math.round(valueOfItem),
    weight,
    thirdparty:     true,
    senderName:     FEZ_SENDER_NAME,
    senderAddress:  cookAddress,
    senderPhone:    cookPhone,
  }];

  const res = await fezRequest('POST', '/order', payload);

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Fez dispatch failed ${res.status}: ${text}`);
  }

  const json = await res.json();
  const created = json?.data?.[0] ?? json?.[0] ?? json?.data ?? json;
  const fezOrderNumber = created?.orderNumber ?? created?.order_number ?? batchId;

  return { fezOrderNumber, batchId };
}

/**
 * Track a Fez order by order number.
 */
async function trackOrder(orderNumber) {
  const res = await fezRequest('GET', `/order/track/${encodeURIComponent(orderNumber)}`);

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Fez track failed ${res.status}: ${text}`);
  }

  return res.json();
}

module.exports = { getQuote, dispatchOrder, trackOrder };
