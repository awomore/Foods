'use strict';

const crypto = require('crypto');
const ledger = require('./ledger');
const { notifyAndPush } = require('../services/push');

/**
 * Settle a payout that the gateway confirms SUCCEEDED (transfer.completed /
 * reconciliation). Advances `processing → completed`, marks the batched orders +
 * tips paid, and notifies the cook. Idempotent: the status guard means a
 * duplicate webhook + a reconciliation poll can't double-apply.
 *
 * @param {object} sql  base postgres client (manages its own transaction)
 * @param {string} payoutId
 * @returns {Promise<{settled:boolean}>}
 */
async function settlePayoutSuccess(sql, payoutId) {
  let cookUserId = null, amount = null, currency = 'NGN';

  const settled = await sql.begin(async sql => {
    const rows = await sql`
      UPDATE payouts SET status = 'completed', processed_at = NOW()
      WHERE id = ${payoutId} AND status = 'processing'
      RETURNING cook_id, amount, currency_code
    `;
    if (!rows.length) return false; // not processing (already settled / unknown)

    const payout = rows[0];
    amount = payout.amount;
    currency = payout.currency_code ?? 'NGN';

    // The batched orders/tips are now truly paid out.
    await sql`UPDATE orders SET payout_status = 'paid' WHERE payout_batch_id = ${payoutId}`;
    await sql`UPDATE tips   SET payout_status = 'paid' WHERE payout_batch_id = ${String(payoutId)}`;

    const cook = await sql`SELECT user_id FROM cook_profiles WHERE id = ${payout.cook_id}`;
    cookUserId = cook[0]?.user_id ?? null;
    return true;
  });

  if (settled && cookUserId) {
    await notifyAndPush(
      cookUserId, 'payout_completed', 'Payout completed',
      `Your payout of ${amount} ${currency} has landed in your bank account.`,
      { payout_id: payoutId, type: 'payout_completed' },
    ).catch(() => {});
  }
  return { settled };
}

/**
 * Settle a payout that the gateway confirms FAILED (transfer failed after it was
 * accepted). Advances `processing → failed`, reverts the batched orders + tips to
 * `pending` (so the cook can retry), REVERSES the ledger draw-down that the
 * accept posted (earnings were debited on accept; the money never left, so credit
 * them back), and notifies the cook.
 *
 * @param {object} sql  base postgres client
 * @param {string} payoutId
 * @param {string} [reason]
 * @returns {Promise<{settled:boolean}>}
 */
async function settlePayoutFailure(sql, payoutId, reason = 'Transfer failed at gateway') {
  let cookUserId = null;

  const settled = await sql.begin(async sql => {
    const rows = await sql`
      UPDATE payouts SET status = 'failed', failure_reason = ${reason}
      WHERE id = ${payoutId} AND status = 'processing'
      RETURNING cook_id
    `;
    if (!rows.length) return false;

    // Return the orders/tips to the pending pool so they're re-payable.
    await sql`UPDATE orders SET payout_status = 'pending', payout_batch_id = NULL WHERE payout_batch_id = ${payoutId}`;
    await sql`UPDATE tips   SET payout_status = 'pending', payout_batch_id = NULL WHERE payout_batch_id = ${String(payoutId)}`;

    // Reverse the accept-time draw-down (earnings → gateway), if it was posted
    // and not already reversed. Flip each leg's direction; stays balanced.
    const drawRef = `payout:${payoutId}`;
    const reverseRef = `payout-reversal:${payoutId}`;
    const already = await sql`SELECT 1 FROM ledger_entries WHERE ref = ${reverseRef} LIMIT 1`;
    if (!already.length) {
      const legs = await sql`
        SELECT account_id, direction, amount_minor, currency
        FROM ledger_entries WHERE ref = ${drawRef}
      `;
      if (legs.length >= 2) {
        await ledger.post(sql, {
          transactionId: crypto.randomUUID(),
          currency: legs[0].currency,
          entryType: 'payout_reversal',
          description: 'Payout failed — reverse draw-down',
          ref: reverseRef,
          legs: legs.map(l => ({
            accountId: l.account_id,
            direction: l.direction === 'debit' ? 'credit' : 'debit',
            amount_minor: Number(l.amount_minor),
          })),
        });
      }
    }

    const cook = await sql`SELECT user_id FROM cook_profiles WHERE id = ${rows[0].cook_id}`;
    cookUserId = cook[0]?.user_id ?? null;
    return true;
  });

  if (settled && cookUserId) {
    await notifyAndPush(
      cookUserId, 'payout_failed', 'Payout failed',
      'We could not complete your payout. The amount is back in your balance — please try again or contact support.',
      { payout_id: payoutId, type: 'payout_failed' },
    ).catch(() => {});
  }
  return { settled };
}

/**
 * Resolve the internal payout id from a transfer webhook's normalized event.
 * Our transfer reference is `payout_<uuid>`; fall back to the gateway transfer id.
 * @returns {Promise<string|null>}
 */
async function resolvePayoutId(sql, event) {
  const ref = event?.reference ?? '';
  if (ref.startsWith('payout_')) return ref.slice('payout_'.length);
  if (event?.providerTxId) {
    const rows = await sql`SELECT id FROM payouts WHERE flutterwave_transfer_id = ${String(event.providerTxId)} LIMIT 1`;
    return rows[0]?.id ?? null;
  }
  return null;
}

module.exports = { settlePayoutSuccess, settlePayoutFailure, resolvePayoutId };
