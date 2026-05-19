/**
 * FOODSbyme Logistics Service
 * Provider-agnostic courier layer. Switching providers requires only
 * changing the LOGISTICS_PROVIDER environment variable.
 *
 * Trigger: requestDelivery() fires when order.status → 'ready'
 * Fallback: if no provider or API fails → admin notification
 */

const PROVIDER = process.env.LOGISTICS_PROVIDER; // 'bolt' | 'kwik' | 'sendbox'

async function requestDelivery({ orderId, pickupAddress, pickupLat, pickupLng,
  dropoffAddress, dropoffLat, dropoffLng, contactPhone }) {
  
  try {
    if (PROVIDER === 'bolt') return await boltRequest(arguments[0]);
    if (PROVIDER === 'kwik') return await kwikRequest(arguments[0]);
    if (PROVIDER === 'sendbox') return await sendboxRequest(arguments[0]);

    // No provider configured — notify admin
    console.warn(`No logistics provider configured. Order ${orderId} needs manual dispatch.`);
    return { success: false, error: 'no_provider', trackingId: null };
  } catch (err) {
    console.error(`Logistics error for order ${orderId}:`, err.message);
    return { success: false, error: err.message, trackingId: null };
  }
}

async function requestMultiDrop({ orders }) {
  // For 3+ orders in the same delivery window from the same cook
  // TODO: implement per provider
  console.log('Multi-drop request for', orders.length, 'orders');
  return { success: false, error: 'not_implemented' };
}

async function getDeliveryFeeEstimate({ pickupLat, pickupLng, dropoffLat, dropoffLng }) {
  // Calculate distance-based estimate
  // TODO: implement per provider API
  // For now, return a flat estimate based on rough distance
  const distance = haversineDistance(pickupLat, pickupLng, dropoffLat, dropoffLng);
  
  let fee;
  if (distance <= 3) fee = 800;
  else if (distance <= 5) fee = 1200;
  else if (distance <= 10) fee = 1800;
  else if (distance <= 15) fee = 2500;
  else fee = 3500;

  return { fee, distance: Math.round(distance * 10) / 10, currency: 'NGN' };
}

async function getDeliveryStatus(trackingId) {
  // TODO: implement per provider
  return { status: 'pending', trackingId };
}

async function cancelDelivery(trackingId) {
  // TODO: implement per provider
  return { success: true, trackingId };
}

// ── Provider implementations (stubs — fill in with real API calls) ──

async function boltRequest(params) {
  // TODO: Bolt Food Delivery API integration
  console.log('Bolt delivery requested:', params.orderId);
  return { success: true, trackingId: `bolt_${Date.now()}`, provider: 'bolt' };
}

async function kwikRequest(params) {
  // TODO: Kwik Delivery API integration
  console.log('Kwik delivery requested:', params.orderId);
  return { success: true, trackingId: `kwik_${Date.now()}`, provider: 'kwik' };
}

async function sendboxRequest(params) {
  // TODO: Sendbox API integration
  console.log('Sendbox delivery requested:', params.orderId);
  return { success: true, trackingId: `sendbox_${Date.now()}`, provider: 'sendbox' };
}

// ── Utility ──

function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

module.exports = {
  requestDelivery, requestMultiDrop, getDeliveryFeeEstimate,
  getDeliveryStatus, cancelDelivery
};
