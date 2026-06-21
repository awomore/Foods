'use strict';
const { sql } = require('../supabase/db');
const { notifyAndPush } = require('../services/push');

async function checkDelayedOrders() {
  try {
    const delayed = await sql`
      SELECT id, customer_id
      FROM orders
      WHERE status IN ('out_for_delivery', 'in_transit')
        AND delivery_window_end IS NOT NULL
        AND delivery_window_end < NOW()
        AND delay_notified_at IS NULL
    `;

    for (const order of delayed) {
      await sql`UPDATE orders SET delay_notified_at = NOW() WHERE id = ${order.id}`;
      notifyAndPush(
        order.customer_id,
        'delivery_delayed',
        'Delivery running a little late',
        "Your order is taking longer than expected. We'll let you know as soon as it's on its way.",
        { order_id: order.id }
      ).catch(() => {});
    }
  } catch (e) {
    console.error('[delay-worker]', e.message);
  }
}

module.exports = function startDelayWorker() {
  // Check every 2 minutes
  setInterval(checkDelayedOrders, 2 * 60 * 1000);
};
