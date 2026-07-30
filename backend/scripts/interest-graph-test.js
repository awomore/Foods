// Integration test for migration 061 — the interest graph.
//
// The point of this test is the arithmetic, not the DDL. Two things here have
// bitten this codebase before and are asserted directly:
//
//   1. _updateCuisineAffinity does a read-modify-write on a jsonb column. That
//      is exactly the shape the double-encoding bug broke silently, so the test
//      asserts an affinity ACCUMULATES across two calls (0 → 0.15 → 0.277),
//      not merely that one write lands.
//   2. price_band_min/max start NULL and are widened with LEAST/GREATEST.
//      PostgreSQL ignores NULL inputs to those functions, so the first order
//      defines the band — this proves it, because seeding a non-null default
//      "to be safe" would pin the minimum at 0 forever.
//
// EVERYTHING RUNS IN ONE TRANSACTION THAT IS ALWAYS ROLLED BACK, so it commits
// nothing and is safe to point at any database, production included.
//
// Usage: cd backend; DATABASE_URL=<url> node scripts/interest-graph-test.js
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const postgres = require('postgres');

const results = [];
const check = (name, ok, detail = '') => results.push({ name, ok: ok ? 'PASS' : 'FAIL', detail });
const near = (a, b, eps = 1e-9) => a !== null && a !== undefined && Math.abs(Number(a) - b) < eps;

// Verbatim from services/interestGraph.js — the arithmetic under test.
const EMA_ALPHA = 0.15;
const blendAffinity = (old, signal) =>
  Math.max(0, Math.min(1, old * (1 - EMA_ALPHA) + signal * EMA_ALPHA));

const PHONES = ['+2349900007001', '+2349900007002', '+2349900007003'];

