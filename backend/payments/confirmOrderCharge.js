'use strict';

const { orchestrator } = require('./orchestrator');
const { postOrderCapture } = require('./orderCapture');
const { PaymentError, verifyPayment, consumeClaim } = require('./claims');

/**
 * Confirm the card orders paid by one gateway charge.
 *
 * Shared by the webhook (charge.succeeded) and the reconciliation cron (dropped
 * webhooks), so both apply the same rules. The client names the charge when it
 * creates the order (orders.flutterwave_tx_ref), so a successful charge alone
 * proves nothing about the order: it must be this customer's, in the orders'
 * currency, cover their summed total, and not already have been spent
 * (payment_claims). A multi-cook cart is several orders on one charge.
 *
 * Outcomes:
 *   'none'      no pending orders cite this reference
 *   'unpaid'    the charge did not succeed (or is a dev-mode mock)
 *   'confirmed' orders moved to payment_confirmed, capture posted, customer told
 *   'mismatch'  the charge can't pay for these orders; they are cancelled
 * A verify error propagates, so the caller can retry later.
 *
 * @param {object} sql postgres client
 * @param {string} reference the charge's tx_ref
 * @param {{providerTxId?:string, verify?:Function}} [opts]
 * @returns {Promise<{outcome:string, orders:object[], reason?:string}>}
 */
async function confirmOrderCharge(sql, reference, { providerTxId, verify } = {}) {
  const pending = await sql`
    SELECT id FROM orders WHERE flutterwave_tx_ref = ${reference} AND status = 'pending_payment'
  `;
  if (!pending.length) return { outcome: 'none', orders: [] };

  const status = await (verify ?? ((ref) => orchestrator.verifyCharge(ref)))({ reference });
  if (!status.successful || status.devMode) return { outcome: 'unpaid', orders: pending };

  let confirmed = [];
  let reason = null;
  try {
    confirmed = await sql.begin(async sql => {
      const orders = await sql`
        SELECT id, customer_id, cook_id, currency_code,
               total_amount_minor, cook_payout_minor, delivery_fee_minor
        FROM orders
        WHERE flutterwave_tx_ref = ${reference} AND status = 'pending_payment'
        FOR UPDATE
      `;
      if (!orders.length) return []; // a racing confirmation got there first

      const { customer_id: customerId, currency_code: currency } = orders[0];
      if (orders.some(o => o.customer_id !== customerId || o.currency_code !== currency)) {
        throw new PaymentError(409, 'orders on one charge belong to different customers or currencies');
      }
      const totalMinor = orders.reduce((sum, o) => sum + Number(o.total_amount_minor ?? 0), 0);

      // Success was checked above; this checks currency and payer. The amount is
      // enforced by the claim, which knows how much of the charge is left.
      const { paidMinor } = await verifyPayment(
        { reference, userId: customerId, currency, amountMinor: 0 },
        { verify: async () => status },
      );
      await consumeClaim(sql, { reference, purpose: 'order', userId: customerId, currency, paidMinor, useMinor: totalMinor });

      await sql`
        UPDATE orders
        SET status            = 'payment_confirmed',
            flutterwave_tx_id = COALESCE(${providerTxId ?? status.providerTxId ?? null}, flutterwave_tx_id),
            updated_at        = NOW()
        WHERE id = ANY(${orders.map(o => o.id)}::uuid[])
      `;
      return orders;
    });
  } catch (err) {
    if (!(err instanceof PaymentError)) throw err;
    reason = err.message;
  }

  if (reason) {
    console.error(`[Payments] charge ${reference} cannot pay for its orders (${reason}); cancelling`);
    const cancelled = await sql`
      UPDATE orders
      SET status        = 'cancelled',
          cancel_reason = 'Payment did not match the order',
          cancelled_by  = 'system',
          cancelled_at  = NOW()
      WHERE flutterwave_tx_ref = ${reference} AND status = 'pending_payment'
      RETURNING id, customer_id
    `;
    for (const row of cancelled) {
      await sql`
        INSERT INTO notifications (user_id, type, title, body, data)
        VALUES (${row.customer_id}, 'order_cancelled', 'Order cancelled',
                'Your payment did not match this order. Contact support if you were charged.',
                ${{ order_id: row.id }}::jsonb)
      `.catch(() => {});
    }
    return { outcome: 'mismatch', orders: cancelled, reason };
  }

  for (const row of confirmed) {
    // Mirror the capture into the ledger. The customer has paid, so a posting
    // failure must not undo the confirmation; the per-order ref keeps a retry
    // idempotent.
    await sql.begin(s => postOrderCapture(s, row, { sourceAccountType: 'gateway_clearing' })).catch(err => {
      console.error(`[Payments] ledger capture failed for order ${row.id} (confirmation stands):`, err.message);
    });
    await sql`
      INSERT INTO notifications (user_id, type, title, body, data)
      VALUES (${row.customer_id}, 'order_payment_confirmed',
              'Payment confirmed', 'Your payment was received. Waiting for cook to accept.',
              ${{ order_id: row.id }}::jsonb)
    `.catch(() => {});
  }
  return { outcome: 'confirmed', orders: confirmed };
}

module.exports = { confirmOrderCharge };
