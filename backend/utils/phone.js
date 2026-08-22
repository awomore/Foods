'use strict';

// Phone numbers reach us in whatever shape the caller typed: "08020745675",
// "2348020745675", "+234 802 074 5675". They are all the same person, so a bare
// equality on the phone column loses them — verify-otp would create a second
// account and the first became unreachable.
//
// The match key is the national significant number: the longest suffix every
// spelling of a number shares. A Nigerian mobile is 234 + ten digits, and the
// local form writes those same ten digits behind a leading 0 — so ten is the
// length that unifies them.
//
// It is deliberately NOT nine. The last nine digits of 0802 074 5675 and
// 0902 074 5675 are identical, and those are two different subscribers on two
// different networks; a nine-digit key would hand one person's account to
// another. Ten keeps the network prefix inside the key.
const PHONE_KEY_LENGTH = 10;

/** Strip every non-digit: "+234 802 074 5675" -> "2348020745675". */
function digitsOnly(phone) {
  return String(phone ?? '').replace(/\D/g, '');
}

/**
 * The value to compare two phone numbers on. Numbers shorter than the key
 * length are returned whole, which is what Postgres RIGHT(x, 10) also does —
 * the two sides must agree or the SQL and the JS would disagree about a match.
 * Returns '' for input with no digits at all; callers must not match on ''.
 */
function phoneKey(phone) {
  const digits = digitsOnly(phone);
  return digits.length > PHONE_KEY_LENGTH ? digits.slice(-PHONE_KEY_LENGTH) : digits;
}

module.exports = { digitsOnly, phoneKey, PHONE_KEY_LENGTH };
