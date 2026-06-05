/**
 * FOODSbyme Logistics Service
 * Provider-agnostic courier layer. Set LOGISTICS_PROVIDER to switch.
 *
 * Bolt credentials required:
 *   BOLT_INTEGRATOR_ID  — assigned per environment (staging / production)
 *   BOLT_SECRET_KEY     — paired secret
 *   BOLT_WEBHOOK_SECRET — used to verify incoming Bolt webhook signatures
 *
 * Trigger: requestDelivery() fires when order.status → 'ready'
 * Fallback: if no provider or API fails → admin notification + manual fallback
 */

const PROVIDER = process.env.LOGISTICS_PROVIDER; // 'bolt' | 'kwik' | 'sendbox'
const BOLT_BASE = 'https://delivery.bolt.eu';

// ── Public interface ────────────────────────────────────────────────────────

async function requestDelivery({
  orderId, pickupAddress, pickupLat, pickupLng,
  dropoffAddress, dropoffLat, dropoffLng,
  contactPhone, contactName, itemDescription,
  cookPhone,
}) {
  try {
    if (PROVIDER === 'bolt')    return await boltCreate({ orderId, pickupAddress, pickupLat, pickupLng, dropoffAddress, dropoffLat, dropoffLng, contactPhone, contactName, itemDescription, cookPhone });
    if (PROVIDER === 'kwik')    return await kwikRequest({ orderId, pickupAddress, pickupLat, pickupLng, dropoffAddress, dropoffLat, dropoffLng, contactPhone });
    if (PROVIDER === 'sendbox') return await sendboxRequest({ orderId, pickupAddress, pickupLat, pickupLng, dropoffAddress, dropoffLat, dropoffLng, contactPhone });

    console.warn(`[logistics] No provider configured — order ${orderId} needs manual dispatch.`);
    return { success: false, error: 'no_provider', trackingId: null };
  } catch (err) {
    console.error(`[logistics] Dispatch error for order ${orderId}:`, err.message);
    return { success: false, error: err.message, trackingId: null };
  }
}

async function getDeliveryStatus(trackingId) {
  try {
    if (PROVIDER === 'bolt') return await boltGetStatus(trackingId);
    return { status: 'unknown', trackingId };
  } catch (err) {
    return { status: 'error', error: err.message, trackingId };
  }
}

