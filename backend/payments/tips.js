'use strict';

const { toMinor, fromMinor } = require('./money');
const { PaymentError, verifyPayment, consumeClaim } = require('./claims');

/**
 * Tips are money paid out to cooks: routes/earnings.js adds every 'pending'
 * tip to the cook's next payout. So a tip may only become 'pending' once a
 * payment for it has been spent (payments/claims.js). Before this, POST
 * /api/tips wrote whatever amount it was sent, unpaid, and it was paid out.
 *
 * tips.payout_status:
 *   'awaiting_payment'  added at checkout on a card order, waiting for the charge
 *   'pending'           paid; joins the cook's next payout
 *   'void'              the charge never covered it; never paid out
 */

/**
 * Verify and spend a payment for one tip, then record it as paid.
 * A wallet tip spends a /wallet/pay debit (claim purpose 'wallet_order');
 * a card tip spends a gateway charge of its own (purpose 'tip').
 */
async function recordPaidTip(sql, { userId, cookId, orderId, amount, currency, txRef, paymentMethod }, { verify, isProduction } = {}) {
  const n = Number(amount);
  if (!Number.isFinite(n) || n <= 0) throw new PaymentError(400, 'Invalid tip amount');
  if (!txRef) throw new PaymentError(400, 'A payment (tx_ref) is required to send a tip');
  const tipMinor = toMinor(n, currency);
  const isWallet = paymentMethod === 'wallet';

  let paidMinor = 0;
  if (!isWallet) {
    ({ paidMinor } = await verifyPayment({ reference: txRef, userId, currency, amountMinor: tipMinor }, { verify, isProduction }));
  }
  return sql.begin(async sql => {
    if (isWallet) {
      await consumeClaim(sql, { reference: txRef, purpose: 'wallet_order', userId, currency, paidMinor: 0, useMinor: tipMinor });
    } else {
      await consumeClaim(sql, { reference: txRef, purpose: 'tip', userId, currency, paidMinor, useMinor: paidMinor });
    }
    const [tip] = await sql`
      INSERT INTO tips (customer_id, cook_id, order_id, amount, currency_code, flutterwave_tx_ref, payout_status)
      VALUES (${userId}, ${cookId}, ${orderId ?? null}, ${fromMinor(tipMinor, currency)}, ${currency}, ${txRef}, 'pending')
      RETURNING *
    `;
    return tip;
  });
}

/**
 * Split a cart's tip across its orders in proportion to their subtotals; any
 * rounding remainder goes to the first order. Returns [{ order, minor }].
 */
function splitTip(tipMinor, orders) {
  const subtotals = orders.map(o => Number(o.subtotal_minor ?? 0));
  const sum = subtotals.reduce((a, b) => a + b, 0);
  const shares = orders.map((o, i) => ({
    order: o,
    minor: sum > 0 ? Math.floor((tipMinor * subtotals[i]) / sum) : Math.floor(tipMinor / orders.length),
  }));
  shares[0].minor += tipMinor - shares.reduce((a, s) => a + s.minor, 0);
  return shares.filter(s => s.minor > 0);
}

/**
 * Record the tip a customer added at checkout, one row per cook.
 * Wallet orders are already paid, so the tip spends the same wallet debit now.
 * Card orders aren't confirmed yet, so the rows wait as 'awaiting_payment'
 * until settleCheckoutTips runs on the charge.
 * Never throws for payment reasons: the orders stand either way.
 */
async function recordCheckoutTip(sql, { userId, orders, tipAmount, txRef, isWalletPaid }) {
  const n = Number(tipAmount);
  if (!orders.length || !txRef || !Number.isFinite(n) || n <= 0) return [];
  const currency = orders[0].currency_code ?? 'NGN';
  if (orders.some(o => (o.currency_code ?? 'NGN') !== currency)) return [];
  const shares = splitTip(toMinor(n, currency), orders);
  const tipMinor = shares.reduce((a, s) => a + s.minor, 0);

  try {
    return await sql.begin(async sql => {
      if (isWalletPaid) {
        await consumeClaim(sql, { reference: txRef, purpose: 'wallet_order', userId, currency, paidMinor: 0, useMinor: tipMinor });
      }
      const rows = [];
      for (const { order, minor } of shares) {
        const [tip] = await sql`
          INSERT INTO tips (customer_id, cook_id, order_id, amount, currency_code, flutterwave_tx_ref, payout_status)
          VALUES (${userId}, ${order.cook_id}, ${order.id}, ${fromMinor(minor, currency)}, ${currency}, ${txRef},
                  ${isWalletPaid ? 'pending' : 'awaiting_payment'})
          RETURNING *
        `;
        rows.push(tip);
      }
      return rows;
    });
  } catch (err) {
    if (!(err instanceof PaymentError)) throw err;
    console.warn(`[Tips] checkout tip on ${txRef} not covered by the wallet debit (${err.message}); skipped`);
    return [];
  }
}

/**
 * After a card charge confirmed its orders, spend what's left of it on the
 * checkout tips waiting on it. Tips the charge can't cover are voided, never
 * paid out. Pass { voidAll: true } when the orders were cancelled instead.
 */
async function settleCheckoutTips(sql, reference, { voidAll = false } = {}) {
  if (voidAll) {
    await sql`UPDATE tips SET payout_status = 'void' WHERE flutterwave_tx_ref = ${reference} AND payout_status = 'awaiting_payment'`;
    return { settled: 0 };
  }
  try {
    return await sql.begin(async sql => {
      const tips = await sql`
        SELECT id, customer_id, currency_code, amount FROM tips
        WHERE flutterwave_tx_ref = ${reference} AND payout_status = 'awaiting_payment'
        FOR UPDATE
      `;
      if (!tips.length) return { settled: 0 };
      const { customer_id: userId, currency_code: currency } = tips[0];
      const useMinor = tips.reduce((a, t) => a + toMinor(t.amount, currency), 0);
      // The order confirmation already opened this charge's claim; the tip draws on what's left.
      await consumeClaim(sql, { reference, purpose: 'order', userId, currency, paidMinor: 0, useMinor });
      await sql`UPDATE tips SET payout_status = 'pending' WHERE id = ANY(${tips.map(t => t.id)}::uuid[])`;
      return { settled: tips.length };
    });
  } catch (err) {
    if (!(err instanceof PaymentError)) throw err;
    console.warn(`[Tips] charge ${reference} does not cover its checkout tips (${err.message}); voiding them`);
    await sql`UPDATE tips SET payout_status = 'void' WHERE flutterwave_tx_ref = ${reference} AND payout_status = 'awaiting_payment'`;
    return { settled: 0 };
  }
}

module.exports = { recordPaidTip, recordCheckoutTip, settleCheckoutTips, splitTip };
