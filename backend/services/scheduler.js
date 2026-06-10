const cron = require('node-cron');
const { sql } = require('../supabase/db');
const { sendAdminAlert } = require('./email');

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

  // ── Every hour: Expire stories and delete their Cloudinary media ─────────────
  cron.schedule('0 * * * *', async () => {
    const { v2: cloudinary } = require('cloudinary');
    const name   = process.env.CLOUDINARY_CLOUD_NAME;
    const key    = process.env.CLOUDINARY_API_KEY;
    const secret = process.env.CLOUDINARY_API_SECRET;
    if (name && key && secret) {
      cloudinary.config({ cloud_name: name, api_key: key, api_secret: secret, secure: true });
    }

    try {
      // Fetch expired stories that still have Cloudinary assets
      const expired = await sql`
        UPDATE stories SET is_active = false
        WHERE is_active = true AND expires_at <= NOW()
        RETURNING id, media_cloudinary_id, media_type
      `;

      if (!expired.length) return;
      console.log(`Expired ${expired.length} stories`);

      // Delete media from Cloudinary for stories that have a tracked public_id
      if (name && key && secret) {
        const toDelete = expired.filter(s => s.media_cloudinary_id);
        for (const story of toDelete) {
          const resourceType = story.media_type === 'video' ? 'video' : 'image';
          try {
            await cloudinary.uploader.destroy(story.media_cloudinary_id, { resource_type: resourceType });
          } catch (delErr) {
            console.error(`[story-cleanup] Failed to delete ${story.media_cloudinary_id}:`, delErr.message);
          }
        }
        if (toDelete.length) console.log(`[story-cleanup] Deleted ${toDelete.length} Cloudinary assets`);
      }
    } catch (err) {
      console.error('Story expiry/cleanup failed:', err.message);
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

  // ── Daily at 6am: Cloudinary quota check ─────────────────────────────────────
  // Alerts when storage or bandwidth exceeds 80% of the plan limit.
  cron.schedule('0 6 * * *', async () => {
    const { v2: cloudinary } = require('cloudinary');
    const name   = process.env.CLOUDINARY_CLOUD_NAME;
    const key    = process.env.CLOUDINARY_API_KEY;
    const secret = process.env.CLOUDINARY_API_SECRET;
    if (!name || !key || !secret) return;

    cloudinary.config({ cloud_name: name, api_key: key, api_secret: secret, secure: true });
    try {
      const usage = await cloudinary.api.usage();
      const storageUsedGB  = (usage.storage?.usage ?? 0) / (1024 ** 3);
      const storageLimitGB = (usage.storage?.limit  ?? 0) / (1024 ** 3);
      const bwUsedGB       = (usage.bandwidth?.usage ?? 0) / (1024 ** 3);
      const bwLimitGB      = (usage.bandwidth?.limit  ?? 0) / (1024 ** 3);
      const storagePercent = storageLimitGB > 0 ? (storageUsedGB / storageLimitGB) * 100 : 0;
      const bwPercent      = bwLimitGB      > 0 ? (bwUsedGB      / bwLimitGB)      * 100 : 0;

      console.log(
        `[cloudinary-quota] storage: ${storageUsedGB.toFixed(2)}/${storageLimitGB.toFixed(2)} GB ` +
        `(${storagePercent.toFixed(1)}%)  bandwidth: ${bwUsedGB.toFixed(2)}/${bwLimitGB.toFixed(2)} GB ` +
        `(${bwPercent.toFixed(1)}%)`
      );

      if (storagePercent >= 80) {
        const msg = `Cloudinary storage is at ${storagePercent.toFixed(1)}% (${storageUsedGB.toFixed(2)} / ${storageLimitGB.toFixed(2)} GB). Upgrade your Cloudinary plan immediately to avoid upload failures.`;
        console.error(`[cloudinary-quota] ALERT: ${msg}`);
        await sendAdminAlert(`[FOODSbyme] Cloudinary Storage at ${storagePercent.toFixed(0)}%`, msg);
      }
      if (bwPercent >= 80) {
        const msg = `Cloudinary bandwidth is at ${bwPercent.toFixed(1)}% (${bwUsedGB.toFixed(2)} / ${bwLimitGB.toFixed(2)} GB). Upgrade your Cloudinary plan immediately to avoid delivery failures.`;
        console.error(`[cloudinary-quota] ALERT: ${msg}`);
        await sendAdminAlert(`[FOODSbyme] Cloudinary Bandwidth at ${bwPercent.toFixed(0)}%`, msg);
      }
    } catch (err) {
      console.error('[cloudinary-quota] check failed:', err.message);
    }
  });
  // ── Every hour: Admin anomaly detection ──────────────────────────────────────
  // Fires an email alert when: dispute rate spikes, payouts fail repeatedly,
  // or a single customer places an abnormal number of orders (card-testing signal).
  cron.schedule('5 * * * *', async () => {
    try {
      const alerts = [];

      // 1. Dispute rate spike: >=3 disputes AND >10% of delivered orders in last 24h
      const [disputeStats] = await sql`
        SELECT
          (SELECT COUNT(*)::int FROM disputes
           WHERE created_at >= NOW() - INTERVAL '24 hours') AS dispute_count,
          (SELECT GREATEST(COUNT(*), 1)::int FROM orders
           WHERE status IN ('delivered','completed')
           AND updated_at >= NOW() - INTERVAL '24 hours') AS delivered_count
      `;
      const disputeCount = disputeStats?.dispute_count ?? 0;
      const deliveredCount = disputeStats?.delivered_count ?? 1;
      const disputeRate = disputeCount / deliveredCount;
      if (disputeCount >= 3 && disputeRate > 0.10) {
        alerts.push(`Dispute rate spike: ${disputeCount} disputes in 24h (${(disputeRate * 100).toFixed(1)}% of delivered orders).`);
      }

      // 2. Payout failures: >=3 failed payouts in the last 24h
      const [payoutFails] = await sql`
        SELECT COUNT(*)::int AS count FROM payouts
        WHERE status = 'failed' AND created_at >= NOW() - INTERVAL '24 hours'
      `;
      if ((payoutFails?.count ?? 0) >= 3) {
        alerts.push(`Payout failures: ${payoutFails.count} failed payouts in the last 24 hours.`);
      }

      // 3. Velocity anomaly: any customer placed >10 orders in the last hour (card-testing signal)
      const highVelocity = await sql`
        SELECT customer_id, COUNT(*)::int AS order_count
        FROM orders
        WHERE created_at >= NOW() - INTERVAL '1 hour'
        GROUP BY customer_id
        HAVING COUNT(*) > 10
      `;
      if (highVelocity.length) {
        alerts.push(`Velocity anomaly: ${highVelocity.length} customer(s) placed >10 orders in the last hour. IDs: ${highVelocity.map(r => r.customer_id).join(', ')}`);
      }

      if (alerts.length) {
        const body = alerts.map((a, i) => `${i + 1}. ${a}`).join('\n\n');
        console.error(`[anomaly-detection] ALERT:\n${body}`);
        await sendAdminAlert('[FOODSbyme] Anomaly Alert — Action Required', body);
      }
    } catch (err) {
      console.error('Anomaly detection failed:', err.message);
    }
  });
}

module.exports = { start };
