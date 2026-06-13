// Concept-level API reference for the FOODS partner platform.
// These document the intended developer surface — FOODS as infrastructure.

export type Endpoint = { method: 'GET' | 'POST' | 'PATCH' | 'DELETE'; path: string; summary: string };

export type ApiDoc = {
  slug: string;
  name: string;
  tagline: string;
  intro: string;
  capabilities: string[];
  endpoints: Endpoint[];
  sampleTitle: string;
  sampleRequest: string;
  sampleResponse: string;
};

export const APIS: ApiDoc[] = [
  {
    slug: 'order-assignment',
    name: 'Order Assignment API',
    tagline: 'Route creator orders to your fleet, programmatically.',
    intro:
      'The Order Assignment API lets logistics partners receive, accept, and manage delivery jobs as they are created across the FOODS network. Pull available jobs, accept them for a rider, and keep order state in sync with your own dispatch system.',
    capabilities: [
      'Receive available delivery jobs in your zones',
      'Accept or decline jobs on behalf of a rider',
      'Reassign a job between riders',
      'Sync order lifecycle state with your dispatch system',
    ],
    endpoints: [
      { method: 'GET', path: '/v1/orders/available', summary: 'List unassigned jobs in your territories' },
      { method: 'POST', path: '/v1/orders/{order_id}/accept', summary: 'Accept a job for a rider' },
      { method: 'POST', path: '/v1/orders/{order_id}/reassign', summary: 'Move a job to another rider' },
      { method: 'GET', path: '/v1/orders/{order_id}', summary: 'Retrieve a single order' },
    ],
    sampleTitle: 'Accept an order for a rider',
    sampleRequest: `curl -X POST https://api.foodsbyme.com/v1/orders/ord_8Kd2/accept \\
  -H "Authorization: Bearer $FOODS_PARTNER_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{ "rider_id": "rdr_19f3" }'`,
    sampleResponse: `{
  "order_id": "ord_8Kd2",
  "status": "assigned",
  "rider_id": "rdr_19f3",
  "pickup": { "creator": "Mama Titi's Kitchen", "eta_mins": 7 },
  "dropoff": { "area": "Lekki Phase 1" },
  "payout_estimate": { "currency": "NGN", "amount": 850 }
}`,
  },
  {
    slug: 'driver-status',
    name: 'Driver Status API',
    tagline: 'Keep rider availability and capacity in sync.',
    intro:
      'Report your riders’ availability, online status, and capacity so the network can route the right volume to your fleet. Accurate status improves assignment quality and your reliability score.',
    capabilities: [
      'Set riders online, offline, or on-break',
      'Report current capacity and active deliveries',
      'Update rider vehicle and zone',
      'Retrieve aggregate fleet availability',
    ],
    endpoints: [
      { method: 'PATCH', path: '/v1/riders/{rider_id}/status', summary: 'Update a rider’s availability' },
      { method: 'GET', path: '/v1/riders', summary: 'List your riders and their status' },
      { method: 'GET', path: '/v1/fleet/availability', summary: 'Aggregate availability by zone' },
    ],
    sampleTitle: 'Set a rider online',
    sampleRequest: `curl -X PATCH https://api.foodsbyme.com/v1/riders/rdr_19f3/status \\
  -H "Authorization: Bearer $FOODS_PARTNER_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{ "status": "online", "zone": "lekki", "capacity": 2 }'`,
    sampleResponse: `{
  "rider_id": "rdr_19f3",
  "status": "online",
  "zone": "lekki",
  "capacity": 2,
  "active_deliveries": 0,
  "updated_at": "2026-06-13T10:42:11Z"
}`,
  },
  {
    slug: 'tracking',
    name: 'Tracking API',
    tagline: 'Real-time location and delivery status.',
    intro:
      'Stream and query live location and status for in-flight deliveries. Power your own tracking views, or push location updates from your devices into the FOODS customer experience.',
    capabilities: [
      'Push rider location updates',
      'Query live status for any active order',
      'Retrieve a delivery’s route and timestamps',
      'Surface ETAs to customers and creators',
    ],
    endpoints: [
      { method: 'POST', path: '/v1/tracking/{order_id}/location', summary: 'Push a location ping' },
      { method: 'GET', path: '/v1/tracking/{order_id}', summary: 'Get live tracking state' },
    ],
    sampleTitle: 'Push a location update',
    sampleRequest: `curl -X POST https://api.foodsbyme.com/v1/tracking/ord_8Kd2/location \\
  -H "Authorization: Bearer $FOODS_PARTNER_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{ "lat": 6.4361, "lng": 3.4847, "heading": 118, "speed_kph": 24 }'`,
    sampleResponse: `{
  "order_id": "ord_8Kd2",
  "status": "in_transit",
  "location": { "lat": 6.4361, "lng": 3.4847 },
  "eta_mins": 6,
  "distance_remaining_km": 1.8
}`,
  },
  {
    slug: 'webhooks',
    name: 'Webhook Events',
    tagline: 'React to network events as they happen.',
    intro:
      'Subscribe to webhook events to keep your systems in sync without polling. FOODS signs every payload so you can verify authenticity. Events fire across the order and settlement lifecycle.',
    capabilities: [
      'Subscribe to lifecycle events',
      'Verify signed payloads',
      'Automatic retries with backoff',
      'Replay recent events from the dashboard',
    ],
    endpoints: [
      { method: 'POST', path: '/v1/webhook_endpoints', summary: 'Register a webhook endpoint' },
      { method: 'GET', path: '/v1/webhook_endpoints', summary: 'List your endpoints' },
      { method: 'DELETE', path: '/v1/webhook_endpoints/{id}', summary: 'Remove an endpoint' },
    ],
    sampleTitle: 'Example event payload',
    sampleRequest: `// Events you can subscribe to
order.created
order.assigned
order.picked_up
order.delivered
order.cancelled
settlement.paid`,
    sampleResponse: `{
  "id": "evt_5Tg9",
  "type": "order.delivered",
  "created": "2026-06-13T11:02:55Z",
  "data": {
    "order_id": "ord_8Kd2",
    "rider_id": "rdr_19f3",
    "delivered_at": "2026-06-13T11:02:50Z",
    "payout": { "currency": "NGN", "amount": 850 }
  }
}`,
  },
  {
    slug: 'settlement',
    name: 'Settlement API',
    tagline: 'Reconcile earnings and payouts.',
    intro:
      'Retrieve granular settlement data — what was earned, what’s pending, and what’s been paid. Reconcile FOODS payouts against your own ledger and pay your riders with confidence.',
    capabilities: [
      'List settlements by period',
      'Break earnings down per order and per rider',
      'Retrieve payout statements',
      'Reconcile against your ledger',
    ],
    endpoints: [
      { method: 'GET', path: '/v1/settlements', summary: 'List settlements for a period' },
      { method: 'GET', path: '/v1/settlements/{id}', summary: 'Retrieve a settlement statement' },
      { method: 'GET', path: '/v1/earnings', summary: 'Per-order earnings breakdown' },
    ],
    sampleTitle: 'Retrieve a settlement statement',
    sampleRequest: `curl https://api.foodsbyme.com/v1/settlements/set_2026w24 \\
  -H "Authorization: Bearer $FOODS_PARTNER_KEY"`,
    sampleResponse: `{
  "id": "set_2026w24",
  "period": "2026-W24",
  "currency": "NGN",
  "gross": 1840500,
  "deductions": 0,
  "net": 1840500,
  "status": "paid",
  "orders_count": 2166,
  "paid_at": "2026-06-16T09:00:00Z"
}`,
  },
  {
    slug: 'partner-analytics',
    name: 'Partner Analytics API',
    tagline: 'Measure performance and grow.',
    intro:
      'Pull the metrics that matter — on-time rate, acceptance rate, utilisation, and earnings trends — to manage your fleet and qualify for more volume and territory.',
    capabilities: [
      'Fleet and per-rider performance metrics',
      'On-time and acceptance rates over time',
      'Utilisation and idle-time analysis',
      'Earnings trends by zone',
    ],
    endpoints: [
      { method: 'GET', path: '/v1/analytics/fleet', summary: 'Fleet-level KPIs' },
      { method: 'GET', path: '/v1/analytics/riders/{rider_id}', summary: 'Per-rider performance' },
      { method: 'GET', path: '/v1/analytics/zones', summary: 'Performance by zone' },
    ],
    sampleTitle: 'Fleet KPIs for a date range',
    sampleRequest: `curl "https://api.foodsbyme.com/v1/analytics/fleet?from=2026-06-01&to=2026-06-13" \\
  -H "Authorization: Bearer $FOODS_PARTNER_KEY"`,
    sampleResponse: `{
  "period": { "from": "2026-06-01", "to": "2026-06-13" },
  "orders_delivered": 4120,
  "on_time_rate": 0.962,
  "acceptance_rate": 0.948,
  "avg_delivery_mins": 18.4,
  "utilisation": 0.71,
  "net_earnings": { "currency": "NGN", "amount": 3502000 }
}`,
  },
];

export const getApi = (slug: string) => APIS.find((a) => a.slug === slug);
