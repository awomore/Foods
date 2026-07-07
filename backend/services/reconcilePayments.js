'use strict';

const { sql } = require('../supabase/db');
const { orchestrator } = require('../payments/orchestrator');
const { postOrderCapture } = require('../payments/orderCapture');

/**
 * Reconcile orders stuck in `pending_payment` past the payment window.
 *
 * A customer may open the payment WebView and never complete — but the gateway
 * webhook can also simply be DROPPED (network, provider outage), leaving an order
 * the customer actually paid for stranded in pending_payment. So we must NOT
 * blindly cancel: for each stuck order we re-verify with the gateway
 * (server-to-server) before deciding.
 *   • verified paid  → confirm it + post the ledger capture (the webhook we
 *                      missed) + notify the customer;
 *   • verified unpaid → cancel as before;
 *   • verify errored  → leave it for the next run (never cancel on uncertainty).
 *
 * Extracted from the scheduler cron so the decision logic is drivable in tests:
 * inject `verifyCharge` to exercise the paid / unpaid / errored branches against
 * real rows without a live gateway.
 *
 * @param {object}   [opts]
 * @param {(ref:{reference:string})=>Promise<{successful:boolean,devMode?:boolean}>} [opts.verifyCharge]
 *        Gateway verify fn. Defaults to the orchestrator (live). A charge counts
 *        as paid only when `successful && !devMode`.
 * @param {number}   [opts.olderThanMs=900000]  Age threshold (default 15 min).
 * @param {object}   [opts.sqlClient=sql]        DB handle (overridable in tests).
 * @returns {Promise<{recovered:number, cancelled:number, deferred:number}>}
 */
async function reconcilePendingPayments({ verifyCharge, olderThanMs = 15 * 60 * 1000, sqlClient = sql } = {}) {
  const verify = verifyCharge ?? ((ref) => orchestrator.verifyCharge(ref));
  const cutoff = new Date(Date.now() - olderThanMs).toISOString();

  const stuck = await sqlClient`
    SELECT id, customer_id, cook_id, currency_code, flutterwave_tx_ref,
           total_amount_minor, cook_payout_minor, delivery_fee_minor
    FROM orders
    WHERE status = 'pending_payment' AND created_at <= ${cutoff}
  `;

  let recovered = 0, cancelled = 0, deferred = 0;

  for (const order of stuck) {
    // Re-verify with the gateway. No reference to check against → treat as
    // unpaid (nothing was ever initiated on the rail for it).
    let paid = false;
    if (order.flutterwave_tx_ref) {
      try {
        const status = await verify({ reference: order.flutterwave_tx_ref });
        paid = !!status.successful && !status.devMode;
      } catch (verifyErr) {
        deferred++;
        console.warn(`[Reconcile] verify failed for order ${order.id}, deferring:`, verifyErr.message);
        continue; // uncertainty → do not cancel this cycle
      }
    }

    if (paid) {
      // Dropped webhook: the charge succeeded but we never confirmed it. Mirror
      // the webhook path exactly (guarded on the pending status so a racing
      // webhook can't double-apply).
      const rows = await sqlClient`
        UPDATE orders
        SET status = 'payment_confirmed', updated_at = NOW()
        WHERE id = ${order.id} AND status = 'pending_payment'
        RETURNING id, customer_id
      `;
      if (!rows.length) continue; // a webhook beat us to it
      await sqlClient.begin(s => postOrderCapture(s, order, { sourceAccountType: 'gateway_clearing' }))
        .catch(err => console.error(`[Reconcile] capture failed for order ${order.id} (confirmation stands):`, err.message));
      await sqlClient`
        INSERT INTO notifications (user_id, type, title, body, data)
        VALUES (${order.customer_id}, 'order_payment_confirmed',
                'Payment confirmed', 'Your payment was received. Waiting for cook to accept.',
                ${{ order_id: order.id }}::jsonb)
      `.catch(() => {});
      recovered++;
    } else {
      const rows = await sqlClient`
        UPDATE orders
        SET status        = 'cancelled',
            cancel_reason = 'Payment not completed within 15 minutes',
            cancelled_by  = 'system',
            cancelled_at  = NOW()
        WHERE id = ${order.id} AND status = 'pending_payment'
        RETURNING id, customer_id
      `;
      if (!rows.length) continue;
      await sqlClient`
        INSERT INTO notifications (user_id, type, title, body, data)
        VALUES (${order.customer_id}, 'order_cancelled',
                'Order cancelled', 'Your order was cancelled because payment was not completed in time.',
                ${{ order_id: order.id }}::jsonb)
      `.catch(() => {});
      cancelled++;
    }
  }

  return { recovered, cancelled, deferred };
}

module.exports = { reconcilePendingPayments };
