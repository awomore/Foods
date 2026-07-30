// Integration test for migration 060 — the five single-table features that
// never had schema anywhere (trending_entities, user_connections,
// story_completions, subscription_meals, rider_locations).
//
// Applies the migration, seeds a cook, three customers, two dishes and a known
// order history, then runs the REAL queries from services/trending.js,
// routes/connections.js, routes/stories.js, services/creatorScore.js,
// routes/gifting.js and routes/fleet.js against it — and asserts the numbers
// they produce, not merely that the SQL parses.
//
// EVERYTHING RUNS IN ONE TRANSACTION THAT IS ALWAYS ROLLED BACK, so it commits
// nothing and is safe to point at any database, production included. Cases that
// must fail (unique/check/FK violations) run inside savepoints so the outer
// transaction survives them.
//
// Usage: cd backend; DATABASE_URL=<url> node scripts/feature-tables-test.js
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const postgres = require('postgres');

const results = [];
const check = (name, ok, detail = '') => results.push({ name, ok: ok ? 'PASS' : 'FAIL', detail });
const skip  = (name, detail = '') => results.push({ name, ok: 'SKIP', detail });
const near = (a, b, eps = 1e-6) => a !== null && Math.abs(Number(a) - b) < eps;

// Verbatim from services/trending.js — the arithmetic under test.
const clamp = (v, max = 1) => Math.max(0, Math.min(max, v ?? 0));
function normalise(rows, field) {
  const max = Math.max(...rows.map(r => parseFloat(r[field]) || 0), 1);
  return rows.map(r => ({ ...r, [field]: (parseFloat(r[field]) || 0) / max }));
}

// Runs fn in a savepoint and expects it to be rejected by the database.
async function expectReject(tx, name, fn) {
  try {
    await tx.savepoint(sp => fn(sp));
    check(name, false, 'no error thrown — constraint missing');
  } catch (e) {
    check(name, true, e.message.split('\n')[0].slice(0, 52));
  }
}

const PHONES = ['+2349900006001', '+2349900006002', '+2349900006003', '+2349900006004', '+2349900006005'];

