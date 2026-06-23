/**
 * Relay by Chowdeck delivery API client.
 * Docs: https://chowdeck.readme.io/reference/getting-started-with-relay
 * Auth: Bearer token from RELAY_API_KEY env var.
 * Keys: https://dashboard.chowdeck.com/settings/developers
 */

const RELAY_BASE    = 'https://api.chowdeck.com/relay';
const RELAY_API_KEY = process.env.RELAY_API_KEY;

function getHeaders() {
  if (!RELAY_API_KEY) throw new Error('RELAY_API_KEY must be set in environment variables');
  return {
    'Content-Type':  'application/json',
    'Authorization': `Bearer ${RELAY_API_KEY}`,
  };
}

async function relayRequest(method, path, body) {
  const res = await fetch(`${RELAY_BASE}${path}`, {
    method,
    headers: getHeaders(),
    body: body ? JSON.stringify(body) : undefined,
  });
  return res;
}

/**
 * Get a delivery fee quote.
 * Returns fee_id which must be passed immediately to dispatchOrder.
 * fee_id expires — always re-quote immediately before dispatching.
 *
 * @param {{ sourceLat: number, sourceLng: number, destLat: number, destLng: number, estimatedOrderAmount?: number }} params
 * @returns {{ feeId: number, totalAmount: number, deliveryAmount: number, safetyFee: number, currency: 'NGN' }}
 */
async function getQuote({ sourceLat, sourceLng, destLat, destLng, estimatedOrderAmount = 0 }) {
  const res = await relayRequest('POST', '/delivery/fee', {
    source_address:      { latitude: sourceLat, longitude: sourceLng },
    destination_address: { latitude: destLat,   longitude: destLng },
    estimated_order_amount: Math.round(estimatedOrderAmount),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Relay quote failed ${res.status}: ${text}`);
  }

  const json = await res.json();
  const d = json?.data ?? {};
  return {
    feeId:          d.id,
    totalAmount:    d.total_amount ?? 0,
    deliveryAmount: d.delivery_amount ?? 0,
    safetyFee:      d.safety_fee ?? 0,
    currency:       'NGN',
  };
}

/**
 * Dispatch a Relay rider for an order.
 * Call getQuote immediately before this — the feeId expires.
 *
 * @returns {{ reference: string, trackingUrl: string|null, deliveryPin: number|null }}
 */
async function dispatchOrder({
  feeId,
  orderId,
  sourceContact,   // { name, phone, email? }
  destContact,     // { name, phone, email? }
  itemType = 'food',
  customerNote,
}) {
  const res = await relayRequest('POST', '/delivery', {
    fee_id:      feeId,
    reference:   orderId,
    item_type:   itemType,
    user_action: 'sending',
    source_contact: {
      name:         sourceContact.name ?? 'FOODSbyme Kitchen',
      phone:        sourceContact.phone ?? '',
      country_code: 'NG',
    },
    destination_contact: {
      name:         destContact.name ?? 'Customer',
      phone:        destContact.phone ?? '',
      country_code: 'NG',
    },
    customer_delivery_note: customerNote ?? undefined,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Relay dispatch failed ${res.status}: ${text}`);
  }

  const json = await res.json();
  const d = json?.data ?? {};
  return {
    reference:   d.reference ?? orderId,
    trackingUrl: d.tracking_url ?? null,
    deliveryPin: d.delivery_pin ?? null,
  };
}

/**
 * Get current status and tracking info for a Relay delivery.
 */
async function getDelivery(reference) {
  const res = await relayRequest('GET', `/delivery/${encodeURIComponent(reference)}`);
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Relay get delivery failed ${res.status}: ${text}`);
  }
  return res.json();
}

/**
 * Cancel an active Relay delivery.
 */
async function cancelDelivery(reference, reason = 'Order cancelled') {
  const res = await relayRequest('POST', `/delivery/${encodeURIComponent(reference)}/cancel`, { reason });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Relay cancel failed ${res.status}: ${text}`);
  }
}

/**
 * Get the Relay wallet balance (for monitoring spend).
 */
async function getWalletBalance() {
  const res = await relayRequest('GET', '/wallet/balance');
  if (!res.ok) return null;
  const json = await res.json();
  return json?.data ?? null;
}

module.exports = { getQuote, dispatchOrder, getDelivery, cancelDelivery, getWalletBalance };
