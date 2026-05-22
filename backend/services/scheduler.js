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
}

module.exports = { start };
