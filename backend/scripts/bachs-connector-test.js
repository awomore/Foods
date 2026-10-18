// Unit test for payments/connectors/BachsConnector.js and the orchestrator's
// per-reference routing. No network: Bachs is a stubbed fetch.
// Usage: cd backend; node scripts/bachs-connector-test.js
const crypto = require('crypto');
const { BachsConnector } = require('../payments/connectors/BachsConnector');
const { PaymentOrchestrator } = require('../payments/orchestrator');
const { FlutterwaveConnector } = require('../payments/connectors/FlutterwaveConnector');

const results = [];
const check = (name, ok, detail = '') => results.push({ name, ok: ok ? 'PASS' : 'FAIL', detail });

function stubFetch(responses) {
  const calls = [];
  const fn = async (url, init) => {
    calls.push({ url, init, body: init.body ? JSON.parse(init.body) : null });
    const r = responses.shift() ?? { status: 500, json: { detail: 'no stub' } };
    return { ok: r.status < 300, status: r.status, text: async () => JSON.stringify(r.json) };
  };
  fn.calls = calls;
  return fn;
}

(async () => {
  const SECRET = 'whsec_test';
  const sign = (t, body, secret = SECRET) =>
    crypto.createHmac('sha256', secret).update(`${t}.${body}`).digest('hex');
  const now = Date.now();
  const t = Math.floor(now / 1000);
  const raw = JSON.stringify({ id: 'evt_1', type: 'collection.succeeded', data: { reference: 'FBM-1', checkout_id: 'chk_1', charge_id: 'ch_1', amount: '1500.00', currency: 'NGN' } });
  const bx = new BachsConnector({ secret: 'sk_sandbox_x', webhookSecret: SECRET, appBaseUrl: 'https://api.example.com' });
  const v = (h, body = raw, opts = {}) => bx.verifyWebhookSignature(h, Buffer.from(body), { now, ...opts });

  // ── webhook signatures ───────────────────────────────────────────────────
  check('sig: valid V2 header accepted', v({ 'x-bachs-signature-v2': `t=${t},v1=${sign(t, raw)}` }) === true);
  check('sig: rotation, any v1 may match', v({ 'x-bachs-signature-v2': `t=${t},v1=deadbeef,v1=${sign(t, raw)}` }) === true);
  check('sig: legacy headers accepted', v({ 'x-bachs-timestamp': String(t), 'x-bachs-signature': sign(t, raw) }) === true);
  check('sig: wrong secret refused', v({ 'x-bachs-signature-v2': `t=${t},v1=${sign(t, raw, 'other')}` }) === false);
  check('sig: tampered body refused', v({ 'x-bachs-signature-v2': `t=${t},v1=${sign(t, raw)}` }, raw.replace('1500', '9500')) === false);
  check('sig: stale (10 min old) refused', v({ 'x-bachs-signature-v2': `t=${t - 600},v1=${sign(t - 600, raw)}` }) === false);
  check('sig: missing header refused', v({}) === false);
  check('sig: parsed object instead of raw bytes refused',
    bx.verifyWebhookSignature({ 'x-bachs-signature-v2': `t=${t},v1=${sign(t, raw)}` }, JSON.parse(raw), { now }) === false);
  check('sig: no secret gives null (prod fail-closed)', new BachsConnector({ secret: 'sk_sandbox_x' }).verifyWebhookSignature({}, raw) === null);

  // ── parseWebhook ─────────────────────────────────────────────────────────
  const ev = bx.parseWebhook({}, JSON.parse(raw));
  check('parse: collection.succeeded is charge.succeeded', ev.type === 'charge.succeeded' && ev.reference === 'FBM-1' && ev.dedupeKey === 'evt_1');
  check('parse: checkout.completed is charge.succeeded', bx.parseWebhook({}, { id: 'e2', type: 'checkout.completed', data: { reference: 'R' } }).type === 'charge.succeeded');
  check('parse: collection.failed is charge.failed', bx.parseWebhook({}, { id: 'e3', type: 'collection.failed', data: {} }).type === 'charge.failed');
  check('parse: refund.paid is unknown', bx.parseWebhook({}, { id: 'e4', type: 'refund.paid', data: {} }).type === 'unknown');

  // ── createCharge ─────────────────────────────────────────────────────────
  const f1 = stubFetch([{ status: 201, json: { checkout_id: 'chk_9', checkout_url: 'https://checkout.bachs.io/c/x', status: 'open' } }]);
  const b1 = new BachsConnector({ secret: 'sk_sandbox_x', appBaseUrl: 'https://api.example.com/', fetchImpl: f1 });
  const cr = await b1.createCharge({ amount: 1500.5, currency: 'ngn', reference: 'FBM-9', customer: { email: 'a@b.co', name: 'Ada', phone: '2348012345678' }, meta: { user_id: 'u1', items: [1, 2] } });
  const req = f1.calls[0];
  check('create: sandbox base for sk_sandbox_ key', req.url === 'https://sandbox-api.bachs.io/v1/checkout-sessions');
  check('create: decimal string amount, upper-case currency', req.body.pricing.amount === '1500.50' && req.body.pricing.currency === 'NGN', JSON.stringify(req.body.pricing));
  check('create: our reference sent + idempotency key', req.body.reference === 'FBM-9' && req.init.headers['Idempotency-Key'] === 'FBM-9');
  check('create: returns to public https return page', req.body.success_url === 'https://api.example.com/api/payments/return?ref=FBM-9&provider=bachs', req.body.success_url);
  check('create: cancel url marks cancelled', req.body.cancel_url.endsWith('&status=cancelled'));
  check('create: metadata values are strings, user_id kept', req.body.metadata.user_id === 'u1' && req.body.metadata.items === '[1,2]');
  check('create: phone sent in + format', req.body.customer.phone_number === '+2348012345678');
  check('create: result carries checkout id + url', cr.providerCheckoutId === 'chk_9' && cr.redirectLink === 'https://checkout.bachs.io/c/x');
  check('create: live base for sk_live_ key', new BachsConnector({ secret: 'sk_live_x' })._base === 'https://api.bachs.io');
  const f2 = stubFetch([{ status: 201, json: { checkout_id: 'c', checkout_url: 'u' } }]);
  await new BachsConnector({ secret: 's', appBaseUrl: 'https://x.io', fetchImpl: f2 }).createCharge({ amount: 10, currency: 'NGN', reference: 'R', customer: { email: 'u1@foodsbyme.app' } });
  check('create: placeholder email not sent as customer', f2.calls[0].body.customer === undefined);
  let httpErr = null;
  try { await new BachsConnector({ secret: 's', appBaseUrl: 'http://localhost' }).createCharge({ amount: 1, currency: 'NGN', reference: 'R' }); } catch (e) { httpErr = e; }
  check('create: refuses a non-https return URL', httpErr?.code === 'CONNECTOR_CHARGE_FAILED');
  let apiErr = null;
  try { await new BachsConnector({ secret: 's', appBaseUrl: 'https://x.io', fetchImpl: stubFetch([{ status: 400, json: { detail: 'bad', error_code: 'VALIDATION_ERROR' } }]) }).createCharge({ amount: 1, currency: 'NGN', reference: 'R' }); } catch (e) { apiErr = e; }
  check('create: API error surfaces as CONNECTOR_CHARGE_FAILED', apiErr?.code === 'CONNECTOR_CHARGE_FAILED' && apiErr?.status === 400);

  // ── verifyCharge ─────────────────────────────────────────────────────────
  const session = (charge, status = 'completed') => ({ status: 200, json: { checkout_id: 'chk_9', status, reference: 'FBM-9', amount: '1500.50', currency: 'NGN', metadata: { user_id: 'u1' }, charge } });
  const f3 = stubFetch([session({ payment_id: 'pay_1', status: 'succeeded', amount: '1500.50', amount_paid: '1500.50', currency: 'NGN', payment_method: 'card' })]);
  const st = await new BachsConnector({ secret: 's', fetchImpl: f3 }).verifyCharge({ reference: 'FBM-9', providerCheckoutId: 'chk_9' });
  check('verify: GETs the recorded checkout', f3.calls[0].url.endsWith('/v1/checkout-sessions/chk_9'));
  check('verify: succeeded charge is successful, with amount/currency/payer',
    st.successful && st.amount === 1500.5 && st.currency === 'NGN' && st.meta.user_id === 'u1' && st.providerTxId === 'pay_1');
  const st2 = await new BachsConnector({ secret: 's', fetchImpl: stubFetch([session(null, 'open')]) }).verifyCharge({ providerCheckoutId: 'chk_9' });
  check('verify: open session, no charge, not successful', st2.successful === false);
  const st3 = await new BachsConnector({ secret: 's', fetchImpl: stubFetch([session({ status: 'failed', amount: '1500.50', currency: 'NGN' })]) }).verifyCharge({ providerCheckoutId: 'chk_9' });
  check('verify: failed charge, not successful', st3.successful === false);
  const st4 = await new BachsConnector({ secret: 's', fetchImpl: stubFetch([session({ status: 'underpaid', amount: '1500.50', amount_paid: '900.00', currency: 'NGN' })]) }).verifyCharge({ providerCheckoutId: 'chk_9' });
  check('verify: underpaid, not successful', st4.successful === false);
  check('verify: no checkout recorded, not successful, no call',
    (await new BachsConnector({ secret: 's', fetchImpl: stubFetch([]) }).verifyCharge({ reference: 'X' })).successful === false);

  // ── refund ───────────────────────────────────────────────────────────────
  const f5 = stubFetch([{ status: 201, json: { refund_id: 'ref_1', status: 'processing' } }]);
  const rf = await new BachsConnector({ secret: 's', fetchImpl: f5 }).refund({ providerTxId: 'pay_1', reference: 'FBM-9' }, { amount: 500, currency: 'NGN' });
  check('refund: partial amount as decimal string', f5.calls[0].body.amount === '500.00' && f5.calls[0].body.charge_id === 'pay_1');
  check('refund: processing counts as accepted', rf.accepted === true && rf.providerTransferId === 'ref_1');
  const f6 = stubFetch([{ status: 201, json: { refund_id: 'ref_2', status: 'processing' } }]);
  await new BachsConnector({ secret: 's', fetchImpl: f6 }).refund({ providerTxId: 'pay_1', reference: 'FBM-9' }, { amount: 500 });
  check('refund: no currency means full refund (no amount sent)', f6.calls[0].body.amount === undefined);

  // ── orchestrator routing ─────────────────────────────────────────────────
  const rows = new Map();
  const registry = {
    record: async r => rows.set(r.reference, r),
    lookup: async ref => rows.get(ref) ? { connector: rows.get(ref).connector, providerCheckoutId: rows.get(ref).providerCheckoutId } : null,
  };
  const fw = new FlutterwaveConnector({ secret: 'FLWSECK-x' });
  fw.verifyCharge = async () => ({ successful: true, via: 'flutterwave' });
  const bx2 = new BachsConnector({ secret: 's', appBaseUrl: 'https://x.io' });
  bx2.createCharge = async i => ({ reference: i.reference, redirectLink: 'https://checkout', providerCheckoutId: 'chk_77' });
  let seen = null;
  bx2.verifyCharge = async ref => { seen = ref; return { successful: true, via: 'bachs' }; };
  let pref;
  const o = new PaymentOrchestrator([fw, bx2], { registry, preferred: () => pref });
  check('route: PAYMENT_RAIL unset, Flutterwave takes new charges', o.selectForCharge({ currency: 'NGN' }).id === 'flutterwave');
  pref = 'bachs';
  check('route: PAYMENT_RAIL=bachs, Bachs takes new charges', o.selectForCharge({ currency: 'NGN' }).id === 'bachs');
  const made = await o.createCharge({ amount: 10, currency: 'NGN', reference: 'FBM-77', meta: { user_id: 'u' } });
  check('route: charge recorded with its rail + checkout id',
    rows.get('FBM-77')?.connector === 'bachs' && rows.get('FBM-77')?.providerCheckoutId === 'chk_77' && made.connector === 'bachs');
  pref = undefined;
  const vb = await o.verifyCharge({ reference: 'FBM-77' });
  check('route: verify goes back to Bachs even after the switch is off', vb.via === 'bachs' && seen?.providerCheckoutId === 'chk_77');
  const vf = await o.verifyCharge({ reference: 'FBM-OLD' });
  check('route: unrecorded (legacy) reference goes to Flutterwave', vf.via === 'flutterwave');
  const unconf = new PaymentOrchestrator([fw, new BachsConnector({})], { registry, preferred: () => 'bachs' });
  check('route: preferred but unconfigured Bachs falls back', unconf.selectForCharge({ currency: 'NGN' }).id === 'flutterwave');
  const webhookBody = JSON.parse(raw);
  const signed = new PaymentOrchestrator([fw, bx], { registry }).ingestWebhook('bachs',
    { 'x-bachs-signature-v2': `t=${t},v1=${sign(t, raw)}` }, webhookBody, { rawBody: Buffer.from(raw) });
  check('route: ingestWebhook verifies raw bytes, parses JSON', signed.ok === true && signed.event.reference === 'FBM-1');

  console.log('\n──── BACHS CONNECTOR TEST ────');
  for (const r of results) console.log(`${r.ok.padEnd(5)} ${r.name}${r.ok === 'FAIL' && r.detail ? ' — ' + r.detail : ''}`);
  const fails = results.filter(r => r.ok === 'FAIL').length;
  console.log(`\n${results.length} checks, ${fails} failed`);
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error('test error:', e); process.exit(1); });
