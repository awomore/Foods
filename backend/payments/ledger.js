/**
 * ledger.js — double-entry ledger posting + balance derivation.
 *
 * Phase 3 of the payments architecture (see memory/payments_architecture.md).
 * Money movement is recorded as balanced sets of entries: every `post()` writes
 * >= 2 legs sharing a transaction_id whose debits equal their credits. An
 * account's balance is DERIVED by summing its entries — never stored — so the
 * ledger is the auditable source of truth.
 *
 * Amounts are integer minor units (kobo) + ISO-4217 currency, matching money.js.
 *
 * Every function that touches the DB takes an `sql` handle as its first argument
 * so callers can post inside their own transaction (postgres.js `sql.begin`),
 * keeping ledger writes atomic with the domain write that triggered them:
 *
 *   await sql.begin(async tx => {
 *     // ... debit a wallet ...
 *     await ledger.post(tx, { transactionId, entryType: 'wallet_pay', legs: [...] });
 *   });
 *
 * Schema lives in migration 049_ledger.sql.
 */

'use strict';

const { DEFAULT_CURRENCY } = require('./money');

const NIL_UUID = '00000000-0000-0000-0000-000000000000';

// ── pure validators (no DB — unit-testable) ──────────────────────────────────

/**
 * Assert a set of legs forms a valid balanced double-entry transaction:
 * at least two legs, each a positive integer minor amount in a single currency,
 * with total debits === total credits.
 * @param {{account_id?:string, accountId?:string, direction:'debit'|'credit', amount_minor:number}[]} legs
 */
function assertBalanced(legs) {
  if (!Array.isArray(legs) || legs.length < 2) {
    throw new Error('ledger: a transaction needs at least two legs');
  }
  let debit = 0;
  let credit = 0;
  for (const leg of legs) {
    if (leg.direction !== 'debit' && leg.direction !== 'credit') {
      throw new Error(`ledger: leg.direction must be 'debit' or 'credit', got "${leg.direction}"`);
    }
    if (!Number.isInteger(leg.amount_minor) || leg.amount_minor <= 0) {
      throw new Error(`ledger: leg.amount_minor must be a positive integer, got "${leg.amount_minor}"`);
    }
    if (leg.direction === 'debit') debit += leg.amount_minor;
    else credit += leg.amount_minor;
  }
  if (debit !== credit) {
    throw new Error(`ledger: unbalanced transaction — debits ${debit} !== credits ${credit}`);
  }
  return { debit, credit };
}

/**
 * Derive an account's signed balance (minor units) from its entry rows.
 * Convention: a credit increases the balance, a debit decreases it — so a
 * user-facing wallet is credited on top-up and debited on spend.
 * Accepts amount_minor as number or string (BIGINT arrives as a string).
 * @param {{direction:'debit'|'credit', amount_minor:number|string}[]} rows
 */
function balanceFromRows(rows) {
  let bal = 0;
  for (const r of rows) {
    const amt = typeof r.amount_minor === 'string' ? Number(r.amount_minor) : r.amount_minor;
    bal += r.direction === 'credit' ? amt : -amt;
  }
  return bal;
}

// ── DB operations (take an `sql` handle: base client or a tx from sql.begin) ──

/**
 * Find-or-create a ledger account and return its id.
 * @returns {Promise<string>} account id
 */
async function ensureAccount(sql, { ownerType, ownerId = null, accountType, currency = DEFAULT_CURRENCY }) {
  if (!ownerType || !accountType) throw new Error('ledger.ensureAccount: ownerType and accountType are required');
  // The ON CONFLICT target must textually match the unique index expression in
  // migration 049, which uses the nil-UUID as a LITERAL. Binding it as a
  // parameter (${NIL_UUID}) makes Postgres fail index inference with "no unique
  // or exclusion constraint matching the ON CONFLICT specification", so the
  // literal is inlined here on purpose (it is a constant, not user input).
  const rows = await sql`
    INSERT INTO ledger_accounts (owner_type, owner_id, account_type, currency)
    VALUES (${ownerType}, ${ownerId}, ${accountType}, ${currency})
    ON CONFLICT (owner_type, COALESCE(owner_id, '00000000-0000-0000-0000-000000000000'::uuid), account_type, currency)
    DO UPDATE SET owner_type = EXCLUDED.owner_type
    RETURNING id
  `;
  return rows[0].id;
}

/**
 * Post a balanced double-entry transaction. Validates the legs, then appends
 * one ledger_entries row per leg under a shared transaction_id.
 * @param {object} sql postgres client or transaction handle
 * @param {object} opts
 * @param {string} opts.transactionId shared id grouping the legs (UUID)
 * @param {string} [opts.currency='NGN']
 * @param {string} [opts.entryType]
 * @param {string} [opts.description]
 * @param {string} [opts.ref] business reference (idempotency/trace)
 * @param {{accountId:string, direction:'debit'|'credit', amount_minor:number}[]} opts.legs
 */
async function post(sql, { transactionId, currency = DEFAULT_CURRENCY, entryType = null, description = null, ref = null, legs }) {
  if (!transactionId) throw new Error('ledger.post: transactionId is required');
  assertBalanced(legs);
  for (const leg of legs) {
    await sql`
      INSERT INTO ledger_entries
        (transaction_id, account_id, direction, amount_minor, currency, entry_type, description, ref)
      VALUES
        (${transactionId}, ${leg.accountId}, ${leg.direction}, ${leg.amount_minor}, ${currency}, ${entryType}, ${description}, ${ref})
    `;
  }
  return { transactionId, legs: legs.length };
}

/**
 * Derive an account's current balance (minor units) from its entries.
 * @returns {Promise<number>} signed balance in minor units
 */
async function balanceOf(sql, accountId) {
  const rows = await sql`
    SELECT COALESCE(
      SUM(CASE direction WHEN 'credit' THEN amount_minor ELSE -amount_minor END), 0
    )::BIGINT AS balance
    FROM ledger_entries WHERE account_id = ${accountId}
  `;
  return Number(rows[0].balance);
}

module.exports = { assertBalanced, balanceFromRows, ensureAccount, post, balanceOf, NIL_UUID };
