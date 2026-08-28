'use strict';

// How long after delivery a customer can still raise a dispute.
//
// This lived as three separate literals — 30 minutes in disputes.js, 30 in
// orders.js as minutes, and a bare `30 * 60000` further down the same file —
// while the Terms page promised 24 hours and the support FAQ promised something
// different again. Four copies of one rule is how they came to disagree. It is
// one constant now, and the website quotes this number rather than its own.
const DISPUTE_WINDOW_HOURS = 24;
const DISPUTE_WINDOW_MS = DISPUTE_WINDOW_HOURS * 60 * 60 * 1000;

/** When the window closes for an order delivered at `from` (default: now). */
function disputeWindowClosesAt(from = new Date()) {
  return new Date(new Date(from).getTime() + DISPUTE_WINDOW_MS);
}

module.exports = { DISPUTE_WINDOW_HOURS, DISPUTE_WINDOW_MS, disputeWindowClosesAt };
