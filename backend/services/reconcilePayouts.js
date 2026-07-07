'use strict';

const { sql } = require('../supabase/db');
const { orchestrator } = require('../payments/orchestrator');
const { settlePayoutSuccess, settlePayoutFailure } = require('../payments/payoutSettlement');

/**
 * Reconcile payouts stuck in `processing` past a window — the transfer (money-OUT)
 * counterpart of reconcilePendingPayments. A transfer webhook can be dropped, so
 * we poll the gateway for each processing payout and settle it:
 *   • completed → settlePayoutSuccess (mark paid, orders/tips paid, notify)
 *   • failed    → settlePayoutFailure (revert orders, reverse ledger draw-down)
 *   • pending / verify-errored → leave for the next run.
 *
 * verifyTransfer is injectable so the branches are drivable in tests.
 *
 * @param {object} [opts]
 * @param {(id:string, ctx?:object)=>Promise<{status:'completed'|'failed'|'pending'}>} [opts.verifyTransfer]
 * @param {number} [opts.olderThanMs=900000]  Age threshold (default 15 min).
 * @param {object} [opts.sqlClient=sql]
 * @returns {Promise<{completed:number, failed:number, deferred:number}>}
 */
async function reconcileProcessingPayouts({ verifyTransfer, olderThanMs = 15 * 60 * 1000, sqlClient = sql } = {}) {
  const verify = verifyTransfer ?? ((id, ctx) => orchestrator.verifyTransfer(id, ctx));
  const cutoff = new Date(Date.now() - olderThanMs).toISOString();

  const stuck = await sqlClient`
    SELECT id, currency_code, flutterwave_transfer_id
    FROM payouts
    WHERE status = 'processing'
      AND created_at <= ${cutoff}
      AND flutterwave_transfer_id IS NOT NULL
      AND flutterwave_transfer_id <> ''
  `;

  let completed = 0, failed = 0, deferred = 0;

  for (const p of stuck) {
    let status;
    try {
      const res = await verify(p.flutterwave_transfer_id, { currency: p.currency_code ?? 'NGN' });
      status = res.status;
    } catch (err) {
      deferred++;
      console.warn(`[ReconcilePayout] verify failed for payout ${p.id}, deferring:`, err.message);
      continue;
    }

    if (status === 'completed') {
      await settlePayoutSuccess(sqlClient, p.id);
      completed++;
    } else if (status === 'failed') {
      await settlePayoutFailure(sqlClient, p.id, 'Transfer failed (reconciliation)');
      failed++;
    } else {
      deferred++; // still pending at the gateway
    }
  }

  return { completed, failed, deferred };
}

module.exports = { reconcileProcessingPayouts };