async function cancelDelivery(trackingId) {
  try {
    if (PROVIDER === 'bolt') return await boltCancel(trackingId);
    return { success: false, error: 'no_provider' };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

async function getDeliveryFeeEstimate({ pickupLat, pickupLng, dropoffLat, dropoffLng }) {
  try {
    if (PROVIDER === 'bolt') return await boltEstimate({ pickupLat, pickupLng, dropoffLat, dropoffLng });
  } catch (err) {
    console.warn('[logistics] Fee estimate failed, using distance fallback:', err.message);
  }
  // Distance-based fallback (NGN)
  const distance = haversineDistance(pickupLat, pickupLng, dropoffLat, dropoffLng);
  let fee;
  if (distance <= 3)  fee = 800;
  else if (distance <= 5)  fee = 1200;
  else if (distance <= 10) fee = 1800;
  else if (distance <= 15) fee = 2500;
  else fee = 3500;
  return { fee, distance: Math.round(distance * 10) / 10, currency: 'NGN', source: 'estimate' };
}

// ── Bolt implementation ────────────────────────────────────────────────────

function boltAuthHeaders() {
  const id  = process.env.BOLT_INTEGRATOR_ID;
  const key = process.env.BOLT_SECRET_KEY;
  if (!id || !key) throw new Error('BOLT_INTEGRATOR_ID / BOLT_SECRET_KEY not set');
  const creds = Buffer.from(`${id}:${key}`).toString('base64');
  return {
    'Authorization': `Basic ${creds}`,
    'Content-Type':  'application/json',
    'Accept':        'application/json',
  };
}

async function boltCreate({
  orderId, pickupAddress, pickupLat, pickupLng,
  dropoffAddress, dropoffLat, dropoffLng,
  contactPhone, contactName, itemDescription, cookPhone,
}) {
  const webhookUrl = `${process.env.APP_BASE_URL}/api/logistics/bolt/webhook`;

  const body = {
    external_id: orderId,
    description: itemDescription || 'Food order from FOODSbyme',
    webhook_url: webhookUrl,
    pickup: {
      address:   pickupAddress,
      latitude:  pickupLat,
      longitude: pickupLng,
      contact: {
        name:  'FOODSbyme Cook',
        phone: cookPhone || process.env.SUPPORT_PHONE || '',
      },
    },
    dropoff: {
      address:   dropoffAddress,
      latitude:  dropoffLat,
      longitude: dropoffLng,
      contact: {
        name:  contactName || 'Customer',
        phone: contactPhone || '',
      },
    },
  };

  const res = await fetch(`${BOLT_BASE}/v1/deliveries`, {
    method:  'POST',
    headers: boltAuthHeaders(),
    body:    JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Bolt create delivery ${res.status}: ${text}`);
  }

  const data = await res.json();
  return {
    success:           true,
    trackingId:        data.id ?? data.tracking_id ?? data.order_id,
    trackingUrl:       data.tracking_url ?? null,
    estimatedPickup:   data.estimated_pickup_time ?? null,
    estimatedDelivery: data.estimated_delivery_time ?? null,
    provider:          'bolt',
    raw:               data,
  };
}

async function boltGetStatus(trackingId) {
  const res = await fetch(`${BOLT_BASE}/v1/deliveries/${trackingId}`, {
    headers: boltAuthHeaders(),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Bolt status ${res.status}: ${text}`);
  }
  const data = await res.json();
  return {
    status:            data.status,
    trackingId,
    driverName:        data.driver?.name ?? null,
    driverPhone:       data.driver?.phone ?? null,
    driverLatitude:    data.driver?.latitude ?? null,
    driverLongitude:   data.driver?.longitude ?? null,
    estimatedDelivery: data.estimated_delivery_time ?? null,
    trackingUrl:       data.tracking_url ?? null,
    raw:               data,
  };
}

async function boltCancel(trackingId) {
  const res = await fetch(`${BOLT_BASE}/v1/deliveries/${trackingId}/cancel`, {
    method:  'POST',
    headers: boltAuthHeaders(),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Bolt cancel ${res.status}: ${text}`);
  }
  return { success: true, trackingId, provider: 'bolt' };
}

async function boltEstimate({ pickupLat, pickupLng, dropoffLat, dropoffLng }) {
  const body = {
    pickup:  { latitude: pickupLat,  longitude: pickupLng },
    dropoff: { latitude: dropoffLat, longitude: dropoffLng },
  };
  const res = await fetch(`${BOLT_BASE}/v1/pricing/calculate`, {
    method:  'POST',
    headers: boltAuthHeaders(),
    body:    JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Bolt estimate ${res.status}`);
  const data = await res.json();
  return {
    fee:      data.price ?? data.amount ?? data.total,
    currency: data.currency ?? 'NGN',
    source:   'bolt',
    raw:      data,
  };
}

/**
 * Verify a Bolt webhook signature.
 * Bolt signs the raw body with HMAC-SHA256 using BOLT_WEBHOOK_SECRET.
 * The signature is sent in the X-Bolt-Signature header.
 */
function verifyBoltWebhook(rawBody, signature) {
  const secret = process.env.BOLT_WEBHOOK_SECRET;
  if (!secret) return true; // skip verification if secret not configured yet
  const crypto = require('crypto');
  const expected = crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex');
  return crypto.timingSafeEqual(
    Buffer.from(expected, 'hex'),
    Buffer.from(signature?.replace(/^sha256=/, '') ?? '', 'hex'),
  );
}

// ── Kwik (stub) ────────────────────────────────────────────────────────────

async function kwikRequest(params) {
  console.log('[logistics] Kwik delivery requested:', params.orderId);
  return { success: true, trackingId: `kwik_${Date.now()}`, provider: 'kwik' };
}

// ── Sendbox (stub) ─────────────────────────────────────────────────────────

async function sendboxRequest(params) {
  console.log('[logistics] Sendbox delivery requested:', params.orderId);
  return { success: true, trackingId: `sendbox_${Date.now()}`, provider: 'sendbox' };
}

// ── Utility ────────────────────────────────────────────────────────────────

function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

module.exports = {
  requestDelivery,
  getDeliveryStatus,
  cancelDelivery,
  getDeliveryFeeEstimate,
  verifyBoltWebhook,
};
