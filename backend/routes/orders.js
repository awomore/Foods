const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { sql } = require('../supabase/db');
const analytics = require('../services/analytics');
const { notifyUsers, notifyAndPush } = require('../services/push');

const PLATFORM_FEE_RATE = 0.0375; // 3.75% — TODO: read from platform_settings

const FW_SECRET = process.env.FLUTTERWAVE_SECRET_KEY;
const FW_BASE   = 'https://api.flutterwave.com/v3';

// Valid status transitions for cook-driven actions
const COOK_TRANSITIONS = {
  payment_confirmed: ['accepted'],
  accepted:          ['preparing'],
  preparing:         ['ready'],
  ready:             ['out_for_delivery'],
  out_for_delivery:  ['in_transit'],
  in_transit:        ['delivered'],
  delivered:         ['completed'],
};

// Statuses from which a customer can still cancel
const CUSTOMER_CANCELLABLE = new Set(['pending_payment', 'payment_confirmed', 'accepted']);

// ── POST /api/orders ────────────────────────────────────────────────────────
router.post('/', authenticate, async (req, res) => {
  try {
    const {
      items,              // [{ menu_item_id, quantity, selected_sides, removed_sides }]
      delivery_address, delivery_latitude, delivery_longitude,
      delivery_window_start, delivery_window_end,
      customer_note,
      is_gift, gift_recipient_name, gift_recipient_phone, gift_message,
      meal_subscription_id,
      allergen_acknowledged,
      payment_tx_ref, payment_tx_id, payment_method,
    } = req.body;

    if (!items?.length) return res.status(400).json({ error: 'No items provided' });

    // Batch-fetch all menu items up front — eliminates N+1
    const itemIds = [...new Set(items.map(i => i.menu_item_id))];
    const [customerRows, allMenuItems] = await Promise.all([
      sql`SELECT allergens FROM customer_profiles WHERE user_id = ${req.user.id}`,
      sql`
        SELECT mi.*, cp.id AS cook_profile_id, cp.currency_code AS cook_currency
        FROM menu_items mi
        JOIN cook_profiles cp ON cp.id = mi.cook_id
        WHERE mi.id = ANY(${itemIds}::uuid[]) AND mi.is_active = true
      `,
    ]);
    const customerAllergens = customerRows[0]?.allergens ?? [];
    const menuItemMap = Object.fromEntries(allMenuItems.map(m => [m.id, m]));

    const createdOrders = [];

    for (const orderItem of items) {
      const {
        menu_item_id, quantity = 1,
        selected_sides = [], removed_sides = [],
      } = orderItem;

      const menuItem = menuItemMap[menu_item_id];
      if (!menuItem) {
        return res.status(404).json({ error: `Menu item ${menu_item_id} not found` });
      }

      // C5: Allergen guard — block before claiming any slot
      const itemAllergens     = menuItem.allergens ?? [];
      const matched_allergens = itemAllergens.filter(a => customerAllergens.includes(a));
      if (matched_allergens.length > 0 && !allergen_acknowledged) {
        return res.status(400).json({
          error: 'Allergen acknowledgement required',
          allergens: matched_allergens,
        });
      }

      // Claim slot atomically
      const order_type = menuItem.realtime_available ? 'realtime' : 'preorder';
      if (order_type === 'realtime') {
        const claimed = await sql`SELECT claim_realtime_slot(${menu_item_id}::uuid, ${quantity}) AS ok`;
        if (!claimed[0]?.ok) {
          return res.status(409).json({ error: 'No slots remaining for ' + menuItem.title });
        }
      } else {
        const claimed = await sql`SELECT claim_slot(${menu_item_id}::uuid, ${quantity}) AS ok`;
        if (!claimed[0]?.ok) {
          return res.status(409).json({ error: 'No slots remaining for ' + menuItem.title });
        }
      }

      // Price calculation
      const subtotal     = menuItem.unit_price * quantity;
      const delivery_fee = 0;
      const platform_fee = parseFloat((subtotal * PLATFORM_FEE_RATE).toFixed(2));
      const total_amount = subtotal + delivery_fee + platform_fee;
      const cook_payout  = subtotal - platform_fee;

      const order = await sql`
        INSERT INTO orders (
          customer_id, cook_id, menu_item_id,
          currency_code, order_type,
          status, quantity, unit_price, subtotal,
          delivery_fee, platform_fee, total_amount, cook_payout,
          selected_sides, removed_sides,
          delivery_address, delivery_latitude, delivery_longitude,
          delivery_window_start, delivery_window_end,
          allergen_acknowledged, matched_allergens,
          customer_note,
          is_gift, gift_recipient_name, gift_recipient_phone, gift_message,
          meal_subscription_id,
          flutterwave_tx_ref, flutterwave_tx_id, payment_method,
          payout_status
        ) VALUES (
          ${req.user.id}, ${menuItem.cook_id}, ${menu_item_id},
          ${menuItem.cook_currency ?? 'NGN'}, ${order_type},
          'pending_payment', ${quantity}, ${menuItem.unit_price}, ${subtotal},
          ${delivery_fee}, ${platform_fee}, ${total_amount}, ${cook_payout},
          ${JSON.stringify(selected_sides)}::jsonb, ${JSON.stringify(removed_sides)}::jsonb,
          ${delivery_address ?? null}, ${delivery_latitude ?? null}, ${delivery_longitude ?? null},
          ${delivery_window_start ?? null}::timestamptz, ${delivery_window_end ?? null}::timestamptz,
          ${!!allergen_acknowledged}, ${matched_allergens}::text[],
          ${customer_note ?? null},
          ${!!is_gift}, ${gift_recipient_name ?? null}, ${gift_recipient_phone ?? null}, ${gift_message ?? null},
          ${meal_subscription_id ?? null},
          ${payment_tx_ref ?? null}, ${payment_tx_id ?? null}, ${payment_method ?? 'card'},
          'pending'
        )
        RETURNING *
      `;

      // Award loyalty points (1 point per 100 currency units)
      const points = Math.floor(subtotal / 100);
      if (points > 0) {
        await sql`
          INSERT INTO loyalty_points (customer_id, balance, lifetime_earned)
          VALUES (${req.user.id}, ${points}, ${points})
          ON CONFLICT (customer_id) DO UPDATE
          SET balance         = loyalty_points.balance + ${points},
              lifetime_earned = loyalty_points.lifetime_earned + ${points}
        `;
        await sql`
          INSERT INTO loyalty_transactions (customer_id, type, points, description, order_id)
          VALUES (${req.user.id}, 'earned', ${points}, 'Points earned from order', ${order[0].id})
        `;
      }

      // Analytics: fire-and-forget (never awaited — must not block the response)
      analytics.emitEvent({
        event_name: 'order_placed',
        user_id:    req.user.id,
        cook_id:    menuItem.cook_id,
        item_id:    menu_item_id,
        order_id:   order[0].id,
        properties: {
          amount:        total_amount,
          cook_payout:   cook_payout,
          order_type,
          is_gift:       !!is_gift,
          quantity,
          source_post_id: req.body.source_post_id ?? null,
        },
      }).catch(() => {});

      createdOrders.push(order[0]);
    }

    // Notify cook(s) about new order(s) — fire-and-forget
    const cookUserIds = await sql`
      SELECT DISTINCT cp.user_id FROM cook_profiles cp
      WHERE cp.id = ANY(${createdOrders.map(o => o.cook_id)}::uuid[])
    `.catch(() => []);
    if (cookUserIds.length) {
      const itemCount = createdOrders.length;
      notifyUsers(
        cookUserIds.map(r => r.user_id),
        {
          title: 'New order received!',
          body: `You have ${itemCount} new item${itemCount > 1 ? 's' : ''} to prepare.`,
          data: { type: 'new_order', order_id: createdOrders[0].id },
        }
      ).catch(() => {});
    }

    res.status(201).json({ orders: createdOrders });
  } catch (err) {
    console.error('POST /orders:', err);
    res.status(500).json({ error: 'Failed to place order' });
  }
});

