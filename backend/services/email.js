const { Resend } = require('resend');

const FROM = 'FOODSbyme Alerts <alerts@foodsbyme.com>';
const ADMIN_EMAIL = process.env.ADMIN_ALERT_EMAIL || 'aolusegun7@gmail.com';

let _client = null;
function client() {
  if (!_client) _client = new Resend(process.env.RESEND_API_KEY);
  return _client;
}

/**
 * Send a plain-text alert email to the admin address.
 * Silently logs on failure — never throws, so callers don't need try/catch.
 */
async function sendAdminAlert(subject, body) {
  if (!process.env.RESEND_API_KEY || process.env.RESEND_API_KEY.startsWith('re_xxx')) {
    console.warn('[email] RESEND_API_KEY not set — skipping alert:', subject);
    return;
  }
  try {
    await client().emails.send({
      from: FROM,
      to: ADMIN_EMAIL,
      subject,
      text: body,
    });
    console.log(`[email] Alert sent: ${subject}`);
  } catch (err) {
    console.error('[email] Failed to send alert:', err.message);
  }
}

module.exports = { sendAdminAlert };