(async () => {
  const sql = postgres(process.env.DATABASE_URL, { ssl: 'require', max: 1, onnotice: () => {} });
  const migration = fs.readFileSync(path.join(__dirname, '..', 'migrations', '060_remaining_feature_tables.sql'), 'utf8');

  try {
    await sql.begin(async tx => {
      await tx.unsafe(migration);
      check('migration 060 applies', true);

      // ── Seed ────────────────────────────────────────────────────────────────
      const [cookUser] = await tx`INSERT INTO users (full_name, phone, role, is_active) VALUES ('FT Cook', ${PHONES[0]}, 'cook', true) RETURNING id`;
      const [c1]       = await tx`INSERT INTO users (full_name, phone, role, is_active) VALUES ('FT One', ${PHONES[1]}, 'customer', true) RETURNING id`;
      const [c2]       = await tx`INSERT INTO users (full_name, phone, role, is_active) VALUES ('FT Two', ${PHONES[2]}, 'customer', true) RETURNING id`;
      const [c3]       = await tx`INSERT INTO users (full_name, phone, role, is_active) VALUES ('FT Three', ${PHONES[3]}, 'customer', true) RETURNING id`;
      // users.role has no 'rider' value — riders are ordinary users with a rider_profile.
      const [rider]    = await tx`INSERT INTO users (full_name, phone, role, is_active) VALUES ('FT Rider', ${PHONES[4]}, 'customer', true) RETURNING id`;

      const [cook] = await tx`
        INSERT INTO cook_profiles (user_id, display_name, username, verification_status)
        VALUES (${cookUser.id}, 'FT Kitchen', 'ftkitchen', 'approved') RETURNING id`;
      const [dishA] = await tx`
        INSERT INTO menu_items (cook_id, title, mode, photos, unit_price, total_slots, slots_claimed, is_active)
        VALUES (${cook.id}, 'FT Dish A', 'meals', '{}', 5000, 10, 0, true) RETURNING id`;
      const [dishB] = await tx`
        INSERT INTO menu_items (cook_id, title, mode, photos, unit_price, total_slots, slots_claimed, is_active)
        VALUES (${cook.id}, 'FT Dish B', 'meals', '{}', 4000, 10, 0, true) RETURNING id`;

      const order = (cust, item, status, daysAgo) => tx`
        INSERT INTO orders (customer_id, cook_id, menu_item_id, order_type, status, quantity, unit_price,
                            subtotal, platform_fee, total_amount, cook_payout, delivery_address, created_at)
        VALUES (${cust}, ${cook.id}, ${item}, 'preorder', ${status}, 1, 5000, 5000, 500, 5500, 4500,
                '1 Test Road, Lagos', NOW() - ${daysAgo + ' days'}::interval)
        RETURNING id`;

      // c1 is an established customer (20 days ago), c2 and c3 are new.
      await order(c1.id, dishA.id, 'delivered', 20);
      await order(c1.id, dishA.id, 'delivered', 2);
      await order(c2.id, dishA.id, 'delivered', 2);
      await order(c3.id, dishB.id, 'delivered', 3);
      await order(c3.id, dishB.id, 'cancelled', 1);   // must not count anywhere

      // ── trending_entities ───────────────────────────────────────────────────
      // The computeDishTrending SELECT, scoped to this cook so other rows in the
      // database cannot move the normalisation maximum.
      const dishRows = await tx`
        SELECT
          mi.id AS entity_id,
          mi.title AS entity_label,
          COUNT(DISTINCT o.customer_id) FILTER (
            WHERE o.created_at >= NOW() - INTERVAL '7 days' AND o.status = 'delivered'
          )::float AS order_velocity_raw,
          COUNT(DISTINCT o.customer_id) FILTER (
            WHERE o.created_at >= NOW() - INTERVAL '7 days'
              AND o.status = 'delivered'
              AND NOT EXISTS (
                SELECT 1 FROM orders o2
                WHERE o2.customer_id = o.customer_id
                  AND o2.menu_item_id = mi.id
                  AND o2.created_at < NOW() - INTERVAL '7 days'
              )
          )::float AS new_customer_velocity_raw
        FROM menu_items mi
        JOIN orders o ON o.menu_item_id = mi.id
        WHERE mi.is_active = true AND mi.cook_id = ${cook.id}
        GROUP BY mi.id, mi.title
        HAVING COUNT(DISTINCT o.customer_id) FILTER (
          WHERE o.created_at >= NOW() - INTERVAL '7 days' AND o.status = 'delivered'
        ) > 0
        ORDER BY order_velocity_raw DESC
        LIMIT 100`;

      const rawA = dishRows.find(r => r.entity_id === dishA.id);
      const rawB = dishRows.find(r => r.entity_id === dishB.id);
      check('dish velocity: A has 2 buyers, 1 of them new',
        near(rawA?.order_velocity_raw, 2) && near(rawA?.new_customer_velocity_raw, 1),
        `orders=${rawA?.order_velocity_raw} new=${rawA?.new_customer_velocity_raw}`);
      check('dish velocity: cancelled order excluded from B',
        near(rawB?.order_velocity_raw, 1) && near(rawB?.new_customer_velocity_raw, 1),
        `orders=${rawB?.order_velocity_raw} new=${rawB?.new_customer_velocity_raw}`);

      let scored = normalise(dishRows, 'order_velocity_raw');
      scored     = normalise(scored, 'new_customer_velocity_raw');
      for (const row of scored) {
        const trending_score = clamp(row.order_velocity_raw * 0.55 + row.new_customer_velocity_raw * 0.45);
        await tx`
          INSERT INTO trending_entities
            (entity_type, entity_id, entity_label, order_velocity, new_customer_velocity, trending_score, computed_at)
          VALUES ('dish', ${row.entity_id}, ${row.entity_label}, ${row.order_velocity_raw},
                  ${row.new_customer_velocity_raw}, ${trending_score}, ${new Date().toISOString()})`;
      }

      const stored = await tx`
        SELECT entity_id, order_velocity, trending_score FROM trending_entities
        WHERE entity_type = 'dish' AND entity_id IN (${dishA.id}, ${dishB.id})`;
      const sA = stored.find(r => r.entity_id === dishA.id);
      const sB = stored.find(r => r.entity_id === dishB.id);
      // A: 1.0*0.55 + 1.0*0.45 = 1.0   B: 0.5*0.55 + 1.0*0.45 = 0.725
      check('trending_score survives numeric(6,5) round trip',
        near(sA?.trending_score, 1.0, 1e-5) && near(sB?.trending_score, 0.725, 1e-5),
        `A=${sA?.trending_score} B=${sB?.trending_score}`);
      check('order_velocity stores the normalised 0.5', near(sB?.order_velocity, 0.5, 1e-5), `${sB?.order_velocity}`);

      // computeCreatorTrending, same scoping.
      const [creatorRow] = await tx`
        SELECT cp.id AS entity_id, cp.display_name AS entity_label,
          COUNT(DISTINCT o.customer_id) FILTER (
            WHERE o.created_at >= NOW() - INTERVAL '14 days'
              AND o.status = 'delivered'
              AND NOT EXISTS (
                SELECT 1 FROM orders o2
                WHERE o2.customer_id = o.customer_id AND o2.cook_id = cp.id
                  AND o2.created_at < NOW() - INTERVAL '14 days'
              )
          )::float AS new_customer_velocity_raw
        FROM cook_profiles cp
        JOIN orders o ON o.cook_id = cp.id
        WHERE cp.verification_status = 'approved' AND cp.id = ${cook.id}
        GROUP BY cp.id, cp.display_name`;
      check('creator velocity: 2 new customers, established one excluded',
        near(creatorRow?.new_customer_velocity_raw, 2), `${creatorRow?.new_customer_velocity_raw}`);

      await tx`
        INSERT INTO trending_entities (entity_type, entity_id, entity_label, new_customer_velocity, trending_score, computed_at)
        VALUES ('creator', ${cook.id}, 'FT Kitchen', 1.0, 1.0, ${new Date().toISOString()})`;
      await tx`
        INSERT INTO trending_entities (entity_type, entity_label, trending_score, computed_at)
        VALUES ('search', 'jollof', 0.9, ${new Date().toISOString()})`;
      await tx`
        INSERT INTO trending_entities (entity_type, entity_label, trending_score, computed_at)
        VALUES ('search', 'egusi', 0.4, ${new Date().toISOString()})`;
      const [{ s: searchRows }] = await tx`SELECT COUNT(*)::int s FROM trending_entities WHERE entity_type = 'search'`;
      check('two search rows coexist with NULL entity_id', searchRows === 2, `${searchRows} rows`);

      // routes/feed.js:102
      const feedIds = await tx`SELECT entity_id FROM trending_entities WHERE entity_type = 'creator' ORDER BY trending_score DESC LIMIT 20`;
      check('feed.js trending-creator query finds the cook',
        feedIds.some(r => r.entity_id === cook.id), `${feedIds.length} rows`);

      // routes/followSuggestions.js:99,118
      const [sugg] = await tx`
        SELECT cp.id, te.trending_score
        FROM cook_profiles cp
        LEFT JOIN trending_entities te ON te.entity_id = cp.id AND te.entity_type = 'creator'
        WHERE cp.id = ${cook.id}
        ORDER BY te.trending_score DESC NULLS LAST`;
      check('followSuggestions join yields one row with a score',
        near(sugg?.trending_score, 1.0, 1e-5), `score=${sugg?.trending_score}`);

      await expectReject(tx, 'duplicate (entity_type, entity_id) rejected', sp => sp`
        INSERT INTO trending_entities (entity_type, entity_id, entity_label, trending_score)
        VALUES ('creator', ${cook.id}, 'FT Kitchen again', 0.1)`);
      await expectReject(tx, 'unknown entity_type rejected', sp => sp`
        INSERT INTO trending_entities (entity_type, entity_label, trending_score) VALUES ('podcast', 'x', 0.1)`);

      await tx`
        INSERT INTO trending_entities (entity_type, entity_label, trending_score, computed_at)
        VALUES ('search', 'stale term', 0.1, NOW() - INTERVAL '26 hours')`;
      const purged = await tx`DELETE FROM trending_entities WHERE computed_at < NOW() - INTERVAL '25 hours' RETURNING entity_label`;
      check('25-hour cleanup removes only the stale row',
        purged.length === 1 && purged[0].entity_label === 'stale term', `${purged.length} deleted`);

      // ── user_connections ────────────────────────────────────────────────────
      const [sharedOrder] = await order(c1.id, dishA.id, 'delivered', 1);
      const [conn] = await tx`
        INSERT INTO user_connections (requester_id, recipient_id, status, shared_order_id)
        VALUES (${c1.id}, ${c2.id}, 'pending', ${sharedOrder.id}) RETURNING *`;
      check('connection request inserts with defaults',
        conn.status === 'pending' && conn.created_at instanceof Date, `status=${conn.status}`);

      await expectReject(tx, 'duplicate connection request rejected', sp => sp`
        INSERT INTO user_connections (requester_id, recipient_id, status) VALUES (${c1.id}, ${c2.id}, 'pending')`);
      await expectReject(tx, 'self-connection rejected', sp => sp`
        INSERT INTO user_connections (requester_id, recipient_id, status) VALUES (${c1.id}, ${c1.id}, 'pending')`);
      await expectReject(tx, 'unknown connection status rejected', sp => sp`
        INSERT INTO user_connections (requester_id, recipient_id, status) VALUES (${c2.id}, ${c3.id}, 'ghosted')`);

      // GET /api/connections — the CASE join onto "the other user"
      const listed = await tx`
        SELECT uc.*,
               CASE WHEN uc.requester_id = ${c2.id} THEN uc.recipient_id ELSE uc.requester_id END AS other_user_id,
               u.full_name AS other_name
        FROM user_connections uc
        JOIN users u ON u.id = CASE WHEN uc.requester_id = ${c2.id} THEN uc.recipient_id ELSE uc.requester_id END
        WHERE (uc.requester_id = ${c2.id} OR uc.recipient_id = ${c2.id}) AND uc.status != 'blocked'
        ORDER BY uc.created_at DESC`;
      check('connection list resolves the other party',
        listed.length === 1 && listed[0].other_name === 'FT One', `${listed.length} rows, other=${listed[0]?.other_name}`);

      // PATCH /:id/respond — recipient only, pending only
      const wrongUser = await tx`
        UPDATE user_connections SET status = 'accepted'
        WHERE id = ${conn.id} AND recipient_id = ${c3.id} AND status = 'pending' RETURNING id`;
      check('non-recipient cannot accept', wrongUser.length === 0, `${wrongUser.length} rows`);
      const [accepted] = await tx`
        UPDATE user_connections SET status = 'accepted'
        WHERE id = ${conn.id} AND recipient_id = ${c2.id} AND status = 'pending' RETURNING *`;
      check('recipient accepts a pending request', accepted?.status === 'accepted', `status=${accepted?.status}`);
      const replay = await tx`
        UPDATE user_connections SET status = 'accepted'
        WHERE id = ${conn.id} AND recipient_id = ${c2.id} AND status = 'pending' RETURNING id`;
      check('accepting twice is a no-op', replay.length === 0, `${replay.length} rows`);

      const [status] = await tx`
        SELECT id, status, requester_id FROM user_connections
        WHERE (requester_id = ${c1.id} AND recipient_id = ${c2.id})
           OR (requester_id = ${c2.id} AND recipient_id = ${c1.id}) LIMIT 1`;
      check('status lookup matches either direction',
        status?.status === 'accepted' && status.requester_id === c1.id, `status=${status?.status}`);

      // ── story_completions ───────────────────────────────────────────────────
      const [story1] = await tx`INSERT INTO stories (cook_id, type, caption) VALUES (${cook.id}, 'cooking_now', 'FT s1') RETURNING id`;
      const [story2] = await tx`INSERT INTO stories (cook_id, type, caption) VALUES (${cook.id}, 'cooking_now', 'FT s2') RETURNING id`;
      await tx`INSERT INTO story_views (story_id, viewer_id) VALUES (${story1.id}, ${c1.id})`;
      await tx`INSERT INTO story_views (story_id, viewer_id) VALUES (${story2.id}, ${c1.id})`;

      const insertCompletion = () => tx`
        INSERT INTO story_completions (story_id, viewer_id) VALUES (${story1.id}, ${c1.id})
        ON CONFLICT (story_id, viewer_id) DO NOTHING`;
      await insertCompletion();
      await insertCompletion();
      const [{ n: compCount }] = await tx`SELECT COUNT(*)::int n FROM story_completions WHERE story_id = ${story1.id}`;
      check('story completion is idempotent', compCount === 1, `${compCount} rows`);

      // services/creatorScore.js:149-160 — 1 completion out of 2 views = 0.5
      const [rate] = await tx`
        SELECT COALESCE(COUNT(sc.story_id)::float / NULLIF(COUNT(sv.story_id), 0), 0) AS story_completion_rate
        FROM story_views sv
        JOIN stories s ON s.id = sv.story_id AND s.cook_id = ${cook.id}
        LEFT JOIN story_completions sc ON sc.story_id = sv.story_id AND sc.viewer_id = sv.viewer_id
        WHERE s.created_at >= NOW() - INTERVAL '30 days'`;
      check('story_completion_rate computes 0.5', near(rate?.story_completion_rate, 0.5, 1e-9), `${rate?.story_completion_rate}`);

      // routes/stories.js:48-51
      const [flags] = await tx`
        SELECT EXISTS(SELECT 1 FROM story_completions sc WHERE sc.story_id = ${story1.id} AND sc.viewer_id = ${c1.id}) AS done1,
               EXISTS(SELECT 1 FROM story_completions sc WHERE sc.story_id = ${story2.id} AND sc.viewer_id = ${c1.id}) AS done2`;
      check('has_completed flag distinguishes the two stories', flags.done1 === true && flags.done2 === false,
        `s1=${flags.done1} s2=${flags.done2}`);

      await tx`DELETE FROM stories WHERE id = ${story1.id}`;
      const [{ n: afterDrop }] = await tx`SELECT COUNT(*)::int n FROM story_completions WHERE story_id = ${story1.id}`;
      check('deleting a story cascades its completions', afterDrop === 0, `${afterDrop} rows`);

      // ── subscription_meals ──────────────────────────────────────────────────
      // Exactly the column list routes/gifting.js:233-243 inserts — no customer_id
      // or cook_id. Before 060 dropped their NOT NULL this failed in production.
      const [sub] = await tx`
        INSERT INTO meal_subscriptions (
          gifter_id, plan_id, sub_type, meal_slots, add_dietician,
          recipient_name, recipient_phone, recipient_address,
          preferences, total_amount, currency_code
        ) VALUES (
          ${c1.id}, 'weekly-5', 'gift', ${['breakfast', 'lunch']}, false,
          'FT Two', ${PHONES[2]}, '2 Test Road, Lagos',
          'no pepper', 45000, 'NGN'
        ) RETURNING id`;
      check('gift subscription inserts without customer_id/cook_id', !!sub?.id);
      await tx`
        INSERT INTO subscription_meals (subscription_id, delivery_date, meal_slot, meal_title)
        VALUES (${sub.id}, CURRENT_DATE + 1, 'lunch', 'FT Jollof')`;
      const [meal] = await tx`
        INSERT INTO subscription_meals (subscription_id, delivery_date, meal_slot, meal_title)
        VALUES (${sub.id}, CURRENT_DATE, 'breakfast', 'FT Pap') RETURNING *`;
      check('meal defaults to scheduled', meal.status === 'scheduled', `status=${meal.status}`);

      await expectReject(tx, 'duplicate slot on a date rejected', sp => sp`
        INSERT INTO subscription_meals (subscription_id, delivery_date, meal_slot)
        VALUES (${sub.id}, CURRENT_DATE, 'breakfast')`);
      await expectReject(tx, 'unknown meal status rejected', sp => sp`
        INSERT INTO subscription_meals (subscription_id, delivery_date, meal_slot, status)
        VALUES (${sub.id}, CURRENT_DATE, 'dinner', 'burnt')`);
      await expectReject(tx, 'unknown approver rejected', sp => sp`
        INSERT INTO subscription_meals (subscription_id, delivery_date, meal_slot, approved_by)
        VALUES (${sub.id}, CURRENT_DATE, 'dinner', 'the dog')`);

      // routes/gifting.js:304-308
      const schedule = await tx`
        SELECT * FROM subscription_meals WHERE subscription_id = ${sub.id}
        ORDER BY delivery_date ASC, meal_slot ASC`;
      check('meal schedule reads back in delivery order',
        schedule.length === 2 && schedule[0].meal_title === 'FT Pap', `${schedule.length} meals, first=${schedule[0]?.meal_title}`);

      // routes/gifting.js:331-343
      const [approved2] = await tx`
        UPDATE subscription_meals SET status = 'approved', approved_by = 'gifter', gifter_feedback = 'lovely'
        WHERE id = ${meal.id} AND subscription_id = ${sub.id} RETURNING *`;
      check('gifter approval writes status, approver and feedback',
        approved2.status === 'approved' && approved2.approved_by === 'gifter' && approved2.gifter_feedback === 'lovely',
        `${approved2.status}/${approved2.approved_by}`);
      const [rejected] = await tx`
        UPDATE subscription_meals SET status = 'rejected', rejected_by = 'gifter', rejection_reason = 'too spicy'
        WHERE id = ${meal.id} AND subscription_id = ${sub.id} RETURNING *`;
      check('gifter rejection writes reason', rejected.rejection_reason === 'too spicy', `${rejected.status}`);

      await tx`DELETE FROM meal_subscriptions WHERE id = ${sub.id}`;
      const [{ n: mealsLeft }] = await tx`SELECT COUNT(*)::int n FROM subscription_meals WHERE subscription_id = ${sub.id}`;
      check('deleting a subscription cascades its meals', mealsLeft === 0, `${mealsLeft} rows`);

      // ── rider_locations ─────────────────────────────────────────────────────
      // The fleet layer (rider_profiles) exists in production but not in the
      // development database, so the live-map join is skipped there rather than
      // failed — the upsert itself is exercised either way.
      const [{ has_riders }] = await tx`
        SELECT EXISTS(SELECT 1 FROM information_schema.tables
                      WHERE table_schema = 'public' AND table_name = 'rider_profiles') AS has_riders`;
      if (has_riders) {
        // The live map joins rider_profiles.user_id — not rider_profiles.id — to
        // rider_locations.rider_user_id, which is what fleet.js writes.
        await tx`
          INSERT INTO rider_profiles (user_id, full_name, phone, vehicle_type, status)
          VALUES (${rider.id}, 'FT Rider', ${PHONES[4]}, 'bike', 'approved')`;
      }
      const [live] = await order(c3.id, dishB.id, 'out_for_delivery', 0);

      const ping = (lat, lng, heading, speed) => tx`
        INSERT INTO rider_locations (order_id, rider_user_id, latitude, longitude, heading, speed)
        VALUES (${live.id}, ${rider.id}, ${lat}, ${lng}, ${heading}, ${speed})
        ON CONFLICT (order_id) DO UPDATE SET
          latitude = EXCLUDED.latitude, longitude = EXCLUDED.longitude,
          heading = EXCLUDED.heading, speed = EXCLUDED.speed, updated_at = NOW()`;
      await ping(6.5244, 3.3792, 90, 12.5);
      await ping(6.6000, 3.4000, 180, 22.75);

      const locs = await tx`SELECT * FROM rider_locations WHERE order_id = ${live.id}`;
      check('location upsert keeps one row per order', locs.length === 1, `${locs.length} rows`);
      check('location upsert overwrites with the newest fix',
        near(locs[0]?.latitude, 6.6) && near(locs[0]?.speed, 22.75), `${locs[0]?.latitude}/${locs[0]?.speed}`);

      await expectReject(tx, 'location for an unknown order rejected', sp => sp`
        INSERT INTO rider_locations (order_id, rider_user_id, latitude, longitude)
        VALUES ('00000000-0000-0000-0000-000000000000', ${rider.id}, 1, 1)`);

      // routes/fleet.js:876-896 — the admin live map
      if (has_riders) {
        const active = await tx`
          SELECT rl.order_id, rl.latitude, rl.longitude, rp.full_name AS rider_name,
                 rp.vehicle_type, o.delivery_address, o.status AS order_status
          FROM rider_locations rl
          JOIN orders o ON o.id = rl.order_id
          JOIN rider_profiles rp ON rp.user_id = rl.rider_user_id
          WHERE rl.updated_at >= NOW() - INTERVAL '10 minutes'
            AND o.status IN ('out_for_delivery', 'in_transit', 'ready')
          ORDER BY rl.updated_at DESC`;
        check('admin live-map query returns the rider',
          active.some(r => r.order_id === live.id && r.rider_name === 'FT Rider'), `${active.length} rows`);
      } else {
        skip('admin live-map query returns the rider', 'no rider_profiles in this database');
      }

      await tx`UPDATE rider_locations SET updated_at = NOW() - INTERVAL '30 minutes' WHERE order_id = ${live.id}`;
      const stale = await tx`
        SELECT rl.order_id FROM rider_locations rl
        JOIN orders o ON o.id = rl.order_id
        WHERE rl.updated_at >= NOW() - INTERVAL '10 minutes' AND o.id = ${live.id}`;
      check('a 30-minute-old fix drops off the live map', stale.length === 0, `${stale.length} rows`);

      throw new Error('__ROLLBACK__');
    });
  } catch (e) {
    if (e.message !== '__ROLLBACK__') {
      console.error('\ntest error:', e.message);
      results.push({ name: 'transaction completed', ok: 'FAIL', detail: e.message.split('\n')[0] });
    }
  }

  // Prove nothing was committed.
  const [{ n }] = await sql`SELECT COUNT(*)::int n FROM users WHERE phone = ANY(${PHONES}::text[])`;
  check('rolled back — no seed rows committed', n === 0, `found ${n}`);
  const [{ t }] = await sql`
    SELECT COUNT(*)::int t FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name IN ('trending_entities','user_connections','story_completions','subscription_meals','rider_locations')`;
  console.log(`\n(of the 5 tables, ${t} exist outside the transaction — ${t === 5 ? 'already migrated' : 'not deployed yet'})`);

  await sql.end();

  const pad = (s, w) => String(s).padEnd(w);
  console.log('\n──── FEATURE TABLES TEST (migration 060) ────');
  for (const r of results) console.log(`${pad(r.ok, 5)} ${pad(r.name, 52)} ${String(r.detail).slice(0, 56)}`);
  const fails    = results.filter(r => r.ok === 'FAIL').length;
  const skipped  = results.filter(r => r.ok === 'SKIP').length;
  console.log(`\n${results.length} checks, ${fails} failed${skipped ? `, ${skipped} skipped` : ''}`);
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error('fatal:', e); process.exit(1); });
