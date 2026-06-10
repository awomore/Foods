'use strict';
const { sql } = require('../supabase/db');

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const EXPO_CHUNK_SIZE = 100;

/**
 * Send push notifications via Expo Push API.
 * tokens   — array of Expo push tokens
 * payload  — { title, body, data? }
 */
async function sendPush(tokens, payload) {
  if (!tokens.length) return;

  const messages = tokens.map(t => ({
    to: t,
    sound: 'default',
    title: payload.title,
    body: payload.body,
    data: payload.data ?? {},
    priority: 'high',
  }));

  // Expo requires batches of ≤100
  for (let i = 0; i < messages.length; i += EXPO_CHUNK_SIZE) {
    const chunk = messages.slice(i, i + EXPO_CHUNK_SIZE);
    try {
      const res = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(chunk),
      });
      if (!res.ok) {
        const text = await res.text();
        console.error('[push] Expo push error:', res.status, text);
      }
    } catch (e) {
      console.error('[push] Network error sending push:', e.message);
    }
  }
}

/**
 * Look up push tokens for one or more user IDs and send them a notification.
 * Silently skips users with no push token.
 */
async function notifyUsers(userIds, payload) {
  if (!userIds.length) return;
  try {
    const rows = await sql`
      SELECT push_token FROM users
      WHERE id = ANY(${userIds}::uuid[]) AND push_token IS NOT NULL AND push_token != ''
    `;
    const tokens = rows.map(r => r.push_token);
    if (tokens.length) await sendPush(tokens, payload);
  } catch (e) {
    console.error('[push] notifyUsers error:', e.message);
  }
}

/**
 * Insert an in-app notification row AND send a push notification in parallel.
 */
async function notifyAndPush(userId, type, title, body, data = {}) {
  const notifInsert = sql`
    INSERT INTO notifications (user_id, type, title, body, data)
    VALUES (${userId}, ${type}, ${title}, ${body}, ${data}::jsonb)
  `.catch(e => console.error('[push] notif insert error:', e.message));

  const pushSend = notifyUsers([userId], { title, body, data });

  await Promise.all([notifInsert, pushSend]);
}

module.exports = { sendPush, notifyUsers, notifyAndPush };
