const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { sql } = require('../supabase/db');

const PLATFORM_FEE_RATE = 0.0375; // 3.75%

// ── POST /api/orders ────────────────────────────────────────────────────────
router.post('/', authenticate, async (req, res) => {
  try {
    const {
      items,              // [{ menu_item_id, quantity, selected_sides, removed_sides }]
      delivery_address, delivery_latitude, delivery_longitude,
      delivery_window_start, delivery_window_end,
      customer_note,
      is_gift, gift_recipient_name, gift_recipient_phone, gift_message,
      allergen_acknowledged,
      payment_tx_ref, payment_tx_id, payment_method,
    } = req.body;

    if (!items?.length) return res.status(400).json({ error: 'No items provided' });

    const createdOrders = [];

    for (const orderItem of items) {
      const {
        menu_item_id, quantity = 1,
        selected_sides = [], removed_sides = [],
      } = orderItem;

      // Fetch menu item
      const menuItems = await sql`
        SELECT mi.*, cp.id AS cook_profile_id, cp.currency_code AS cook_currency
        FROM menu_items mi
        JOIN cook_profiles cp ON cp.id = mi.cook_id
        WHERE mi.id = ${menu_item_id} AND mi.is_active = true
      `;
      if (!menuItems.length) {
        return res.status(404).json({ error: `Menu item ${menu_item_id} not found` });
      }
      const menuItem = menuItems[0];

      // Claim slot atomically
      const order_type = menuItem.realtime_available ? 'realtime' : 'preorder';
      if (order_type === 'realtime') {
        const claimed = await sql`SELECT claim_realtime_slot(${menu_item_id}::uuid) AS ok`;
        if (!claimed[0]?.ok) {
          return res.status(409).json({ error: 'No slots remaining for ' + menuItem.title });
        }
      } else {
        const claimed = await sql`SELECT claim_slot(${menu_item_id}::uuid) AS ok`;
        if (!claimed[0]?.ok) {
          return res.status(409).json({ error: 'No slots remaining for ' + menuItem.title });
        }
      }

      // Price calculation
      const subtotal = menuItem.unit_price * quantity;
      const delivery_fee = 0; // logistics cost added separately
      const platform_fee = parseFloat((subtotal * PLATFORM_FEE_RATE).toFixed(2));
      const total_amount = subtotal + delivery_fee + platform_fee;
      const cook_payout  = subtotal - platform_fee;

      // Check allergen match
      const customerRows = await sql`
        SELECT allergens FROM customer_profiles WHERE user_id = ${req.user.id}
      `;
      const customerAllergens = customerRows[0]?.allergens ?? [];
      const itemAllergens = menuItem.allergens ?? [];
      const matched_allergens = itemAllergens.filter(a => customerAllergens.includes(a));

      const order = await sql`
        INSERT INTO orders (
          customer_id, cook_id, menu_item_id,
          country_code, currency_code, order_type,
          status, quantity, unit_price, subtotal,
          delivery_fee, platform_fee, total_amount, cook_payout,
          selected_sides, removed_sides,
          delivery_address, delivery_latitude, delivery_longitude,
          delivery_window_start, delivery_window_end,
          allergen_acknowledged, matched_allergens,
          customer_note,
          is_gift, gift_recipient_name, gift_recipient_phone, gift_message,
          payment_tx_ref, payment_tx_id, payment_method,
          payment_provider, payout_status
        ) VALUES (
          ${req.user.id}, ${menuItem.cook_id}, ${menu_item_id},
          'NG', ${menuItem.cook_currency ?? 'NGN'}, ${order_type},
          'paid', ${quantity}, ${menuItem.unit_price}, ${subtotal},
          ${delivery_fee}, ${platform_fee}, ${total_amount}, ${cook_payout},
          ${JSON.stringify(selected_sides)}::jsonb, ${JSON.stringify(removed_sides)}::jsonb,
          ${delivery_address ?? null}, ${delivery_latitude ?? null}, ${delivery_longitude ?? null},
          ${delivery_window_start ?? null}::timestamptz, ${delivery_window_end ?? null}::timestamptz,
          ${!!allergen_acknowledged}, ${matched_allergens}::text[],
          ${customer_note ?? null},
          ${!!is_gift}, ${gift_recipient_name ?? null}, ${gift_recipient_phone ?? null}, ${gift_message ?? null},
          ${payment_tx_ref ?? null}, ${payment_tx_id ?? null}, ${payment_method ?? 'card'},
          'flutterwave', 'pending'
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
          SET balance = loyalty_points.balance + ${points},
              lifetime_earned = loyalty_points.lifetime_earned + ${points}
        `;
        await sql`
          INSERT INTO loyalty_transactions (customer_id, type, points, description, order_id)
          VALUES (${req.user.id}, 'earned', ${points}, 'Points earned from order', ${order[0].id})
        `;
      }

      createdOrders.push(order[0]);
    }

    res.status(201).json({ orders: createdOrders });
  } catch (err) {
    console.error('POST /orders:', err);
    res.status(500).json({ error: 'Failed to place order' });
  }
});

