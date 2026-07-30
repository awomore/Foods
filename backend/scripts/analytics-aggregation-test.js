// Integration test for migration 059 — the creator analytics aggregation layer.
//
// Applies the migration, seeds one cook with a known-by-hand set of orders,
// events and engagements, runs all six aggregation jobs, and asserts the numbers
// they produce. Then runs the actual SELECTs from routes/analytics.js to prove
// the six dashboard endpoints can execute against the resulting schema.
//
// EVERYTHING RUNS IN ONE TRANSACTION THAT IS ALWAYS ROLLED BACK, so it commits
// nothing and is safe to point at any database — including production, which is
// the only one that currently has the source tables (analytics_events,
// post_shares, post_bookmarks, diary_comments). That is why this script has no
// assert-not-production guard: it cannot write.
//
// Usage: cd backend; DATABASE_URL=<url> node scripts/analytics-aggregation-test.js
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const postgres = require('postgres');

const results = [];
const check = (name, ok, detail = '') => results.push({ name, ok: ok ? 'PASS' : 'FAIL', detail });
const num = v => (v === null || v === undefined ? null : Number(v));

(async () => {
  const sql = postgres(process.env.DATABASE_URL, { ssl: 'require', max: 1, onnotice: () => {} });
  const migration = fs.readFileSync(path.join(__dirname, '..', 'migrations', '059_analytics_aggregation.sql'), 'utf8');

  try {
    await sql.begin(async tx => {
      await tx.unsafe(migration);
      check('migration 059 applies', true);

      // ── Seed: one cook, one customer, known engagement ────────────────────
      const [cookUser]  = await tx`INSERT INTO users (full_name, phone, role, is_active) VALUES ('AT Cook', '+2349900009901', 'cook', true) RETURNING id`;
      const [custUser]  = await tx`INSERT INTO users (full_name, phone, role, is_active) VALUES ('AT Customer', '+2349900009902', 'customer', true) RETURNING id`;
      const [cook]      = await tx`INSERT INTO cook_profiles (user_id, display_name, username) VALUES (${cookUser.id}, 'AT Kitchen', 'atkitchen') RETURNING id`;
      const [cust2]     = await tx`INSERT INTO users (full_name, phone, role, is_active) VALUES ('AT Customer2', '+2349900009903', 'customer', true) RETURNING id`;
      await tx`INSERT INTO customer_profiles (user_id, dietary_type) VALUES (${custUser.id}, 'vegetarian')`;
      await tx`INSERT INTO customer_profiles (user_id, dietary_type) VALUES (${cust2.id}, NULL)`;

      const [item] = await tx`
        INSERT INTO menu_items (cook_id, title, unit_price, total_slots, slots_claimed, is_active)
        VALUES (${cook.id}, 'AT Jollof', 5000, 10, 4, true) RETURNING id`;
      const [post] = await tx`
        INSERT INTO cook_diary_posts (cook_id, title, body, post_type, status)
        VALUES (${cook.id}, 'AT Post', 'body', 'dish_reveal', 'published') RETURNING id`;

      // Orders: customer 1 orders twice (one attributed to the post), customer 2
      // once, plus one cancelled order that must not count toward revenue.
      await tx`INSERT INTO orders (customer_id, cook_id, menu_item_id, status, quantity, unit_price, subtotal, total_amount, cook_payout, source_post_id, created_at, delivered_at)
               VALUES (${custUser.id}, ${cook.id}, ${item.id}, 'delivered', 1, 5000, 5000, 5500, 4500, ${post.id}, CURRENT_DATE, CURRENT_DATE)`;
      await tx`INSERT INTO orders (customer_id, cook_id, menu_item_id, status, quantity, unit_price, subtotal, total_amount, cook_payout, created_at)
               VALUES (${custUser.id}, ${cook.id}, ${item.id}, 'delivered', 1, 5000, 5000, 5500, 4500, CURRENT_DATE)`;
      await tx`INSERT INTO orders (customer_id, cook_id, menu_item_id, status, quantity, unit_price, subtotal, total_amount, cook_payout, created_at)
               VALUES (${cust2.id}, ${cook.id}, ${item.id}, 'delivered', 1, 5000, 5000, 3000, 2500, CURRENT_DATE)`;
      await tx`INSERT INTO orders (customer_id, cook_id, menu_item_id, status, quantity, unit_price, subtotal, total_amount, cook_payout, created_at)
               VALUES (${cust2.id}, ${cook.id}, ${item.id}, 'cancelled', 1, 5000, 5000, 9999, 9999, CURRENT_DATE)`;

      await tx`INSERT INTO follows (customer_id, cook_id, created_at) VALUES (${custUser.id}, ${cook.id}, CURRENT_DATE)`;
      await tx`INSERT INTO likes (user_id, target_type, target_id) VALUES (${custUser.id}, 'diary_post', ${post.id})`;
      await tx`INSERT INTO likes (user_id, target_type, target_id) VALUES (${custUser.id}, 'menu_item', ${item.id})`;
      await tx`INSERT INTO post_shares (user_id, post_id) VALUES (${custUser.id}, ${post.id})`;
      await tx`INSERT INTO post_bookmarks (user_id, post_id) VALUES (${custUser.id}, ${post.id})`;
      await tx`INSERT INTO diary_comments (post_id, user_id, body) VALUES (${post.id}, ${custUser.id}, 'nice')`;
      await tx`INSERT INTO diary_comments (post_id, user_id, body, deleted_at) VALUES (${post.id}, ${custUser.id}, 'deleted one', now())`;
      await tx`INSERT INTO cravings (user_id, menu_item_id, cook_id, dish_title) VALUES (${custUser.id}, ${item.id}, ${cook.id}, 'AT Jollof')`;

      // Events: 3 post views from 2 distinct sessions, 2 dish views, 1 cart add,
      // 1 profile view, 1 unfollow, 1 like, 1 CTA tap.
      const ev = (name, extra = {}) => tx`
        INSERT INTO analytics_events (event_name, user_id, session_id, cook_id, item_id, post_id, created_at)
        VALUES (${name}, ${extra.user ?? custUser.id}, ${extra.session ?? 's1'}, ${cook.id},
                ${extra.item ?? null}, ${extra.post ?? null}, CURRENT_DATE)`;
      await ev('post_viewed', { post: post.id, session: 's1' });
      await ev('post_viewed', { post: post.id, session: 's1' });
      await ev('post_viewed', { post: post.id, session: 's2', user: cust2.id });
      await ev('dish_viewed', { item: item.id });
      await ev('dish_viewed', { item: item.id, session: 's2', user: cust2.id });
      await ev('cart_item_added', { item: item.id });
      await ev('cook_profile_viewed');
      await ev('cook_unfollowed');
      await ev('post_liked', { post: post.id });
      await ev('post_order_cta_tapped', { post: post.id });

      // ── Run the six jobs exactly as scheduler.js calls them ───────────────
      const [{ count: followerRows }] = await tx`SELECT snapshot_follower_counts(CURRENT_DATE) AS count`;
      check('snapshot_follower_counts runs', num(followerRows) >= 1, `rows=${followerRows}`);

      const [{ count: dailyRows }] = await tx`SELECT aggregate_creator_daily(CURRENT_DATE) AS count`;
      check('aggregate_creator_daily runs', num(dailyRows) >= 1, `rows=${dailyRows}`);

      await tx`SELECT aggregate_content_metrics(CURRENT_DATE)`;
      await tx`SELECT aggregate_dish_metrics(CURRENT_DATE)`;
      await tx`SELECT rebuild_audience_segments()`;
      await tx`SELECT rebuild_customer_cohorts()`;
      check('all four remaining jobs run without error', true);

      // ── Assert the numbers ────────────────────────────────────────────────
      const [fs_] = await tx`SELECT follower_count FROM follower_snapshots WHERE cook_id = ${cook.id} AND date = CURRENT_DATE`;
      check('follower snapshot = 1', num(fs_?.follower_count) === 1, String(fs_?.follower_count));

      const [cm] = await tx`SELECT * FROM content_metrics WHERE post_id = ${post.id}`;
      check('post views = 3',            num(cm?.view_count) === 3, String(cm?.view_count));
      check('post unique viewers = 2',   num(cm?.unique_viewers) === 2, String(cm?.unique_viewers));
      check('post likes = 1',            num(cm?.like_count) === 1, String(cm?.like_count));
      check('post comments = 1 (deleted excluded)', num(cm?.comment_count) === 1, String(cm?.comment_count));
      check('post shares = 1',           num(cm?.share_count) === 1, String(cm?.share_count));
      check('post bookmarks = 1',        num(cm?.bookmark_count) === 1, String(cm?.bookmark_count));
      check('post CTA taps = 1',         num(cm?.order_click_count) === 1, String(cm?.order_click_count));
      check('orders from post = 1',      num(cm?.orders_from_post) === 1, String(cm?.orders_from_post));
      check('revenue from post = 4500 (cook_payout)', num(cm?.revenue_from_post) === 4500, String(cm?.revenue_from_post));

      const [dm] = await tx`SELECT * FROM dish_metrics WHERE item_id = ${item.id}`;
      check('dish views = 2',            num(dm?.view_count) === 2, String(dm?.view_count));
      check('dish cravings = 1',         num(dm?.craving_count) === 1, String(dm?.craving_count));
      check('dish cart adds = 1',        num(dm?.cart_add_count) === 1, String(dm?.cart_add_count));
      check('dish orders = 3 (cancelled excluded)', num(dm?.order_count) === 3, String(dm?.order_count));
      check('dish revenue = 14000',      num(dm?.total_revenue) === 14000, String(dm?.total_revenue));
      check('dish repeat orders = 1',    num(dm?.repeat_order_count) === 1, String(dm?.repeat_order_count));
      check('view_to_cart_rate = 0.5',   num(dm?.view_to_cart_rate) === 0.5, String(dm?.view_to_cart_rate));
      check('slot_fill_rate = 0.4',      num(dm?.slot_fill_rate) === 0.4, String(dm?.slot_fill_rate));

      const [cd] = await tx`SELECT * FROM creator_daily_metrics WHERE cook_id = ${cook.id} AND date = CURRENT_DATE`;
      check('orders received = 4 (incl. cancelled)', num(cd?.orders_received) === 4, String(cd?.orders_received));
      check('gross revenue = 14000 (cancelled excluded)', num(cd?.gross_revenue) === 14000, String(cd?.gross_revenue));
      check('net payout = 11500',        num(cd?.net_payout) === 11500, String(cd?.net_payout));
      check('new customers = 2',         num(cd?.new_customers) === 2, String(cd?.new_customers));
      check('post views = 3',            num(cd?.post_views) === 3, String(cd?.post_views));
      check('profile views = 1',         num(cd?.profile_views) === 1, String(cd?.profile_views));
      check('dish views = 2',            num(cd?.dish_views) === 2, String(cd?.dish_views));
      check('new followers = 1',         num(cd?.new_followers) === 1, String(cd?.new_followers));
      check('lost followers = 1 (from event)', num(cd?.lost_followers) === 1, String(cd?.lost_followers));

      const cohorts = await tx`SELECT * FROM customer_cohorts WHERE cook_id = ${cook.id} ORDER BY total_spent DESC`;
      check('two cohort rows', cohorts.length === 2, String(cohorts.length));
      check('repeat customer flagged', cohorts[0]?.is_repeat === true && num(cohorts[0]?.order_count) === 2, JSON.stringify({ r: cohorts[0]?.is_repeat, n: cohorts[0]?.order_count }));
      check('cohort spend = 11000 (cancelled excluded)', num(cohorts[0]?.total_spent) === 11000, String(cohorts[0]?.total_spent));

      const segs = await tx`SELECT segment_type, segment_value, customer_count, order_count FROM audience_segments WHERE cook_id = ${cook.id} ORDER BY segment_type, segment_value`;
      const dietary = segs.filter(s => s.segment_type === 'dietary');
      const freq    = segs.filter(s => s.segment_type === 'order_frequency');
      check('dietary segments include vegetarian + unspecified',
        dietary.some(s => s.segment_value === 'vegetarian') && dietary.some(s => s.segment_value === 'unspecified'),
        JSON.stringify(dietary.map(s => s.segment_value)));
      check('frequency buckets split 1 vs 2-3',
        freq.some(s => s.segment_value === '1 order') && freq.some(s => s.segment_value === '2-3 orders'),
        JSON.stringify(freq.map(s => `${s.segment_value}:${s.customer_count}`)));

      // ── The order trigger keeps cohorts current without a rebuild ─────────
      await tx`INSERT INTO orders (customer_id, cook_id, menu_item_id, status, quantity, unit_price, subtotal, total_amount, cook_payout, created_at)
               VALUES (${cust2.id}, ${cook.id}, ${item.id}, 'delivered', 1, 5000, 5000, 1000, 900, CURRENT_DATE)`;
      const [trig] = await tx`SELECT order_count, total_spent, is_repeat FROM customer_cohorts WHERE cook_id = ${cook.id} AND customer_id = ${cust2.id}`;
      check('trigger updated cohort on new order',
        num(trig?.order_count) === 2 && num(trig?.total_spent) === 4000 && trig?.is_repeat === true,
        JSON.stringify(trig));

      // ── Every dashboard endpoint query must execute ───────────────────────
      const since = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
      await tx`SELECT COALESCE(SUM(gross_revenue),0) AS revenue, COALESCE(SUM(post_views + story_views),0) AS reach,
                      COALESCE(SUM(post_likes + post_comments + post_shares + post_bookmarks),0) AS eng
               FROM creator_daily_metrics WHERE cook_id = ${cook.id} AND date >= ${since}`;
      await tx`SELECT date, follower_count FROM follower_snapshots WHERE cook_id = ${cook.id} AND date >= ${since} ORDER BY date ASC`;
      await tx`SELECT cdp.id, COALESCE(cm.view_count,0) AS v, COALESCE(cm.revenue_from_post,0) AS r
               FROM cook_diary_posts cdp LEFT JOIN content_metrics cm ON cm.post_id = cdp.id
               WHERE cdp.cook_id = ${cook.id} ORDER BY cdp.created_at DESC LIMIT 20`;
      await tx`SELECT mi.id, COALESCE(dm.order_count,0) AS o, dm.view_to_cart_rate, dm.slot_fill_rate, dm.avg_order_value
               FROM menu_items mi LEFT JOIN dish_metrics dm ON dm.item_id = mi.id
               WHERE mi.cook_id = ${cook.id} ORDER BY mi.created_at DESC LIMIT 20`;
      await tx`SELECT segment_type, segment_value, customer_count, order_count, revenue FROM audience_segments
               WHERE cook_id = ${cook.id} ORDER BY segment_type, customer_count DESC`;
      await tx`SELECT cohort_month, COUNT(*)::int AS total, COUNT(*) FILTER (WHERE is_repeat)::int AS rep,
                      COALESCE(SUM(total_spent),0) AS rev
               FROM customer_cohorts WHERE cook_id = ${cook.id} GROUP BY cohort_month ORDER BY cohort_month DESC LIMIT 12`;
      await tx`SELECT u.full_name, cc.order_count, cc.total_spent, cc.last_order_at
               FROM customer_cohorts cc JOIN users u ON u.id = cc.customer_id
               WHERE cc.cook_id = ${cook.id} ORDER BY cc.total_spent DESC LIMIT 10`;
      check('all six dashboard endpoint queries execute', true);

      throw new Error('__ROLLBACK__');
    });
  } catch (e) {
    if (e.message !== '__ROLLBACK__') {
      console.error('\ntest error:', e.message);
      results.push({ name: 'transaction completed', ok: 'FAIL', detail: e.message.split('\n')[0] });
    }
  }

  // Prove nothing was committed.
  const [{ n }] = await sql`SELECT COUNT(*)::int n FROM users WHERE phone IN ('+2349900009901','+2349900009902','+2349900009903')`;
  check('rolled back — no seed rows committed', n === 0, `found ${n}`);
  const [{ f }] = await sql`SELECT COUNT(*)::int f FROM information_schema.tables WHERE table_schema='public' AND table_name='content_metrics'`;
  console.log(`\n(content_metrics exists outside the transaction: ${f === 1 ? 'yes — already migrated' : 'no — not deployed yet'})`);

  await sql.end();

  const pad = (s, w) => String(s).padEnd(w);
  console.log('\n──── ANALYTICS AGGREGATION TEST ────');
  for (const r of results) console.log(`${pad(r.ok, 5)} ${pad(r.name, 46)} ${String(r.detail).slice(0, 60)}`);
  const fails = results.filter(r => r.ok === 'FAIL').length;
  console.log(`\n${results.length} checks, ${fails} failed`);
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error('fatal:', e); process.exit(1); });