// ── GET /api/orders ─────────────────────────────────────────────────────────
router.get('/', authenticate, async (req, res) => {
  try {
    const { status, limit = 30, offset = 0 } = req.query;
    const isCustomer = req.user.role !== 'cook';

    let orders;
    if (isCustomer) {
      orders = await sql`
        SELECT o.*,
          cp.display_name AS cook_name, cp.username AS cook_username, cp.avatar_url AS cook_avatar,
          mi.title AS item_title, mi.photos AS item_photos
        FROM orders o
        JOIN cook_profiles cp ON cp.id = o.cook_id
        JOIN menu_items mi ON mi.id = o.menu_item_id
        WHERE o.customer_id = ${req.user.id}
          AND (${status ?? null}::text IS NULL OR o.status = ${status ?? null})
        ORDER BY o.created_at DESC
        LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}
      `;
    } else {
      const cooks = await sql`SELECT id FROM cook_profiles WHERE user_id = ${req.user.id}`;
      if (!cooks.length) return res.json({ orders: [] });
      const cookId = cooks[0].id;

      orders = await sql`
        SELECT o.*,
          u.full_name AS customer_name, u.avatar_url AS customer_avatar,
          mi.title AS item_title, mi.photos AS item_photos
        FROM orders o
        JOIN users u ON u.id = o.customer_id
        JOIN menu_items mi ON mi.id = o.menu_item_id
        WHERE o.cook_id = ${cookId}
          AND (${status ?? null}::text IS NULL OR o.status = ${status ?? null})
        ORDER BY o.created_at DESC
        LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}
      `;
    }

    res.json({ orders });
  } catch (err) {
    console.error('GET /orders:', err);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

// ── GET /api/orders/:id ─────────────────────────────────────────────────────
router.get('/:id', authenticate, async (req, res) => {
  try {
    const orders = await sql`
      SELECT o.*,
        cp.display_name AS cook_name, cp.username AS cook_username,
        cp.location AS cook_location, cp.latitude AS cook_lat, cp.longitude AS cook_lng,
        u.full_name AS customer_name,
        mi.title AS item_title, mi.photos AS item_photos, mi.allergens AS item_allergens
      FROM orders o
      JOIN cook_profiles cp ON cp.id = o.cook_id
      JOIN users u ON u.id = o.customer_id
      JOIN menu_items mi ON mi.id = o.menu_item_id
      WHERE o.id = ${req.params.id}
    `;
    if (!orders.length) return res.status(404).json({ error: 'Order not found' });
    const order = orders[0];

    const cooks = await sql`SELECT id FROM cook_profiles WHERE user_id = ${req.user.id}`;
    const isOwnerCook = cooks.some(c => c.id === order.cook_id);
    const isCustomer  = order.customer_id === req.user.id;

    if (!isOwnerCook && !isCustomer) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    res.json({ order });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch order' });
  }
});

// ── PATCH /api/orders/:id/status ────────────────────────────────────────────
router.patch('/:id/status', authenticate, async (req, res) => {
  try {
    const { status, ready_photo_url, rider_tracking_id, rider_name, rider_phone } = req.body;

    const orders = await sql`SELECT * FROM orders WHERE id = ${req.params.id}`;
    if (!orders.length) return res.status(404).json({ error: 'Order not found' });
    const order = orders[0];

    const cooks = await sql`SELECT id FROM cook_profiles WHERE user_id = ${req.user.id}`;
    const isOwnerCook = cooks.some(c => c.id === order.cook_id);
    const isCustomer  = order.customer_id === req.user.id;

    if (!isOwnerCook && !isCustomer) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    // C8: State machine validation
    if (isCustomer) {
      if (status !== 'cancelled') {
        return res.status(403).json({ error: 'Customers can only cancel orders' });
      }
      if (!CUSTOMER_CANCELLABLE.has(order.status)) {
        return res.status(409).json({
          error: `Order cannot be cancelled at status '${order.status}'`,
        });
      }
    } else {
      // Cook path — validate transition
      if (status === 'cancelled') {
        // Cooks can cancel any order that isn't already terminal
        const terminal = new Set(['delivered', 'completed', 'cancelled', 'refunded']);
        if (terminal.has(order.status)) {
          return res.status(409).json({ error: `Cannot cancel a '${order.status}' order` });
        }
      } else {
        const allowed = COOK_TRANSITIONS[order.status] ?? [];
        if (!allowed.includes(status)) {
          return res.status(409).json({
            error: `Cannot transition from '${order.status}' to '${status}'`,
          });
        }
      }
    }

    // Extra field guards
    if (status === 'ready' && !ready_photo_url) {
      return res.status(400).json({ error: 'ready_photo_url is required when marking order ready' });
    }

    const now = new Date();
    const extraFields = {};
    if (status === 'accepted')  extraFields.accepted_at  = now.toISOString();
    if (status === 'ready')     extraFields.ready_at     = now.toISOString();
    if (status === 'delivered') extraFields.delivered_at = now.toISOString();
    if (status === 'cancelled') extraFields.cancelled_at = now.toISOString();

    // 30-minute dispute window opens when order is delivered
    const DISPUTE_WINDOW_MINUTES = 30;
    const disputeWindowClosesAt = status === 'delivered'
      ? new Date(now.getTime() + DISPUTE_WINDOW_MINUTES * 60000).toISOString()
      : null;

    // SLA: promised delivery = accepted_at + sla_minutes (default 60)
    const deliveryPromisedAt = status === 'accepted'
      ? new Date(now.getTime() + (order.delivery_sla_minutes ?? 60) * 60000).toISOString()
      : null;

    const updated = await sql`
      UPDATE orders SET
        status                    = ${status},
        ready_photo_url           = COALESCE(${ready_photo_url ?? null}, ready_photo_url),
        rider_tracking_id         = COALESCE(${rider_tracking_id ?? null}, rider_tracking_id),
        rider_name                = COALESCE(${rider_name ?? null}, rider_name),
        rider_phone               = COALESCE(${rider_phone ?? null}, rider_phone),
        accepted_at               = COALESCE(${extraFields.accepted_at ?? null}::timestamptz, accepted_at),
        ready_at                  = COALESCE(${extraFields.ready_at ?? null}::timestamptz, ready_at),
        delivered_at              = COALESCE(${extraFields.delivered_at ?? null}::timestamptz, delivered_at),
        cancelled_at              = COALESCE(${extraFields.cancelled_at ?? null}::timestamptz, cancelled_at),
        delivery_promised_at      = COALESCE(${deliveryPromisedAt ?? null}::timestamptz, delivery_promised_at),
        dispute_window_closes_at  = COALESCE(${disputeWindowClosesAt ?? null}::timestamptz, dispute_window_closes_at),
        cancelled_by              = CASE WHEN ${status} = 'cancelled'
                                      THEN ${isCustomer ? 'customer' : 'cook'}
                                      ELSE cancelled_by END,
        updated_at                = NOW()
      WHERE id = ${req.params.id}
      RETURNING *
    `;

    // On delivery: log SLA event (late or on-time)
    if (status === 'delivered' && order.delivery_promised_at) {
      const promised = new Date(order.delivery_promised_at);
      const minutesLate = Math.max(0, Math.round((now - promised) / 60000));
      if (minutesLate > 0) {
        await sql`
          INSERT INTO sla_events (entity_type, entity_id, event_type, promised_at, actual_at, minutes_late)
          VALUES ('order', ${order.id}, 'delivery_late', ${order.delivery_promised_at}, ${now.toISOString()}, ${minutesLate})
        `.catch(() => {});
        await sql`
          UPDATE orders SET delivery_sla_breached = true WHERE id = ${order.id}
        `.catch(() => {});
      }
    }

    // On cancellation: apply reliability penalty
    if (status === 'cancelled') {
      const targetUserId = isCustomer ? req.user.id : null;
      if (targetUserId) {
        await sql`
          INSERT INTO sla_penalties (user_id, role, entity_type, entity_id, penalty_type, score_deduction)
          VALUES (${targetUserId}, 'customer', 'order', ${order.id}, 'cancellation', 5)
        `.catch(() => {});
        await sql`
          INSERT INTO reliability_scores (user_id, role, score, cancellations, total_orders, last_computed_at)
          VALUES (${targetUserId}, 'customer', 95, 1, 1, NOW())
          ON CONFLICT (user_id, role) DO UPDATE SET
            cancellations = reliability_scores.cancellations + 1,
            score = GREATEST(0, reliability_scores.score - 5),
            updated_at = NOW()
        `.catch(() => {});
      }
    }

    // Trigger reliability recompute after delivery (fire-and-forget)
    if (status === 'delivered') {
      const { _recompute } = require('./reliability');
      const cookUserRow = await sql`SELECT user_id FROM cook_profiles WHERE id = ${order.cook_id} LIMIT 1`;
      if (cookUserRow[0]) _recompute(cookUserRow[0].user_id).catch(() => {});
    }

    // Analytics: track key status transitions server-side
    const analyticsStatusMap = {
      accepted:  'order_accepted',
      ready:     'order_marked_ready',
      delivered: 'order_delivered',
      cancelled: 'order_cancelled',
    };
    if (analyticsStatusMap[status]) {
      analytics.emitEvent({
        event_name: analyticsStatusMap[status],
        user_id:    req.user.id,
        cook_id:    order.cook_id,
        order_id:   order.id,
        properties: { status, cancelled_by: isCustomer ? 'customer' : 'cook' },
      }).catch(() => {});
    }

    // In-app + push notifications for customer-visible milestones
    const notifMessages = {
      accepted:         { title: 'Order accepted!',     body: 'Your cook has accepted your order.' },
      preparing:        { title: 'Cooking started',     body: 'Your cook has started preparing your meal.' },
      ready:            { title: 'Your meal is ready!', body: 'Food is ready and waiting for pickup.' },
      out_for_delivery: { title: 'Out for delivery',    body: 'Your order has been picked up.' },
      in_transit:       { title: "It's on its way",     body: 'Your order is heading to you.' },
      delivered:        { title: 'Delivered!',          body: 'Your meal has been delivered. Enjoy!' },
      cancelled:        { title: 'Order cancelled',     body: isCustomer ? 'Your order has been cancelled.' : 'The cook has cancelled your order.' },
    };
    const msg = notifMessages[status];
    if (msg) {
      // Notify customer (fire-and-forget — never block the response)
      notifyAndPush(
        order.customer_id,
        `order_${status}`,
        msg.title,
        msg.body,
        { order_id: order.id, type: `order_${status}` }
      ).catch(() => {});
    }

    // Notify cook when customer cancels
    if (status === 'cancelled' && isCustomer) {
      const cookUserRow = await sql`SELECT user_id FROM cook_profiles WHERE id = ${order.cook_id} LIMIT 1`.catch(() => []);
      if (cookUserRow[0]) {
        notifyAndPush(
          cookUserRow[0].user_id,
          'order_cancelled_by_customer',
          'Order cancelled',
          'A customer has cancelled their order.',
          { order_id: order.id, type: 'order_cancelled_by_customer' }
        ).catch(() => {});
      }
    }

    res.json({ order: updated[0] });
  } catch (err) {
    console.error('PATCH /orders/:id/status:', err);
    res.status(500).json({ error: 'Failed to update order status' });
  }
});

// ── POST /api/orders/:id/refund ─────────────────────────────────────────────
// C7: Trigger a Flutterwave refund for a cancelled order.
// Accessible by cook (their kitchen) or future admin role.
router.post('/:id/refund', authenticate, async (req, res) => {
  try {
    const orders = await sql`SELECT * FROM orders WHERE id = ${req.params.id}`;
    if (!orders.length) return res.status(404).json({ error: 'Order not found' });
    const order = orders[0];

    // Must be the cook who owns this order
    const cooks = await sql`SELECT id FROM cook_profiles WHERE user_id = ${req.user.id}`;
    const isOwnerCook = cooks.some(c => c.id === order.cook_id);
    if (!isOwnerCook) return res.status(403).json({ error: 'Forbidden' });

    if (order.status !== 'cancelled') {
      return res.status(400).json({ error: 'Only cancelled orders can be refunded' });
    }

    const refundAmount = order.total_amount;

    if (FW_SECRET && order.flutterwave_tx_id) {
      const fwRes = await fetch(`${FW_BASE}/transactions/${order.flutterwave_tx_id}/refund`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${FW_SECRET}`,
        },
        body: JSON.stringify({ amount: refundAmount }),
      });
      const fwData = await fwRes.json();
      if (fwData.status !== 'success') {
        console.error('Flutterwave refund error:', fwData);
        return res.status(502).json({ error: 'Refund failed', detail: fwData.message });
      }
    } else if (!FW_SECRET) {
      console.log('[DEV] Refund skipped (no FW key):', order.id, refundAmount);
    }

    // Atomic update — only succeeds if not already refunded (race-safe against concurrent requests)
    const updated = await sql`
      UPDATE orders SET
        status        = 'refunded',
        refund_amount = ${refundAmount},
        refund_reason = ${req.body.reason ?? 'Order cancelled'},
        refunded_at   = NOW(),
        updated_at    = NOW()
      WHERE id = ${order.id}
        AND status = 'cancelled'
        AND refunded_at IS NULL
      RETURNING *
    `;
    if (!updated.length) {
      return res.status(409).json({ error: 'Order has already been refunded' });
    }

    // Notify customer
    await sql`
      INSERT INTO notifications (user_id, type, title, body, data)
      VALUES (${order.customer_id}, 'order_refunded',
              'Refund issued', ${'A refund of ₦' + refundAmount + ' has been initiated.'},
              ${{ order_id: order.id }}::jsonb)
    `;

    res.json({ order: updated[0] });
  } catch (err) {
    console.error('POST /orders/:id/refund:', err);
    res.status(500).json({ error: 'Failed to process refund' });
  }
});

// ── POST /api/orders/:id/tip ────────────────────────────────────────────────
router.post('/:id/tip', authenticate, async (req, res) => {
  try {
    const { amount } = req.body;
    if (!amount || amount <= 0) return res.status(400).json({ error: 'Invalid tip amount' });

    const orders = await sql`SELECT * FROM orders WHERE id = ${req.params.id} AND customer_id = ${req.user.id}`;
    if (!orders.length) return res.status(404).json({ error: 'Order not found' });

    const tip = await sql`
      INSERT INTO tips (customer_id, cook_id, order_id, amount, currency_code)
      VALUES (${req.user.id}, ${orders[0].cook_id}, ${req.params.id}, ${amount}, ${orders[0].currency_code})
      RETURNING *
    `;

    analytics.emitEvent({
      event_name: 'tip_added',
      user_id:    req.user.id,
      cook_id:    orders[0].cook_id,
      order_id:   req.params.id,
      properties: { amount, currency_code: orders[0].currency_code },
    }).catch(() => {});

    res.status(201).json({ tip: tip[0] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to add tip' });
  }
});

module.exports = router;