// ── GET /api/orders ─────────────────────────────────────────────────────────
// Customer: their own orders. Cook: orders to their kitchen.
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

    // Auth: must be the customer or the cook
    const cooks = await sql`SELECT id FROM cook_profiles WHERE user_id = ${req.user.id}`;
    const isOwnerCook = cooks.some(c => c.id === order.cook_id);
    const isCustomer = order.customer_id === req.user.id;

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

    // Customers can only cancel
    if (isCustomer && status !== 'cancelled') {
      return res.status(403).json({ error: 'Customers can only cancel orders' });
    }
    if (!isOwnerCook && !isCustomer) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const extraFields = {};
    if (status === 'ready') extraFields.ready_at = new Date().toISOString();
    if (status === 'delivered') extraFields.delivered_at = new Date().toISOString();
    if (status === 'cancelled') extraFields.cancelled_at = new Date().toISOString();

    const updated = await sql`
      UPDATE orders SET
        status             = ${status},
        ready_photo_url    = COALESCE(${ready_photo_url ?? null}, ready_photo_url),
        rider_tracking_id  = COALESCE(${rider_tracking_id ?? null}, rider_tracking_id),
        rider_name         = COALESCE(${rider_name ?? null}, rider_name),
        rider_phone        = COALESCE(${rider_phone ?? null}, rider_phone),
        ready_at           = COALESCE(${extraFields.ready_at ?? null}::timestamptz, ready_at),
        delivered_at       = COALESCE(${extraFields.delivered_at ?? null}::timestamptz, delivered_at),
        cancelled_at       = COALESCE(${extraFields.cancelled_at ?? null}::timestamptz, cancelled_at),
        updated_at         = NOW()
      WHERE id = ${req.params.id}
      RETURNING *
    `;

    // Notify customer via notifications table
    if (status === 'ready' || status === 'in_transit' || status === 'delivered') {
      const notifMessages = {
        ready: { title: 'Your meal is ready!', body: `${order.cook_name ?? 'Your cook'} has your order ready.` },
        in_transit: { title: "It's on its way", body: 'Your order has been picked up and is heading to you.' },
        delivered: { title: 'Delivered!', body: 'Your meal has been delivered. Enjoy!' },
      };
      const msg = notifMessages[status];
      if (msg) {
        await sql`
          INSERT INTO notifications (user_id, type, title, body, data)
          VALUES (${order.customer_id}, ${`order_${status}`}, ${msg.title}, ${msg.body},
                  ${{ order_id: order.id }}::jsonb)
        `;
      }
    }

    res.json({ order: updated[0] });
  } catch (err) {
    console.error('PATCH /orders/:id/status:', err);
    res.status(500).json({ error: 'Failed to update order status' });
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

    res.status(201).json({ tip: tip[0] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to add tip' });
  }
});

module.exports = router;
