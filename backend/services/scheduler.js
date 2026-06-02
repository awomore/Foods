const cron = require('node-cron');
const { sql } = require('../supabase/db');

function start() {
  console.log('FOODSbyme scheduler started');

  // ── Every 15 minutes: Cook went dark handler ──────────────
  cron.schedule('*/15 * * * *', async () => {
    try {
      const settings = await sql`SELECT value FROM platform_settings WHERE key = 'cook_went_dark_minutes'`;
      const minutes = parseInt(settings[0]?.value || '90');
      const cutoff = new Date(Date.now() + minutes * 60 * 1000).toISOString();

      const orders = await sql`
        SELECT id, cook_id, customer_id FROM orders
        WHERE status IN ('accepted', 'preparing')
        AND delivery_window_end <= ${cutoff}
      `;

      for (const order of orders) {
        await sql`
          UPDATE orders SET status = 'cancelled',
            cancel_reason = 'Cook did not prepare in time',
            cancelled_by = 'system',
            cancelled_at = NOW()
          WHERE id = ${order.id}
        `;
        await sql`
          INSERT INTO cook_verification_log (cook_id, action, details)
          VALUES (${order.cook_id}, 'went_dark', ${'Order ' + order.id + ' auto-cancelled'})
        `;

        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
        const counts = await sql`
          SELECT COUNT(*) as count FROM cook_verification_log
          WHERE cook_id = ${order.cook_id} AND action = 'went_dark'
          AND created_at >= ${thirtyDaysAgo}
        `;
        if (parseInt(counts[0]?.count || 0) >= 3) {
          console.warn(`ADMIN ALERT: Cook ${order.cook_id} has 3+ went_dark in 30 days`);
        }
        console.log(`Order ${order.id} auto-cancelled (cook went dark)`);
      }
    } catch (err) {
      console.error('Cook went dark check failed:', err.message);
    }
  });

  // ── Every 15 minutes: Real-time order confirmation timeout ──
  cron.schedule('*/15 * * * *', async () => {
    try {
      const settings = await sql`SELECT value FROM platform_settings WHERE key = 'realtime_confirm_minutes'`;
      const minutes = parseInt(settings[0]?.value || '15');
      const cutoff = new Date(Date.now() - minutes * 60 * 1000).toISOString();

      const orders = await sql`
        SELECT id FROM orders
        WHERE order_type = 'realtime' AND status = 'payment_confirmed' AND created_at <= ${cutoff}
      `;
      for (const order of orders) {
        await sql`
          UPDATE orders SET status = 'cancelled',
            cancel_reason = 'Cook did not confirm in time',
            cancelled_by = 'system', cancelled_at = NOW()
          WHERE id = ${order.id}
        `;
        console.log(`Realtime order ${order.id} auto-cancelled (timeout)`);
      }
    } catch (err) {
      console.error('Realtime timeout check failed:', err.message);
    }
  });

  // ── Daily at 2am: Repeat order rate computation ───────────
  cron.schedule('0 2 * * *', async () => {
    try {
      const cooks = await sql`SELECT id FROM cook_profiles WHERE verification_status = 'approved'`;
      for (const cook of cooks) {
        const result = await sql`SELECT * FROM compute_repeat_rate(${cook.id})`;
        const rate = result[0]?.rate || 0;
        await sql`UPDATE cook_profiles SET repeat_order_rate = ${rate} WHERE id = ${cook.id}`;
      }
      console.log(`Repeat rates updated for ${cooks.length} cooks`);
    } catch (err) {
      console.error('Repeat rate computation failed:', err.message);
    }
  });

  // ── Daily at 3am: NAFDAC deadline check ───────────────────
  cron.schedule('0 3 * * *', async () => {
    try {
      const cooks = await sql`
        SELECT id, nafdac_status, nafdac_approval_date, user_id
        FROM cook_profiles
        WHERE verification_status = 'approved'
        AND nafdac_status IN ('not_submitted', 'in_progress')
      `;
      for (const cook of cooks) {
        if (!cook.nafdac_approval_date) continue;
        const days = Math.floor((Date.now() - new Date(cook.nafdac_approval_date).getTime()) / 86400000);

        if (days >= 35) {
          await sql`UPDATE cook_profiles SET verification_status = 'suspended', is_live = false WHERE id = ${cook.id}`;
          await sql`INSERT INTO cook_verification_log (cook_id, action) VALUES (${cook.id}, 'nafdac_auto_suspended')`;
          console.log(`Cook ${cook.id} auto-suspended (NAFDAC expired)`);
        } else if (days >= 25) {
          await sql`INSERT INTO cook_verification_log (cook_id, action) VALUES (${cook.id}, 'nafdac_reminder_25')`;
        } else if (days >= 15) {
          await sql`INSERT INTO cook_verification_log (cook_id, action) VALUES (${cook.id}, 'nafdac_reminder_15')`;
        }
      }
    } catch (err) {
      console.error('NAFDAC check failed:', err.message);
    }
  });

  // ── Peak hours: Flash sale check ──────────────────────────
  cron.schedule('*/30 11-14,17-21 * * *', async () => {
    try {
      const ts = await sql`SELECT value FROM platform_settings WHERE key = 'flash_sale_slots_threshold'`;
      const threshold = parseInt(ts[0]?.value || '3');
      const ms = await sql`SELECT value FROM platform_settings WHERE key = 'flash_sale_minutes_before_close'`;
      const minutes = parseInt(ms[0]?.value || '90');
      const cutoff = new Date(Date.now() + minutes * 60 * 1000).toISOString();

      const items = await sql`
        SELECT id, cook_id, title, total_slots, slots_claimed
        FROM menu_items
        WHERE is_active = true
        AND delivery_window_end <= ${cutoff}
        AND delivery_window_end >= NOW()
      `;
      for (const item of items) {
        const remaining = item.total_slots - item.slots_claimed;
        if (remaining > 0 && remaining <= threshold) {
          console.log(`Flash sale: ${item.title} (${remaining} left)`);
          // TODO: push notification to nearby flash_opt_in customers
        }
      }
    } catch (err) {
      console.error('Flash sale check failed:', err.message);
    }
  });

  // ── Every 5 minutes: Publish scheduled diary posts ───────────
  cron.schedule('*/5 * * * *', async () => {
    try {
      const due = await sql`
        UPDATE cook_diary_posts SET status = 'published'
        WHERE status = 'scheduled'
          AND scheduled_at <= NOW()
        RETURNING id, cook_id, body, post_type
      `;
      for (const post of due) {
        const followers = await sql`
          SELECT customer_id FROM follows WHERE cook_id = ${post.cook_id} AND notify_diary_post = true
        `;
        if (!followers.length) continue;
        const [cookInfo] = await sql`SELECT display_name FROM cook_profiles WHERE id = ${post.cook_id}`;
        const cookName = cookInfo?.display_name ?? 'Your cook';
        const typeLabel = (post.post_type ?? '').replace(/_/g, ' ');
        for (const f of followers) {
          await sql`
            INSERT INTO notifications (user_id, type, title, body, data)
            VALUES (
              ${f.customer_id}, 'diary_post',
              ${cookName + ' shared a ' + typeLabel},
              ${(post.body ?? '').slice(0, 100)},
              ${{ cook_id: post.cook_id, post_id: post.id }}::jsonb
            )
          `;
        }
      }
      if (due.length) console.log(`Published ${due.length} scheduled posts`);
    } catch (err) {
      console.error('Scheduled post publish failed:', err.message);
    }
  });

  // ── Every hour: Expire stories past their 24h window ─────────
  cron.schedule('0 * * * *', async () => {
    try {
      const result = await sql`
        UPDATE stories SET is_active = false
        WHERE is_active = true AND expires_at <= NOW()
        RETURNING id
      `;
      if (result.length) console.log(`Expired ${result.length} stories`);
    } catch (err) {
      console.error('Story expiry failed:', err.message);
    }
  });

  // ── Analytics: Daily midnight — snapshot follower counts ──────
  cron.schedule('0 0 * * *', async () => {
    try {
      const result = await sql`SELECT snapshot_follower_counts(CURRENT_DATE - 1) AS count`;
      console.log(`Follower snapshots written: ${result[0]?.count ?? 0} cooks`);
    } catch (err) {
      console.error('Follower snapshot failed:', err.message);
    }
  });

  // ── Analytics: Daily 1am — aggregate creator daily metrics ────
  cron.schedule('0 1 * * *', async () => {
    try {
      const result = await sql`SELECT aggregate_creator_daily(CURRENT_DATE - 1) AS count`;
      console.log(`Creator daily metrics aggregated for ${result[0]?.count ?? 0} cooks`);
    } catch (err) {
      console.error('Creator daily aggregation failed:', err.message);
    }
  });

  // ── Analytics: Daily 1:30am — aggregate content + dish metrics ─
  cron.schedule('30 1 * * *', async () => {
    try {
      await sql`SELECT aggregate_content_metrics(CURRENT_DATE - 1)`;
      console.log('Content metrics aggregated');
      await sql`SELECT aggregate_dish_metrics(CURRENT_DATE - 1)`;
      console.log('Dish metrics aggregated');
    } catch (err) {
      console.error('Content/dish aggregation failed:', err.message);
    }
  });

  // ── Analytics: Daily 2:30am — rebuild audience segments & cohorts
  cron.schedule('30 2 * * *', async () => {
    try {
      await sql`SELECT rebuild_audience_segments()`;
      console.log('Audience segments rebuilt');
      await sql`SELECT rebuild_customer_cohorts()`;
      console.log('Customer cohorts rebuilt');
    } catch (err) {
      console.error('Audience/cohort rebuild failed:', err.message);
    }
  });

  // ── Phase 7: Every 5 minutes — SLA breach detection ──────────
  cron.schedule('*/5 * * * *', async () => {
    try {
      const breached = await sql`
        UPDATE orders
        SET delivery_sla_breached = true
        WHERE delivery_sla_breached = false
          AND status NOT IN ('delivered','completed','cancelled','refunded')
          AND delivery_promised_at IS NOT NULL
          AND delivery_promised_at < NOW()
        RETURNING id, cook_id, delivery_promised_at
      `;
      for (const order of breached) {
        const minutesLate = Math.round((Date.now() - new Date(order.delivery_promised_at).getTime()) / 60000);
        await sql`
          INSERT INTO sla_events (entity_type, entity_id, event_type, promised_at, minutes_late)
          VALUES ('order', ${order.id}, 'delivery_late', ${order.delivery_promised_at}, ${minutesLate})
          ON CONFLICT DO NOTHING
        `.catch(() => {});
      }
      if (breached.length) console.log(`SLA breach: ${breached.length} orders marked`);
    } catch (err) {
      console.error('SLA breach check failed:', err.message);
    }
  });

  // ── Phase 7: Every hour — escrow auto-release ─────────────────
  cron.schedule('0 * * * *', async () => {
    try {
      const released = await sql`
        UPDATE escrow_holds
        SET status = 'released', released_at = NOW()
        WHERE status = 'held'
          AND payout_blocked = false
          AND auto_release_at IS NOT NULL
          AND auto_release_at <= NOW()
        RETURNING id, order_id, escrow_type, amount
      `;
      for (const hold of released) {
        if (hold.order_id) {
          await sql`UPDATE orders SET escrow_released = true WHERE id = ${hold.order_id}`.catch(() => {});
        }
      }
      if (released.length) console.log(`Escrow auto-released: ${released.length} holds`);
    } catch (err) {
      console.error('Escrow auto-release failed:', err.message);
    }
  });

  // ── Phase 7: Daily at 4am — reliability score recompute ───────
  cron.schedule('0 4 * * *', async () => {
    try {
      const { _recompute } = require('../routes/reliability');
      const activeUsers = await sql`
        SELECT DISTINCT customer_id AS user_id FROM orders
        WHERE created_at >= NOW() - INTERVAL '7 days'
        UNION
        SELECT DISTINCT u.id FROM cook_profiles cp
        JOIN users u ON u.id = cp.user_id
        WHERE cp.updated_at >= NOW() - INTERVAL '7 days'
        LIMIT 500
      `;
      let updated = 0;
      for (const row of activeUsers) {
        await _recompute(row.user_id).catch(() => {});
        updated++;
      }
      console.log(`Reliability scores recomputed: ${updated} users`);
    } catch (err) {
      console.error('Reliability recompute failed:', err.message);
    }
  });
}

module.exports = { start };
