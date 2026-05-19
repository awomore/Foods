const { sql } = require('../supabase/db');

/**
 * Calculate platform commission for an order.
 * Rate is stored in platform_settings and defaults to 3.75%.
 */
async function calculateCommission(subtotal) {
  const rows = await sql`
    SELECT value FROM platform_settings WHERE key = 'commission_rate'
  `;
  const rate = rows[0] ? parseFloat(rows[0].value) : 0.0375;
  const platformFee = Math.round(subtotal * rate * 100) / 100;
  const cookPayout = Math.round((subtotal - platformFee) * 100) / 100;

  return { subtotal, platformFee, cookPayout, commissionRate: rate };
}

module.exports = { calculateCommission };
