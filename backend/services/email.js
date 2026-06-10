const nodemailer = require('nodemailer');

const ADMIN_EMAIL = process.env.ADMIN_ALERT_EMAIL || 'aolusegun7@gmail.com';

let _transporter = null;
function transporter() {
  if (!_transporter) {
    _transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD,
      },
    });
  }
  return _transporter;
}

/**
 * Send a plain-text alert email to the admin address.
 * Silently logs on failure — never throws, so callers don't need try/catch.
 */
async function sendAdminAlert(subject, body) {
  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
    console.warn('[email] GMAIL_USER or GMAIL_APP_PASSWORD not set — skipping alert:', subject);
    return;
  }
  try {
    await transporter().sendMail({
      from: `"FOODSbyme Alerts" <${process.env.GMAIL_USER}>`,
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
