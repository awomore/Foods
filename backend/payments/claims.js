'use strict';

const { orchestrator } = require('./orchestrator');
const { toMinor } = require('./money');

/**
 * One payment, one purchase (migration 069).
 *
 * A gateway charge proves money arrived; it says nothing about whether that
 * money has already bought something. Every route that sells against a tx_ref
 * does two things:
 *
 *   1. verifyPayment() — outside any transaction (it is a network call): the
 *      charge succeeded, in the expected currency, for at least the price, and
 *      was not paid by someone else.
 *   2. consumeClaim()  — inside the transaction that grants the purchase: spend
 *      `useMinor` of the payment. The guarded UPDATE refuses if the reference
 *      belongs to another purpose or user, or if it would be overspent, so a
 *      reference can never back more than it paid for, even under concurrency.
 */

class PaymentError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

/**
 * Verify a gateway charge against what it is supposed to pay for.
 * Throws PaymentError (with an HTTP status) when it doesn't hold up.
 *
 * In dev mode (no live connector) the orchestrator mocks every charge as
 * successful. That is fine locally and fatal in production -- a lost secret
 * would make everything free -- so production refuses mocked verification.
 *
 * @param {{reference:string, userId:string, currency:string, amountMinor:number}} p
 * @returns {Promise<{paidMinor:number, devMode:boolean}>} how much the charge paid
 */
async function verifyPayment({ reference, userId, currency, amountMinor }, { verify, isProduction = process.env.NODE_ENV === 'production' } = {}) {
  if (!reference) throw new PaymentError(400, 'tx_ref is required');
  const status = await (verify ?? ((ref) => orchestrator.verifyCharge(ref)))({ reference });

  if (status.devMode) {
    if (isProduction) throw new PaymentError(503, 'Payments are temporarily unavailable');
    return { paidMinor: amountMinor, devMode: true };
  }
  if (!status.successful) throw new PaymentError(400, 'Payment verification failed');
  if (String(status.currency ?? '').toUpperCase() !== currency) {
    throw new PaymentError(400, `Payment was made in ${status.currency ?? 'an unknown currency'}, not ${currency}`);
  }
  const paidMinor = toMinor(status.amount ?? 0, currency);
  if (paidMinor < amountMinor) throw new PaymentError(400, 'Payment amount is less than the price');
  // The payer is whoever the charge's meta names. App builds before 2026-09-22
  // open the inline checkout without meta, so a charge that names nobody is
  // accepted; one that names someone else never is. Make this strict once
  // every build in use sends meta.user_id.
  const payer = status.meta?.user_id;
  if (payer != null && payer !== userId) {
    throw new PaymentError(403, 'Payment reference does not belong to this account');
  }
  return { paidMinor, devMode: false };
}

/**
 * Spend `useMinor` of the payment `reference` for `purpose`, inside the caller's
 * transaction. The first use opens the claim with the payment's total
 * (`paidMinor`); later uses of the same reference for the same purpose and user
 * draw it down (a multi-cook cart is several orders on one payment).
 *
 * Throws PaymentError 409 if the reference was used for something else, by
 * someone else, in another currency, or has no room left for `useMinor`.
 *
 * @param {object} sql tx handle from sql.begin
 * @param {{reference:string, purpose:string, userId:string, currency:string, paidMinor:number, useMinor:number}} p
 */
async function consumeClaim(sql, { reference, purpose, userId, currency, paidMinor, useMinor }) {
  await sql`
    INSERT INTO payment_claims (reference, purpose, user_id, currency, amount_minor)
    VALUES (${reference}, ${purpose}, ${userId}, ${currency}, ${paidMinor})
    ON CONFLICT (reference) DO NOTHING
  `;
  const rows = await sql`
    UPDATE payment_claims
    SET consumed_minor = consumed_minor + ${useMinor}, updated_at = NOW()
    WHERE reference = ${reference} AND purpose = ${purpose} AND user_id = ${userId}
      AND currency = ${currency} AND consumed_minor + ${useMinor} <= amount_minor
    RETURNING consumed_minor
  `;
  if (rows.length) return;

  const [claim] = await sql`SELECT purpose, user_id, currency FROM payment_claims WHERE reference = ${reference}`;
  const sameUse = claim && claim.purpose === purpose && claim.user_id === userId && claim.currency === currency;
  throw new PaymentError(409, sameUse ? 'This payment does not cover the amount' : 'This payment has already been used');
}

module.exports = { PaymentError, verifyPayment, consumeClaim };
