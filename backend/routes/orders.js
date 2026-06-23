const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { sql } = require('../supabase/db');
const analytics = require('../services/analytics');
const { notifyUsers, notifyAndPush } = require('../services/push');
const fez   = require('../services/fezDelivery');
const relay = require('../services/relayDelivery');

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

// Statuses from which a customer can still cancel (no rider yet in transit)
const CUSTOMER_CANCELLABLE = new Set(['pending_payment', 'payment_confirmed', 'accepted', 'preparing', 'ready']);

// ── POST /api/orders ────────────────────────────────────────────────────────
router.post('/', authenticate, async (req, res) => {
  try {
    const {
      items,              // [{ menu_item_id, quantity, selected_sides, removed_sides }]
      delivery_address, delivery_latitude, delivery_longitude,
      delivery_window_start, delivery_window_end,
      recipient_state,    // Nigerian state for Fez routing (e.g. "Lagos")
      customer_note,
      is_gift, gift_recipient_name, gift_recipient_phone, gift_message,
      meal_subscription_id,
      allergen_acknowledged,
      payment_tx_ref, payment_tx_id, payment_method,
      delivery_fee_payment_method, // 'wallet' | 'cash' | 'transfer'
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

      const order_type = menuItem.realtime_available ? 'realtime' : 'preorder';

      // Price calculation — done before the transaction (no DB writes, safe to compute outside)
      const subtotal     = menuItem.unit_price * quantity;
      const platform_fee = parseFloat((subtotal * PLATFORM_FEE_RATE).toFixed(2));

      // Delivery fee: charged upfront only when customer pays via wallet.
      // Cash/transfer = customer pays rider directly, so fee is 0 upfront.
      const dfMethod = delivery_fee_payment_method ?? 'wallet';
      let delivery_fee = 0;
      let delivery_provider = null;
      const isDelivery = delivery_address && delivery_address !== 'PICKUP';

      if (isDelivery && dfMethod === 'wallet' && recipient_state) {
        try {
          const cookRow = await sql`SELECT admin_area FROM cook_profiles WHERE id = ${menuItem.cook_profile_id} LIMIT 1`;
          const pickUpState = cookRow[0]?.admin_area ?? 'Lagos';
          const quote = await fez.getQuote(pickUpState, recipient_state, 1);
          delivery_fee = quote.fee;
          delivery_provider = 'fez';
        } catch (err) {
          console.warn('Fez quote failed during order placement, defaulting to 0:', err.message);
        }
      } else if (isDelivery && dfMethod !== 'wallet') {
        delivery_provider = 'pending'; // will be resolved when cook accepts
      }

      const total_amount = subtotal + delivery_fee + platform_fee;
      const cook_payout  = subtotal - platform_fee;
      const points       = Math.floor(subtotal / 100);

      // Claim slot + insert order atomically so the slot is released automatically
      // by the transaction rollback if the INSERT or any subsequent write fails.
      let order;
      try {
        await sql.begin(async sql => {
          if (order_type === 'realtime') {
            const claimed = await sql`SELECT claim_realtime_slot(${menu_item_id}::uuid, ${quantity}) AS ok`;
            if (!claimed[0]?.ok) {
              const e = new Error('No slots remaining for ' + menuItem.title);
              e.status = 409;
              throw e;
            }
          } else {
            const claimed = await sql`SELECT claim_slot(${menu_item_id}::uuid, ${quantity}) AS ok`;
            if (!claimed[0]?.ok) {
              const e = new Error('No slots remaining for ' + menuItem.title);
              e.status = 409;
              throw e;
            }
          }

          const orderRows = await sql`
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
              payout_status,
              delivery_provider, recipient_state,
              delivery_fee_payment_method
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
              'pending',
              ${delivery_provider ?? null}, ${recipient_state ?? null},
              ${dfMethod}
            )
            RETURNING *
          `;
          order = orderRows;

          // Award loyalty points inside the same transaction (1 point per 100 currency units)
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
              VALUES (${req.user.id}, 'earned', ${points}, 'Points earned from order', ${orderRows[0].id})
            `;
          }
        });
      } catch (txErr) {
        if (txErr.status === 409) {
          return res.status(409).json({ error: txErr.message });
        }
        throw txErr;
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
          mi.title AS item_title, mi.photos AS item_photos,
          COALESCE(o.rider_name, rp.full_name) AS rider_name,
          COALESCE(o.rider_phone, rp.phone) AS rider_phone
        FROM orders o
        JOIN cook_profiles cp ON cp.id = o.cook_id
        JOIN menu_items mi ON mi.id = o.menu_item_id
        LEFT JOIN rider_profiles rp ON rp.id = o.assigned_rider_id
        WHERE o.customer_id = ${req.user.id}
          AND (${status ?? null}::text IS NULL OR o.status = ${status ?? null})
        ORDER BY o.created_at DESC
        LIMIT ${Math.min(parseInt(limit), 100)} OFFSET ${parseInt(offset)}
      `;
    } else {
      const cooks = await sql`SELECT id FROM cook_profiles WHERE user_id = ${req.user.id}`;
      if (!cooks.length) return res.json({ orders: [] });
      const cookId = cooks[0].id;

      orders = await sql`
        SELECT o.*,
          u.full_name AS customer_name, u.avatar_url AS customer_avatar,
          mi.title AS item_title, mi.photos AS item_photos,
          COALESCE(o.rider_name, rp.full_name) AS rider_name,
          COALESCE(o.rider_phone, rp.phone) AS rider_phone
        FROM orders o
        JOIN users u ON u.id = o.customer_id
        JOIN menu_items mi ON mi.id = o.menu_item_id
        LEFT JOIN rider_profiles rp ON rp.id = o.assigned_rider_id
        WHERE o.cook_id = ${cookId}
          AND (${status ?? null}::text IS NULL OR o.status = ${status ?? null})
        ORDER BY o.created_at DESC
        LIMIT ${Math.min(parseInt(limit), 100)} OFFSET ${parseInt(offset)}
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
        mi.title AS item_title, mi.photos AS item_photos, mi.allergens AS item_allergens,
        COALESCE(o.rider_name, rp.full_name) AS rider_name,
        COALESCE(o.rider_phone, rp.phone) AS rider_phone
      FROM orders o
      JOIN cook_profiles cp ON cp.id = o.cook_id
      JOIN users u ON u.id = o.customer_id
      JOIN menu_items mi ON mi.id = o.menu_item_id
      LEFT JOIN rider_profiles rp ON rp.id = o.assigned_rider_id
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
    const {
      status,
      ready_photo_url,
      rider_tracking_id, rider_name, rider_phone,
      // Module 1 — prep time & delivery window
      prep_time_minutes,
      // Module 2 — logistics choice
      logistics_type,
      off_platform_rider_name, off_platform_rider_phone, off_platform_eta,
      // Module 4 — OTP verification inputs (rider app uses these)
      collection_otp_input, delivery_otp_input,
    } = req.body;

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

    // OTP verification — enforce before allowing status advance
    if (order.otp_enabled) {
      if (status === 'out_for_delivery' && order.collection_otp && order.collection_otp_verified_at === null) {
        if (!collection_otp_input || collection_otp_input !== order.collection_otp) {
          return res.status(400).json({ error: 'Invalid or missing collection OTP', otp_required: true, otp_type: 'collection' });
        }
      }
      if (status === 'delivered' && order.delivery_otp && order.delivery_otp_verified_at === null) {
        if (!delivery_otp_input || delivery_otp_input !== order.delivery_otp) {
          return res.status(400).json({ error: 'Invalid or missing delivery OTP', otp_required: true, otp_type: 'delivery' });
        }
      }
    }

    const now = new Date();
    const extraFields = {};
    if (status === 'accepted')  extraFields.accepted_at  = now.toISOString();
    if (status === 'ready')     extraFields.ready_at     = now.toISOString();
    if (status === 'delivered') extraFields.delivered_at = now.toISOString();
    if (status === 'cancelled') extraFields.cancelled_at = now.toISOString();

    // Module 1: delivery window — cook provides prep_time_minutes at accept
    let windowStart = null;
    let windowEnd   = null;
    let deliveryPromisedAt = null;

    if (status === 'accepted') {
      const prepMins = parseInt(prep_time_minutes) || (order.delivery_sla_minutes ?? 60);
      const isDelivery = order.delivery_address && order.delivery_address !== 'PICKUP';
      const deliveryBufferMins = isDelivery ? 30 : 0; // flat buffer until geo routing is live
      windowStart        = new Date(now.getTime() + prepMins * 60000);
      windowEnd          = new Date(windowStart.getTime() + (deliveryBufferMins + 15) * 60000);
      deliveryPromisedAt = windowEnd.toISOString();

      extraFields.prep_time_minutes     = prepMins;
      extraFields.delivery_window_start = windowStart.toISOString();
      extraFields.delivery_window_end   = windowEnd.toISOString();

      // Module 2: logistics type chosen at accept
      if (logistics_type) extraFields.logistics_type = logistics_type;

      // Module 4: copy cook's OTP setting to this order
      const cookOtpRow = await sql`SELECT otp_required FROM cook_profiles WHERE id = ${order.cook_id} LIMIT 1`;
      if (cookOtpRow[0]?.otp_required) extraFields.otp_enabled = true;
    }

    // Module 4: generate collection OTP when food is ready
    if (status === 'ready' && order.otp_enabled) {
      extraFields.collection_otp = String(Math.floor(100000 + Math.random() * 900000));
    }

    // Module 4: generate delivery OTP when order goes out for delivery
    if (status === 'out_for_delivery' && order.otp_enabled) {
      extraFields.delivery_otp = String(Math.floor(100000 + Math.random() * 900000));
      // Record collection OTP verification timestamp
      if (collection_otp_input && collection_otp_input === order.collection_otp) {
        extraFields.collection_otp_verified_at = now.toISOString();
      }
    }

    // Module 4: record delivery OTP verification
    if (status === 'delivered' && order.otp_enabled && delivery_otp_input === order.delivery_otp) {
      extraFields.delivery_otp_verified_at = now.toISOString();
    }

    // Module 2: off-platform rider details when dispatching own rider
    if (status === 'out_for_delivery' && order.logistics_type === 'off_platform') {
      if (off_platform_rider_name)  extraFields.off_platform_rider_name  = off_platform_rider_name;
      if (off_platform_rider_phone) extraFields.off_platform_rider_phone = off_platform_rider_phone;
      if (off_platform_eta)         extraFields.off_platform_eta         = off_platform_eta;
    }

    // 30-minute dispute window opens when order is delivered
    const DISPUTE_WINDOW_MINUTES = 30;
    const disputeWindowClosesAt = status === 'delivered'
      ? new Date(now.getTime() + DISPUTE_WINDOW_MINUTES * 60000).toISOString()
      : null;

    const updated = await sql`
      UPDATE orders SET
        status                       = ${status},
        ready_photo_url              = COALESCE(${ready_photo_url ?? null}, ready_photo_url),
        rider_tracking_id            = COALESCE(${rider_tracking_id ?? null}, rider_tracking_id),
        rider_name                   = COALESCE(${rider_name ?? null}, rider_name),
        rider_phone                  = COALESCE(${rider_phone ?? null}, rider_phone),
        accepted_at                  = COALESCE(${extraFields.accepted_at ?? null}::timestamptz, accepted_at),
        ready_at                     = COALESCE(${extraFields.ready_at ?? null}::timestamptz, ready_at),
        delivered_at                 = COALESCE(${extraFields.delivered_at ?? null}::timestamptz, delivered_at),
        cancelled_at                 = COALESCE(${extraFields.cancelled_at ?? null}::timestamptz, cancelled_at),
        delivery_promised_at         = COALESCE(${deliveryPromisedAt ?? null}::timestamptz, delivery_promised_at),
        delivery_window_start        = COALESCE(${extraFields.delivery_window_start ?? null}::timestamptz, delivery_window_start),
        delivery_window_end          = COALESCE(${extraFields.delivery_window_end ?? null}::timestamptz, delivery_window_end),
        prep_time_minutes            = COALESCE(${extraFields.prep_time_minutes ?? null}::int, prep_time_minutes),
        logistics_type               = COALESCE(${extraFields.logistics_type ?? null}, logistics_type),
        otp_enabled                  = CASE WHEN ${extraFields.otp_enabled ?? null}::boolean IS NOT NULL
                                         THEN ${extraFields.otp_enabled ?? false}
                                         ELSE otp_enabled END,
        collection_otp               = COALESCE(${extraFields.collection_otp ?? null}, collection_otp),
        collection_otp_verified_at   = COALESCE(${extraFields.collection_otp_verified_at ?? null}::timestamptz, collection_otp_verified_at),
        delivery_otp                 = COALESCE(${extraFields.delivery_otp ?? null}, delivery_otp),
        delivery_otp_verified_at     = COALESCE(${extraFields.delivery_otp_verified_at ?? null}::timestamptz, delivery_otp_verified_at),
        off_platform_rider_name      = COALESCE(${extraFields.off_platform_rider_name ?? null}, off_platform_rider_name),
        off_platform_rider_phone     = COALESCE(${extraFields.off_platform_rider_phone ?? null}, off_platform_rider_phone),
        off_platform_eta             = COALESCE(${extraFields.off_platform_eta ?? null}::timestamptz, off_platform_eta),
        dispute_window_closes_at     = COALESCE(${disputeWindowClosesAt ?? null}::timestamptz, dispute_window_closes_at),
        cancelled_by                 = CASE WHEN ${status} = 'cancelled'
                                         THEN ${isCustomer ? 'customer' : 'cook'}
                                         ELSE cancelled_by END,
        updated_at                   = NOW()
      WHERE id = ${req.params.id}
      RETURNING *
    `;

    // When cook marks food ready, dispatch Fez rider — only for Fez orders, not FOODS network or off-platform
    const effectiveLogistics = updated[0]?.logistics_type ?? order.logistics_type ?? order.delivery_provider;
    if (status === 'ready' && effectiveLogistics === 'fez' && order.delivery_address && order.delivery_address !== 'PICKUP') {
      (async () => {
        try {
          const customerRow = await sql`SELECT full_name, phone FROM users WHERE id = ${order.customer_id} LIMIT 1`;
          const cookRow = await sql`
            SELECT cp.location, cp.admin_area, u.phone AS cook_phone
            FROM cook_profiles cp JOIN users u ON u.id = cp.user_id
            WHERE cp.id = ${order.cook_id} LIMIT 1
          `;

          const { fezOrderNumber, batchId } = await fez.dispatchOrder({
            orderId:          order.id,
            recipientAddress: order.delivery_address,
            recipientState:   order.recipient_state ?? 'Lagos',
            recipientName:    customerRow[0]?.full_name ?? 'Customer',
            recipientPhone:   customerRow[0]?.phone ?? '',
            valueOfItem:      order.subtotal,
            weight:           1,
            cookAddress:      cookRow[0]?.location ?? cookRow[0]?.admin_area ?? '',
            cookPhone:        cookRow[0]?.cook_phone ?? '',
          });

          await sql`
            UPDATE orders
            SET fez_order_number  = ${fezOrderNumber},
                fez_batch_id      = ${batchId},
                fez_dispatch_status = 'dispatched',
                updated_at        = NOW()
            WHERE id = ${order.id}
          `;

          console.log(`Fez rider dispatched for order ${order.id}, fezOrderNumber: ${fezOrderNumber}`);
        } catch (err) {
          console.error(`Fez dispatch failed for order ${order.id}:`, err.message);
          await sql`
            UPDATE orders SET fez_dispatch_status = 'failed', updated_at = NOW() WHERE id = ${order.id}
          `.catch(() => {});
        }
      })();
    }

    // When Relay order is ready, get a fresh quote and dispatch a Chowdeck rider
    if (status === 'ready' && effectiveLogistics === 'relay' && order.delivery_address && order.delivery_address !== 'PICKUP') {
      (async () => {
        try {
          const [customerRow, cookRow] = await Promise.all([
            sql`SELECT full_name, phone FROM users WHERE id = ${order.customer_id} LIMIT 1`,
            sql`
              SELECT cp.latitude AS cook_lat, cp.longitude AS cook_lng, u.full_name AS cook_name, u.phone AS cook_phone
              FROM cook_profiles cp JOIN users u ON u.id = cp.user_id
              WHERE cp.id = ${order.cook_id} LIMIT 1
            `,
          ]);

          const { cook_lat, cook_lng } = cookRow[0] ?? {};
          const destLat = order.delivery_latitude;
          const destLng = order.delivery_longitude;

          if (!cook_lat || !cook_lng || !destLat || !destLng) {
            throw new Error('Missing coordinates for Relay dispatch — ensure cook profile and customer address have lat/lng');
          }

          // Always re-quote immediately before dispatch — fee_id expires
          const { feeId } = await relay.getQuote({
            sourceLat: Number(cook_lat),
            sourceLng: Number(cook_lng),
            destLat:   Number(destLat),
            destLng:   Number(destLng),
            estimatedOrderAmount: order.subtotal,
          });

          const { reference, trackingUrl } = await relay.dispatchOrder({
            feeId,
            orderId:     order.id,
            sourceContact: {
              name:  cookRow[0]?.cook_name  ?? 'FOODSbyme Kitchen',
              phone: cookRow[0]?.cook_phone ?? '',
            },
            destContact: {
              name:  customerRow[0]?.full_name ?? 'Customer',
              phone: customerRow[0]?.phone     ?? '',
            },
            itemType:     'food',
            customerNote: order.customer_note,
          });

          await sql`
            UPDATE orders
            SET relay_reference = ${reference},
                relay_status    = 'dispatched',
                rider_tracking_id = ${trackingUrl ?? null},
                updated_at      = NOW()
            WHERE id = ${order.id}
          `;

          console.log(`Relay rider dispatched for order ${order.id}, reference: ${reference}`);
        } catch (err) {
          console.error(`Relay dispatch failed for order ${order.id}:`, err.message);
          await sql`
            UPDATE orders SET relay_status = 'dispatch_failed', updated_at = NOW() WHERE id = ${order.id}
          `.catch(() => {});
        }
      })();
    }

    // When FOODS-network order is ready, notify all available approved riders
    if (status === 'ready' && effectiveLogistics === 'foods_network' && order.delivery_address && order.delivery_address !== 'PICKUP') {
      (async () => {
        try {
          const riderRows = await sql`
            SELECT user_id FROM rider_profiles
            WHERE status = 'approved' AND is_available = true
          `;
          const riderUserIds = riderRows.map(r => r.user_id);
          if (riderUserIds.length) {
            const { notifyUsers } = require('../services/push');
            await notifyUsers(riderUserIds, {
              title: 'New delivery available',
              body: `Order ready for pickup in ${updated[0]?.recipient_state ?? 'your area'} — tap to claim`,
              data: { type: 'new_delivery_available', orderId: order.id },
            });
          }
        } catch (e) {
          console.error('Rider push notification failed:', e.message);
        }
      })();
    }

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

      // Schedule review-request push 2 hours after delivery
      const customerId = order.customer_id;
      const orderId    = order.id;
      const cookId     = order.cook_id;
      setTimeout(() => {
        notifyAndPush(
          customerId,
          'review_request',
          'How was your meal?',
          'Rate your order and help others discover great food on FOODS.',
          { order_id: orderId, type: 'review_request', cook_id: cookId }
        ).catch(() => {});
      }, 2 * 60 * 60 * 1000);

      // Milestone check for cook (fire-and-forget)
      ;(async () => {
        try {
          const MILESTONES = [
            { count: 10,   level: 'Line Cook',    icon: '🔥', next: 25 },
            { count: 25,   level: 'Head Chef',    icon: '🎖️', next: 100 },
            { count: 100,  level: 'Master Chef',  icon: '⭐', next: 500 },
            { count: 500,  level: 'Legend',       icon: '🏆', next: 2000 },
            { count: 2000, level: 'Hall of Fame', icon: '👑', next: null },
          ];
          const countRow = await sql`
            SELECT COUNT(*)::int AS n FROM orders
            WHERE cook_id = ${order.cook_id} AND status IN ('delivered', 'completed')
          `;
          const total = countRow[0]?.n ?? 0;
          const milestone = MILESTONES.find(m => m.count === total);
          if (milestone && cookUserRow[0]) {
            await notifyAndPush(
              cookUserRow[0].user_id,
              'kitchen_milestone',
              `${milestone.icon} ${total} orders delivered!`,
              total < 2000
                ? `You've hit ${total} orders — you're now a ${milestone.level}. Next level: ${milestone.next} orders.`
                : `You're in the Hall of Fame. ${total} orders delivered. Legendary.`,
              { type: 'milestone', count: total, level: milestone.level }
            );
          }
        } catch (e) {
          console.error('[milestone] check failed:', e.message);
        }
      })();
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

// ── POST /api/orders/:id/confirm-receipt ────────────────────────────────────
// Customer confirms they received their food (off-platform delivery).
// Triggers escrow release.
router.post('/:id/confirm-receipt', authenticate, async (req, res) => {
  try {
    const orders = await sql`SELECT * FROM orders WHERE id = ${req.params.id}`;
    if (!orders.length) return res.status(404).json({ error: 'Order not found' });
    const order = orders[0];

    if (order.customer_id !== req.user.id) {
      return res.status(403).json({ error: 'Only the customer can confirm receipt' });
    }
    if (order.logistics_type !== 'off_platform') {
      return res.status(400).json({ error: 'Receipt confirmation only applies to off-platform orders' });
    }
    if (order.customer_confirmed_receipt) {
      return res.status(409).json({ error: 'Receipt already confirmed' });
    }
    if (!['out_for_delivery', 'in_transit', 'delivered'].includes(order.status)) {
      return res.status(409).json({ error: 'Order is not yet dispatched' });
    }

    const now = new Date().toISOString();
    const updated = await sql`
      UPDATE orders SET
        customer_confirmed_receipt = true,
        customer_confirmed_at      = ${now}::timestamptz,
        status                     = 'delivered',
        delivered_at               = COALESCE(delivered_at, ${now}::timestamptz),
        dispute_window_closes_at   = ${new Date(Date.now() + 30 * 60000).toISOString()}::timestamptz,
        updated_at                 = NOW()
      WHERE id = ${req.params.id}
      RETURNING *
    `;

    notifyAndPush(
      order.customer_id,
      'order_delivered',
      'Receipt confirmed!',
      'Thanks for confirming. Enjoy your meal!',
      { order_id: order.id, type: 'order_delivered' }
    ).catch(() => {});

    res.json({ order: updated[0] });
  } catch (err) {
    console.error('POST /orders/:id/confirm-receipt:', err);
    res.status(500).json({ error: 'Failed to confirm receipt' });
  }
});

// ── POST /api/orders/:id/rider-paid ─────────────────────────────────────────
// Rider (or cook) confirms delivery fee was paid directly (cash or transfer).
router.post('/:id/rider-paid', authenticate, async (req, res) => {
  try {
    const orders = await sql`SELECT * FROM orders WHERE id = ${req.params.id}`;
    if (!orders.length) return res.status(404).json({ error: 'Order not found' });
    const order = orders[0];

    if (!['cash', 'transfer'].includes(order.delivery_fee_payment_method)) {
      return res.status(400).json({ error: 'This order uses wallet payment — no rider confirmation needed' });
    }
    if (order.delivery_fee_paid_to_rider) {
      return res.status(409).json({ error: 'Already confirmed' });
    }

    const now = new Date().toISOString();
    const updated = await sql`
      UPDATE orders SET
        delivery_fee_paid_to_rider = true,
        delivery_fee_paid_at       = ${now}::timestamptz,
        updated_at                 = NOW()
      WHERE id = ${req.params.id}
      RETURNING *
    `;

    res.json({ order: updated[0] });
  } catch (err) {
    console.error('POST /orders/:id/rider-paid:', err);
    res.status(500).json({ error: 'Failed to record payment' });
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

// ── POST /api/orders/:id/cancel — customer cancel shortcut ──────────────────
router.post('/:id/cancel', authenticate, async (req, res) => {
  try {
    const { reason } = req.body;
    const orders = await sql`
      SELECT o.*, cp.user_id AS cook_user_id
      FROM orders o
      JOIN cook_profiles cp ON cp.id = o.cook_id
      WHERE o.id = ${req.params.id} AND o.customer_id = ${req.user.id}
    `;
    if (!orders.length) return res.status(404).json({ error: 'Order not found' });
    const order = orders[0];

    if (!CUSTOMER_CANCELLABLE.has(order.status)) {
      return res.status(409).json({
        error: `Cannot cancel a '${order.status}' order. If a rider is already en route, contact support.`,
      });
    }

    const [updated] = await sql`
      UPDATE orders SET
        status = 'cancelled',
        cancelled_at = NOW(),
        cancelled_by = 'customer',
        customer_note = COALESCE(${reason ?? null}, customer_note),
        updated_at = NOW()
      WHERE id = ${req.params.id}
      RETURNING *
    `;

    // Cancel active Relay delivery if one was dispatched
    if (order.relay_reference) {
      relay.cancelDelivery(order.relay_reference, 'Customer cancelled the order').catch(e => {
        console.error(`Relay cancel failed for order ${order.id}:`, e.message);
      });
    }

    // Release escrow if held
    await sql`
      UPDATE escrow_holds SET status = 'refunded', released_at = NOW(), payout_blocked = false
      WHERE order_id = ${req.params.id} AND status = 'held'
    `.catch(() => {});

    // Reliability penalty for customer cancellation post-acceptance
    if (['accepted', 'preparing', 'ready'].includes(order.status)) {
      await sql`
        INSERT INTO sla_penalties (user_id, role, entity_type, entity_id, penalty_type, score_deduction)
        VALUES (${req.user.id}, 'customer', 'order', ${req.params.id}, 'cancellation', 5)
        ON CONFLICT DO NOTHING
      `.catch(() => {});
    }

    // Notify cook
    const { notifyAndPush } = require('../services/push');
    notifyAndPush(order.cook_user_id, 'order_cancelled', 'Order cancelled',
      `A customer has cancelled their order.`,
      { type: 'order_cancelled', order_id: order.id }
    ).catch(() => {});

    res.json({ order: updated });
  } catch (err) {
    console.error('POST /orders/:id/cancel:', err);
    res.status(500).json({ error: 'Failed to cancel order' });
  }
});

module.exports = router;
