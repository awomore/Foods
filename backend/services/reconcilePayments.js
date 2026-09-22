'use strict';

const { sql } = require('../supabase/db');
const { orchestrator } = require('../payments/orchestrator');
const { confirmOrderCharge } = require('../payments/confirmOrderCharge');

/**
 * Reconcile orders stuck in `pending_payment` past the payment window.
 *
 * A customer may open the payment WebView and never complete — but the gateway
 * webhook can also simply be DROPPED (network, provider outage), leaving an order
 * the customer actually paid for stranded in pending_payment. So we must NOT
 * blindly cancel: for each charge behind the stuck orders we re-verify with the
 * gateway (server-to-server) before deciding.
 *   • verified paid   → confirm through payments/confirmOrderCharge.js (the
 *                       webhook we missed): the charge must be the customer's,
 *                       cover the orders and not be spent already, or the
 *                       orders are cancelled instead;
 *   • verified unpaid → cancel as before;
 *   • verify errored  → leave it for the next run (never cancel on uncertainty).
 *
 * Orders are grouped by charge because a multi-cook cart is several orders on
 * one tx_ref, and the charge has to cover them together.
 *
 * Extracted from the scheduler cron so the decision logic is drivable in tests:
 * inject `verifyCharge` to exercise the paid / unpaid / errored branches against
 * real rows without a live gateway.
 *
 * @param {object}   [opts]
 * @param {(ref:{reference:string})=>Promise<{successful:boolean,devMode?:boolean,amount?:number,currency?:string,meta?:object}>} [opts.verifyCharge]
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
    SELECT id, flutterwave_tx_ref
    FROM orders
    WHERE status = 'pending_payment' AND created_at <= ${cutoff}
  `;

  let recovered = 0, cancelled = 0, deferred = 0;

  // No reference to check against → unpaid (nothing was ever initiated on the
  // rail for it).
  const unpaidIds = stuck.filter(o => !o.flutterwave_tx_ref).map(o => o.id);
  const refs = [...new Set(stuck.map(o => o.flutterwave_tx_ref).filter(Boolean))];

  for (const ref of refs) {
    let result;
    try {
      result = await confirmOrderCharge(sqlClient, ref, { verify });
    } catch (verifyErr) {
      const n = stuck.filter(o => o.flutterwave_tx_ref === ref).length;
      deferred += n;
      console.warn(`[Reconcile] verify failed for charge ${ref} (${n} order(s)), deferring:`, verifyErr.message);
      continue; // uncertainty → do not cancel this cycle
    }
    if (result.outcome === 'confirmed') recovered += result.orders.length;
    else if (result.outcome === 'mismatch') cancelled += result.orders.length;
    else if (result.outcome === 'unpaid') {
      // Only the orders past the window; a newer order on the same charge may
      // still be mid-payment.
      unpaidIds.push(...stuck.filter(o => o.flutterwave_tx_ref === ref).map(o => o.id));
    }
  }

  for (const id of unpaidIds) {
    const rows = await sqlClient`
      UPDATE orders
      SET status        = 'cancelled',
          cancel_reason = 'Payment not completed within 15 minutes',
          cancelled_by  = 'system',
          cancelled_at  = NOW()
      WHERE id = ${id} AND status = 'pending_payment'
      RETURNING id, customer_id
    `;
    if (!rows.length) continue;
    await sqlClient`
      INSERT INTO notifications (user_id, type, title, body, data)
      VALUES (${rows[0].customer_id}, 'order_cancelled',
              'Order cancelled', 'Your order was cancelled because payment was not completed in time.',
              ${{ order_id: id }}::jsonb)
    `.catch(() => {});
    cancelled++;
  }

  return { recovered, cancelled, deferred };
}

module.exports = { reconcilePendingPayments };
