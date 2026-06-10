// [DEBUG-e2e] End-to-end harness: exercises health-kitchen flow + upload/update
// endpoints against a live API using minted JWTs and dedicated test users.
// Usage: node e2e-harness.js [baseUrl]   (default: production Railway URL)
require('dotenv').config();
const { neon } = require('@neondatabase/serverless');
const jwt = require('jsonwebtoken');

const sql = neon(process.env.DATABASE_URL);
const BASE = (process.argv[2] ?? 'https://foodsbyme-api-production.up.railway.app') + '/api';

const CUSTOMER_PHONE = '+2349900000801';
const COOK_PHONE     = '+2349900000802';
const PNG_1PX = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

const results = [];
let customer, cook, cookProfileId, customerToken, cookToken;
const ctx = {}; // ids captured between steps

async function call(method, path, token, body) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, {
    method, headers, body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try { json = await res.json(); } catch { /* non-JSON body */ }
  return { status: res.status, json };
}

async function test(name, fn) {
  try {
    const out = await fn();
    if (out && out.skip) { results.push({ name, ok: 'SKIP', detail: out.skip }); return; }
    results.push({ name, ok: 'PASS', detail: out ?? '' });
  } catch (e) {
    results.push({ name, ok: 'FAIL', detail: e.message });
  }
}

function expect(r, wantStatus, label) {
  if (r.status !== wantStatus) {
    throw new Error(`${label ?? ''} expected ${wantStatus}, got ${r.status}: ${JSON.stringify(r.json)?.slice(0, 160)}`);
  }
  return r.json;
}

async function ensureUser(phone, fullName, role) {
  const existing = await sql`SELECT id FROM users WHERE phone = ${phone}`;
  if (existing.length) return existing[0].id;
  const [u] = await sql`
    INSERT INTO users (full_name, phone, role, is_active)
    VALUES (${fullName}, ${phone}, ${role}, true) RETURNING id`;
  return u.id;
}

async function setup() {
  customer = await ensureUser(CUSTOMER_PHONE, 'E2E Test Customer', 'customer');
  cook     = await ensureUser(COOK_PHONE, 'E2E Test Cook', 'cook');

  const cp = await sql`SELECT id FROM cook_profiles WHERE user_id = ${cook}`;
  if (cp.length) {
    cookProfileId = cp[0].id;
  } else {
    const [row] = await sql`
      INSERT INTO cook_profiles (user_id, display_name, username, verification_status, is_health_kitchen, health_credential_type, health_credential_verified)
      VALUES (${cook}, 'E2E Test Kitchen', 'e2e_test_kitchen', 'approved', true, 'dietician', true)
      RETURNING id`;
    cookProfileId = row.id;
  }
  await sql`UPDATE cook_profiles SET is_health_kitchen = true, verification_status = 'approved' WHERE id = ${cookProfileId}`;

  customerToken = jwt.sign({ userId: customer }, process.env.JWT_SECRET, { expiresIn: '1h' });
  cookToken     = jwt.sign({ userId: cook },     process.env.JWT_SECRET, { expiresIn: '1h' });
}

async function cleanup() {
  try {
    await sql`DELETE FROM health_meal_plan_items WHERE plan_id IN (SELECT id FROM health_meal_plans WHERE creator_id = ${cookProfileId})`;
    await sql`DELETE FROM health_plan_subscriptions WHERE creator_id = ${cookProfileId} OR user_id = ${customer}`;
    await sql`DELETE FROM health_meal_plans WHERE creator_id = ${cookProfileId}`;
    await sql`DELETE FROM health_data_consent WHERE creator_id = ${cookProfileId} OR user_id = ${customer}`;
    await sql`DELETE FROM health_subscriptions WHERE cook_id = ${cookProfileId}`;
    await sql`DELETE FROM cook_health_specialisations WHERE cook_id = ${cookProfileId}`;
    await sql`DELETE FROM menu_items WHERE cook_id = ${cookProfileId}`;
    await sql`DELETE FROM stories WHERE cook_id = ${cookProfileId}`;
    await sql`DELETE FROM customer_health_profiles WHERE customer_id IN (SELECT id FROM customer_profiles WHERE user_id = ${customer})`;
    // Hide the test kitchen from real users between runs (setup re-approves it)
    await sql`UPDATE cook_profiles SET is_health_kitchen = false, verification_status = 'pending', is_live = false WHERE id = ${cookProfileId}`;
  } catch (e) { console.error('cleanup (non-fatal):', e.message); }
}

