'use strict';

const crypto = require('crypto');
const ledger = require('./ledger');

/**
 * Post an order's payment capture into the double-entry ledger.
 *
 * The buyer's total splits into three destinations:
 *   debit  platform <sourceAccountType>  total        (where the funds arrived)
 *   credit cook     escrow               cook_payout   (held until escrow release)
 *   credit platform revenue              fees          (total − cook_payout − delivery)
 *   credit platform delivery_clearing    delivery_fee  (owed to the courier)
 *
 * `sourceAccountType` is the platform clearing account the money came from:
 *   - 'gateway_clearing' for card / gateway (Flutterwave) payments, where the
 *     webhook (or reconciliation) confirms the charge;
 *   - 'wallet_clearing'  for wallet-paid orders, where /wallet/pay already moved
 *     the funds user.wallet → platform.wallet_clearing, so capture drains that
 *     same clearing account into escrow/revenue/delivery (nets wallet_clearing
 *     back to 0 for the order).
 *
 * Zero legs are omitted (the ledger requires positive amounts). Runs on the
 * passed `sql` handle so the caller owns the transaction. Idempotent via the
 * per-order `ref` (`order-capture:<id>`), so a webhook + a reconciliation retry
 * can't double-post.
 *
 * @param {object} sql   postgres client or a tx handle from sql.begin
 * @param {object} order row carrying *_minor amounts, cook_id, currency_code, id
 * @param {{sourceAccountType?: 'gateway_clearing'|'wallet_clearing'}} [opts]
 */
async function postOrderCapture(sql, order, { sourceAccountType = 'gateway_clearing' } = {}) {
  const total    = Number(order.total_amount_minor ?? 0);
  const payout   = Number(order.cook_payout_minor ?? 0);
  const delivery = Number(order.delivery_fee_minor ?? 0);
  const revenue  = total - payout - delivery;
  if (total <= 0) return; // nothing to capture (e.g. free item, no delivery)

  const currency = order.currency_code ?? 'NGN';
  const source = await ledger.ensureAccount(sql, { ownerType: 'platform', accountType: sourceAccountType, currency });
  const legs = [{ accountId: source, direction: 'debit', amount_minor: total }];

  if (payout > 0) {
    const escrow = await ledger.ensureAccount(sql, { ownerType: 'cook', ownerId: order.cook_id, accountType: 'escrow', currency });
    legs.push({ accountId: escrow, direction: 'credit', amount_minor: payout });
  }
  if (revenue > 0) {
    const rev = await ledger.ensureAccount(sql, { ownerType: 'platform', accountType: 'revenue', currency });
    legs.push({ accountId: rev, direction: 'credit', amount_minor: revenue });
  }
  if (delivery > 0) {
    const deliveryClearing = await ledger.ensureAccount(sql, { ownerType: 'platform', accountType: 'delivery_clearing', currency });
    legs.push({ accountId: deliveryClearing, direction: 'credit', amount_minor: delivery });
  }

  await ledger.post(sql, {
    transactionId: crypto.randomUUID(),
    currency,
    entryType: 'order_capture',
    description: 'Order payment captured',
    ref: `order-capture:${order.id}`,
    legs,
  });
}

module.exports = { postOrderCapture };