(async () => {
  const sql = postgres(process.env.DATABASE_URL, { ssl: 'require', max: 1, onnotice: () => {} });
  const migration = fs.readFileSync(path.join(__dirname, '..', 'migrations', '061_interest_graph.sql'), 'utf8');

  try {
    await sql.begin(async tx => {
      await tx.unsafe(migration);
      check('migration 061 applies', true);

      const [cookUser] = await tx`INSERT INTO users (full_name, phone, role, is_active) VALUES ('IG Cook', ${PHONES[0]}, 'cook', true) RETURNING id`;
      const [user]     = await tx`INSERT INTO users (full_name, phone, role, is_active) VALUES ('IG User', ${PHONES[1]}, 'customer', true) RETURNING id`;
      const [spare]    = await tx`INSERT INTO users (full_name, phone, role, is_active) VALUES ('IG Spare', ${PHONES[2]}, 'customer', true) RETURNING id`;
      const [cook] = await tx`
        INSERT INTO cook_profiles (user_id, display_name, username, verification_status)
        VALUES (${cookUser.id}, 'IG Kitchen', 'igkitchen', 'approved') RETURNING id`;
      await tx`
        INSERT INTO menu_items (cook_id, title, mode, photos, cuisine_type, unit_price, total_slots, slots_claimed, is_active)
        VALUES (${cook.id}, 'IG Jollof', 'meals', '{}', 'nigerian', 5000, 10, 0, true)`;
      await tx`
        INSERT INTO menu_items (cook_id, title, mode, photos, cuisine_type, unit_price, total_slots, slots_claimed, is_active)
        VALUES (${cook.id}, 'IG Egusi', 'meals', '{}', 'nigerian', 4000, 10, 0, true)`;

      // ── saveOnboardingPreferences (interestGraph.js:138-163) ────────────────
      const savePrefs = async (cuisines) => {
        for (const cuisine of cuisines) {
          await tx`
            INSERT INTO user_cuisine_preferences (user_id, cuisine, source)
            VALUES (${user.id}, ${cuisine.toLowerCase()}, 'onboarding')
            ON CONFLICT (user_id, cuisine) DO NOTHING`;
        }
        const initial = {};
        for (const c of cuisines) initial[c.toLowerCase()] = 0.7;
        await tx`
          INSERT INTO customer_interest_graphs (user_id, cuisine_affinities)
          VALUES (${user.id}, ${tx.json(initial)}::jsonb)
          ON CONFLICT (user_id) DO UPDATE
            SET cuisine_affinities = ${tx.json(initial)}::jsonb, updated_at = NOW()`;
      };
      await savePrefs(['Nigerian', 'Ghanaian']);
      await savePrefs(['Nigerian', 'Ghanaian']);   // re-running onboarding must be safe

      const prefs = await tx`SELECT cuisine, source FROM user_cuisine_preferences WHERE user_id = ${user.id} ORDER BY cuisine`;
      check('onboarding preferences are stored once, lower-cased',
        prefs.length === 2 && prefs[0].cuisine === 'ghanaian' && prefs[0].source === 'onboarding',
        `${prefs.length} rows: ${prefs.map(p => p.cuisine).join(',')}`);

      const [g0] = await tx`SELECT * FROM customer_interest_graphs WHERE user_id = ${user.id}`;
      check('graph bootstraps from onboarding at 0.7',
        near(g0.cuisine_affinities.nigerian, 0.7) && near(g0.cuisine_affinities.ghanaian, 0.7),
        JSON.stringify(g0.cuisine_affinities));
      check('price band starts NULL, not zero',
        g0.price_band_min === null && g0.price_band_max === null,
        `${g0.price_band_min}/${g0.price_band_max}`);

      const [{ n: graphCount }] = await tx`SELECT COUNT(*)::int n FROM customer_interest_graphs WHERE user_id = ${user.id}`;
      check('ON CONFLICT (user_id) keeps exactly one graph', graphCount === 1, `${graphCount} rows`);

      // ── The read-modify-write, twice (interestGraph.js:37-51) ───────────────
      // This is the trap: if the jsonb round trip were broken, each call would
      // read {} back and write the same first-step value forever.
      const updateAffinity = async (cuisine, strength) => {
        const [graph] = await tx`SELECT * FROM customer_interest_graphs WHERE user_id = ${user.id}`;
        const affinities = graph.cuisine_affinities ?? {};
        const old = affinities[cuisine] ?? 0;
        affinities[cuisine] = Math.round(blendAffinity(old, strength) * 1000) / 1000;
        await tx`
          UPDATE customer_interest_graphs
          SET cuisine_affinities = ${tx.json(affinities)}::jsonb, updated_at = NOW()
          WHERE user_id = ${user.id}`;
        return affinities[cuisine];
      };

      const step1 = await updateAffinity('thai', 1.0);          // 0    → 0.15
      const [gA] = await tx`SELECT cuisine_affinities FROM customer_interest_graphs WHERE user_id = ${user.id}`;
      const step2 = await updateAffinity('thai', 1.0);          // 0.15 → 0.277
      const [gB] = await tx`SELECT cuisine_affinities FROM customer_interest_graphs WHERE user_id = ${user.id}`;

      check('first order signal moves a cold cuisine to 0.15',
        near(step1, 0.15) && near(gA.cuisine_affinities.thai, 0.15), `${gA.cuisine_affinities.thai}`);
      // 0.15*0.85 + 0.15 = 0.2775, and the service rounds to 3dp — but
      // 0.2775 * 1000 is 277.49999999999994 in binary floating point, so
      // Math.round takes it DOWN to 0.277. Asserting 0.278 would be asserting
      // arithmetic the service does not do.
      check('AFFINITY ACCUMULATES across two calls (0.15 → 0.277)',
        near(step2, 0.277) && near(gB.cuisine_affinities.thai, 0.277) && step2 > step1,
        `${gA.cuisine_affinities.thai} → ${gB.cuisine_affinities.thai}`);
      check('the untouched onboarding cuisines survive the rewrite',
        near(gB.cuisine_affinities.nigerian, 0.7) && near(gB.cuisine_affinities.ghanaian, 0.7),
        JSON.stringify(gB.cuisine_affinities));

      // A skip on a nearly-cold cuisine must clamp at 0, not go negative.
      await updateAffinity('sushi', 0.0);
      await tx`
        UPDATE customer_interest_graphs
        SET cuisine_affinities = jsonb_set(cuisine_affinities, '{sushi}', '0.01')
        WHERE user_id = ${user.id}`;
      const afterSkip = await updateAffinity('sushi', -0.1);    // 0.0085 - 0.015 < 0
      check('a skip clamps at zero instead of going negative', near(afterSkip, 0), `${afterSkip}`);

      // ── price band: LEAST/GREATEST from NULL (interestGraph.js:62-70) ───────
      const widen = (price) => tx`
        UPDATE customer_interest_graphs
        SET price_band_min = LEAST(price_band_min, ${price} * 0.7),
            price_band_max = GREATEST(price_band_max, ${price} * 1.5),
            updated_at = NOW()
        WHERE user_id = ${user.id}`;
      await widen(5000);
      const [p1] = await tx`SELECT price_band_min, price_band_max FROM customer_interest_graphs WHERE user_id = ${user.id}`;
      check('first order defines the band from NULL (LEAST ignores NULL)',
        near(p1.price_band_min, 3500) && near(p1.price_band_max, 7500),
        `${p1.price_band_min}/${p1.price_band_max}`);

      await widen(2000);
      const [p2] = await tx`SELECT price_band_min, price_band_max FROM customer_interest_graphs WHERE user_id = ${user.id}`;
      check('a cheaper order lowers the floor and leaves the ceiling',
        near(p2.price_band_min, 1400) && near(p2.price_band_max, 7500),
        `${p2.price_band_min}/${p2.price_band_max}`);

      // ── cook cuisine resolution (the new _cookCuisine helper) ───────────────
      const cookCuisine = async (cookId) => {
        const rows = await tx`
          SELECT COALESCE(
            (SELECT cp.cuisine_types[1] FROM cook_profiles cp WHERE cp.id = ${cookId}),
            (SELECT mi.cuisine_type FROM menu_items mi
              WHERE mi.cook_id = ${cookId} AND mi.cuisine_type IS NOT NULL
              GROUP BY mi.cuisine_type ORDER BY COUNT(*) DESC, mi.cuisine_type ASC LIMIT 1)
          ) AS cuisine`;
        return rows[0]?.cuisine?.toLowerCase();
      };
      check('cook cuisine falls back to the menu when cuisine_types is empty',
        (await cookCuisine(cook.id)) === 'nigerian', `${await cookCuisine(cook.id)}`);

      await tx`UPDATE cook_profiles SET cuisine_types = ${['Thai', 'Lao']} WHERE id = ${cook.id}`;
      check('a declared cuisine_types wins over the menu fallback',
        (await cookCuisine(cook.id)) === 'thai', `${await cookCuisine(cook.id)}`);

      // routes/followSuggestions.js:72 — the operator that made it 500
      const matched = await tx`
        SELECT cp.id FROM cook_profiles cp
        WHERE cp.id = ${cook.id} AND cp.cuisine_types && ${['thai', 'nigerian']}::text[]`;
      check('followSuggestions cuisine overlap filter runs', matched.length === 0,
        'case-sensitive: declared Thai does not match lower-case thai');
      const matchedExact = await tx`
        SELECT cp.id FROM cook_profiles cp
        WHERE cp.id = ${cook.id} AND cp.cuisine_types && ${['Thai']}::text[]`;
      check('overlap matches when the case agrees', matchedExact.length === 1, `${matchedExact.length} rows`);

      const [defaulted] = await tx`SELECT cuisine_types FROM cook_profiles WHERE user_id = ${cookUser.id}`;
      check('cuisine_types is never NULL', Array.isArray(defaulted.cuisine_types), `${defaulted.cuisine_types}`);

      // ── user_interaction_signals (signals.js:37-93) ─────────────────────────
      const emit = (entityType, entityId, signalType, strength, decayDays) => tx`
        INSERT INTO user_interaction_signals
          (user_id, entity_type, entity_id, signal_type, signal_strength, expires_at)
        VALUES (${user.id}, ${entityType}, ${entityId}, ${signalType}, ${strength},
                ${new Date(Date.now() + decayDays * 86400000).toISOString()})`;
      await emit('cook', cook.id, 'profile_view', 0.3, 7);
      await emit('cook', cook.id, 'card_skip', -0.1, 7);
      await emit('jollof rice', null, 'search', 0.25, 7);        // search: no entity, query in entity_type
      await emit('cook', cook.id, 'order', 1.0, -1);             // already expired

      const [neg] = await tx`
        SELECT signal_strength FROM user_interaction_signals
        WHERE user_id = ${user.id} AND signal_type = 'card_skip'`;
      check('negative signal strength is stored signed', near(neg.signal_strength, -0.1), `${neg.signal_strength}`);

      const [search] = await tx`
        SELECT entity_type, entity_id FROM user_interaction_signals
        WHERE user_id = ${user.id} AND signal_type = 'search'`;
      check('a search signal keeps the query and a NULL entity',
        search.entity_type === 'jollof rice' && search.entity_id === null, `${search.entity_type}/${search.entity_id}`);

      const purged = await tx`DELETE FROM user_interaction_signals WHERE expires_at < NOW() RETURNING signal_type`;
      check('cleanup removes only the expired signal',
        purged.length === 1 && purged[0].signal_type === 'order', `${purged.length} deleted`);
      const [{ n: left }] = await tx`SELECT COUNT(*)::int n FROM user_interaction_signals WHERE user_id = ${user.id}`;
      check('the live signals are untouched', left === 3, `${left} rows`);

      // ── cascade ─────────────────────────────────────────────────────────────
      await tx`INSERT INTO customer_interest_graphs (user_id) VALUES (${spare.id})`;
      await tx`INSERT INTO user_cuisine_preferences (user_id, cuisine) VALUES (${spare.id}, 'thai')`;
      await tx`INSERT INTO user_interaction_signals (user_id, entity_type, signal_type, expires_at)
               VALUES (${spare.id}, 'cook', 'profile_view', NOW() + INTERVAL '7 days')`;
      await tx`DELETE FROM users WHERE id = ${spare.id}`;
      const [{ n: orphans }] = await tx`
        SELECT (SELECT COUNT(*) FROM customer_interest_graphs WHERE user_id = ${spare.id})
             + (SELECT COUNT(*) FROM user_cuisine_preferences  WHERE user_id = ${spare.id})
             + (SELECT COUNT(*) FROM user_interaction_signals  WHERE user_id = ${spare.id}) AS n`;
      check('deleting a user cascades all three tables', Number(orphans) === 0, `${orphans} rows left`);

      const [defaults] = await tx`SELECT cuisine_affinities FROM customer_interest_graphs WHERE user_id = ${user.id}`;
      check('cuisine_affinities is a jsonb object, not a string',
        typeof defaults.cuisine_affinities === 'object', typeof defaults.cuisine_affinities);

      throw new Error('__ROLLBACK__');
    });
  } catch (e) {
    if (e.message !== '__ROLLBACK__') {
      console.error('\ntest error:', e.message);
      results.push({ name: 'transaction completed', ok: 'FAIL', detail: e.message.split('\n')[0] });
    }
  }

  const [{ n }] = await sql`SELECT COUNT(*)::int n FROM users WHERE phone = ANY(${PHONES}::text[])`;
  check('rolled back — no seed rows committed', n === 0, `found ${n}`);

  await sql.end();

  const pad = (s, w) => String(s).padEnd(w);
  console.log('\n──── INTEREST GRAPH TEST (migration 061) ────');
  for (const r of results) console.log(`${pad(r.ok, 5)} ${pad(r.name, 54)} ${String(r.detail).slice(0, 54)}`);
  const fails = results.filter(r => r.ok === 'FAIL').length;
  console.log(`\n${results.length} checks, ${fails} failed`);
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error('fatal:', e); process.exit(1); });