(async () => {
  await setup();
  console.log(`Base: ${BASE}\ncustomer=${customer}\ncook=${cook} profile=${cookProfileId}\n`);

  // ── Health Kitchen flow ──────────────────────────────────────────────
  await test('GET /health/kitchens (public list)', async () => {
    const j = expect(await call('GET', '/health/kitchens', null), 200);
    return `${j.kitchens.length} kitchens`;
  });

  await test('GET /health/kitchens?specialisation=diabetes', async () => {
    const j = expect(await call('GET', '/health/kitchens?specialisation=diabetes', null), 200);
    return `${j.kitchens.length} kitchens`;
  });

  await test('PATCH /cooks/me/health-specialisations', async () => {
    const j = expect(await call('PATCH', '/cooks/me/health-specialisations', cookToken, { specialisations: ['diabetes', 'keto'] }), 200);
    return JSON.stringify(j).slice(0, 80);
  });

  await test('POST /health/kitchens/:id/subscribe (customer)', async () => {
    expect(await call('POST', `/health/kitchens/${cookProfileId}/subscribe`, customerToken, {}), 201);
  });

  await test('POST /health/plans (cook creates plan)', async () => {
    const j = expect(await call('POST', '/health/plans', cookToken, {
      title: 'E2E Diabetes Plan', description: 'harness', target_condition: 'diabetes',
      duration_weeks: 4, meals_per_day: 3, price: 5000,
    }), 201);
    ctx.planId = j.plan.id;
    return ctx.planId;
  });

  await test('GET /health/plans/mine (cook)', async () => {
    const j = expect(await call('GET', '/health/plans/mine', cookToken), 200);
    return `${j.plans.length} plans`;
  });

  await test('PATCH /health/plans/:id (publish)', async () => {
    if (!ctx.planId) return { skip: 'no plan created' };
    expect(await call('PATCH', `/health/plans/${ctx.planId}`, cookToken, { is_published: true }), 200);
  });

  await test('POST /health/plans/:id/items', async () => {
    if (!ctx.planId) return { skip: 'no plan created' };
    const j = expect(await call('POST', `/health/plans/${ctx.planId}/items`, cookToken, {
      week_number: 1, day_number: 1, meal_type: 'breakfast', title: 'E2E Oats', calories: 300,
    }), 201);
    ctx.itemId = j.item.id;
  });

  await test('PATCH /health/plans/:id/items/:itemId', async () => {
    if (!ctx.itemId) return { skip: 'no item created' };
    expect(await call('PATCH', `/health/plans/${ctx.planId}/items/${ctx.itemId}`, cookToken, { calories: 350 }), 200);
  });

  await test('GET /health/plans/:id (detail)', async () => {
    if (!ctx.planId) return { skip: 'no plan created' };
    const j = expect(await call('GET', `/health/plans/${ctx.planId}`, customerToken), 200);
    return `${j.items.length} items`;
  });

  await test('GET /health/plans (public browse)', async () => {
    const j = expect(await call('GET', '/health/plans', null), 200);
    return `${j.plans.length} plans`;
  });

  await test('POST /health/plans/:id/subscribe (customer)', async () => {
    if (!ctx.planId) return { skip: 'no plan created' };
    const j = expect(await call('POST', `/health/plans/${ctx.planId}/subscribe`, customerToken, {}), 201);
    ctx.subId = j.subscription.id;
  });

  await test('GET /health/my-plans (customer)', async () => {
    const j = expect(await call('GET', '/health/my-plans', customerToken), 200);
    return `${j.subscriptions.length} subs`;
  });

  await test('GET /health/subscribers (cook)', async () => {
    const j = expect(await call('GET', '/health/subscribers', cookToken), 200);
    return `${j.subscribers.length} subscribers`;
  });

  await test('GET /health/feeding-history/:userId (cook)', async () => {
    const j = expect(await call('GET', `/health/feeding-history/${customer}`, cookToken), 200);
    return `${j.orders.length} orders`;
  });

  await test('PATCH /health/customer/profile', async () => {
    expect(await call('PATCH', '/health/customer/profile', customerToken, {
      health_goals: ['weight_loss'], conditions: ['diabetes'],
    }), 200);
  });

  await test('GET /health/customer/profile', async () => {
    expect(await call('GET', '/health/customer/profile', customerToken), 200);
  });

  await test('GET /health/consent (customer)', async () => {
    const j = expect(await call('GET', '/health/consent', customerToken), 200);
    return `${j.consents.length} consents`;
  });

  // ── Discovery + profile surfaces ─────────────────────────────────────
  await test('GET /cooks (discovery list)', async () => {
    const j = expect(await call('GET', '/cooks?limit=5', null), 200);
    return `${j.cooks.length} cooks`;
  });

  await test('GET /cooks/:id (cook profile)', async () => {
    const j = expect(await call('GET', `/cooks/${cookProfileId}`, null), 200);
    return j.cook.display_name;
  });

  await test('GET /discover', async () => {
    const j = expect(await call('GET', '/discover', customerToken), 200);
    return Object.keys(j).join(',').slice(0, 60);
  });

  await test('GET /earnings (cook summary)', async () => {
    expect(await call('GET', '/earnings?period=week', cookToken), 200);
  });

  await test('PATCH /cooks/me (save bank account)', async () => {
    expect(await call('PATCH', '/cooks/me', cookToken, {
      bank_name: 'E2E Bank', bank_code: '058',
      bank_account_number: '0000000000', bank_account_name: 'E2E Test Cook',
    }), 200);
  });

  // ── Uploads ──────────────────────────────────────────────────────────
  await test('POST /upload (base64 1px PNG)', async () => {
    const j = expect(await call('POST', '/upload', cookToken, { image: PNG_1PX, folder: 'e2e-test' }), 200);
    ctx.uploadUrl = j.url;
    return j.url?.slice(0, 60);
  });

  // ── Updates across the app ───────────────────────────────────────────
  await test('PATCH /auth/me (update name)', async () => {
    expect(await call('PATCH', '/auth/me', customerToken, { full_name: 'E2E Test Customer' }), 200);
  });

  await test('PATCH /cooks/:id (update bio)', async () => {
    expect(await call('PATCH', `/cooks/${cookProfileId}`, cookToken, { bio: 'E2E harness bio' }), 200);
  });

  await test('PATCH /cooks/:id/live (toggle live)', async () => {
    expect(await call('PATCH', `/cooks/${cookProfileId}/live`, cookToken, { is_live: true }), 200);
    expect(await call('PATCH', `/cooks/${cookProfileId}/live`, cookToken, { is_live: false }), 200);
  });

  await test('PATCH /cooks/me/kitchen-photos', async () => {
    expect(await call('PATCH', '/cooks/me/kitchen-photos', cookToken, {
      kitchen_photos: [ctx.uploadUrl ?? 'https://res.cloudinary.com/demo/image/upload/sample.jpg'],
    }), 200);
  });

  await test('POST /menu (create item)', async () => {
    const j = expect(await call('POST', '/menu', cookToken, {
      title: 'E2E Jollof', unit_price: 2500,
      photos: ['https://res.cloudinary.com/demo/image/upload/sample.jpg'],
    }), 201);
    ctx.menuItemId = j.item.id;
  });

  await test('PATCH /menu/:id (update item)', async () => {
    if (!ctx.menuItemId) return { skip: 'no menu item' };
    expect(await call('PATCH', `/menu/${ctx.menuItemId}`, cookToken, { description: 'updated by harness' }), 200);
  });

  // ── Teardown-ish flow tests ──────────────────────────────────────────
  await test('DELETE /health/plans/:planId/items/:itemId', async () => {
    if (!ctx.itemId) return { skip: 'no item' };
    expect(await call('DELETE', `/health/plans/${ctx.planId}/items/${ctx.itemId}`, cookToken), 200);
  });

  await test('PATCH /health/my-plans/:subId/cancel', async () => {
    if (!ctx.subId) return { skip: 'no subscription' };
    expect(await call('PATCH', `/health/my-plans/${ctx.subId}/cancel`, customerToken, {}), 200);
  });

  await test('PATCH /health/consent/:creatorId/revoke', async () => {
    expect(await call('PATCH', `/health/consent/${cookProfileId}/revoke`, customerToken, {}), 200);
  });

  await cleanup();

  // ── Report ───────────────────────────────────────────────────────────
  const pad = (s, n) => String(s).padEnd(n);
  console.log('\n──────── RESULTS ────────');
  for (const r of results) console.log(`${pad(r.ok, 5)} ${pad(r.name, 48)} ${r.detail ?? ''}`);
  const fails = results.filter(r => r.ok === 'FAIL').length;
  console.log(`\n${results.length} tests, ${fails} failed`);
  process.exit(fails ? 1 : 0);
})();
