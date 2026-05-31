/**
 * Analytics service — server-side event emission.
 *
 * Design principles:
 *  - Fire-and-forget: callers should NOT await emitEvent in request handlers.
 *  - Non-fatal: any DB error is caught and logged; the main request never fails.
 *  - Whitelist: unknown event names are silently dropped to prevent schema drift.
 */
const { sql } = require('../supabase/db');

// ── Canonical event taxonomy ──────────────────────────────────────────────────
const EVENTS = new Set([
  // Discovery & browsing
  'screen_viewed',
  'cook_profile_viewed',
  'dish_viewed',
  'search_performed',
  'feed_viewed',
  'post_viewed',
  'story_viewed',
  'discover_filtered',
  // Engagement
  'dish_liked',
  'dish_unliked',
  'post_liked',
  'post_unliked',
  'post_commented',
  'post_shared',
  'post_bookmarked',
  'post_unbookmarked',
  'post_order_cta_tapped',  // "Order This" CTA on a post
  'cook_followed',
  'cook_unfollowed',
  'craving_submitted',
  'craving_shared',
  'wishlist_added',
  'waitlist_joined',
  'review_submitted',
  'tip_added',
  // Order funnel
  'cart_item_added',
  'cart_item_removed',
  'checkout_started',
  'checkout_abandoned',
  'payment_initiated',
  'order_placed',
  'order_cancelled',
  'order_delivered',
  // Cook actions
  'menu_item_created',
  'meal_plan_published',
  'order_accepted',
  'order_marked_ready',
  'order_marked_delivered',
  'post_published',
  'post_scheduled',
  'post_draft_saved',
  'story_published',
  'cook_went_live',
  'cook_went_offline',
  'payout_requested',
  'advance_applied',
  'craving_fulfilled',
  'craving_to_publish_conversion',  // cook taps "Cook Now" on a craved dish
  // Account & lifecycle
  'session_started',
  'app_opened',
  'onboarding_completed',
  'profile_updated',
  'notification_tapped',
  // Gifting & loyalty
  'gift_card_purchased',
  'group_gift_created',
  'group_gift_contributed',
  'loyalty_points_redeemed',
  'spin_completed',
]);

/**
 * Emit a single event from server-side route handlers.
 *
 * Usage (fire-and-forget):
 *   analytics.emitEvent({ event_name: 'order_placed', user_id, cook_id, order_id,
 *                          properties: { amount } }).catch(() => {});
 *
 * @param {object} opts
 * @param {string} opts.event_name - Must be in the EVENTS whitelist.
 * @param {string} [opts.user_id]
 * @param {string} [opts.session_id]
 * @param {string} [opts.cook_id]
 * @param {string} [opts.item_id]
 * @param {string} [opts.post_id]
 * @param {string} [opts.order_id]
 * @param {string} [opts.story_id]
 * @param {object} [opts.properties]
 * @param {string} [opts.platform]
 * @param {string} [opts.app_version]
 */
async function emitEvent({
  event_name,
  user_id      = null,
  session_id   = null,
  cook_id      = null,
  item_id      = null,
  post_id      = null,
  order_id     = null,
  story_id     = null,
  properties   = {},
  platform     = 'server',
  app_version  = null,
} = {}) {
  if (!EVENTS.has(event_name)) return; // unknown event — drop silently
  try {
    await sql`
      INSERT INTO analytics_events
        (event_name, user_id, session_id,
         cook_id, item_id, post_id, order_id, story_id,
         properties, platform, app_version)
      VALUES (
        ${event_name},
        ${user_id},
        ${session_id},
        ${cook_id},
        ${item_id},
        ${post_id},
        ${order_id},
        ${story_id},
        ${JSON.stringify(properties)}::jsonb,
        ${platform},
        ${app_version}
      )
    `;
  } catch (err) {
    console.error('[Analytics] emitEvent failed:', event_name, err.message);
  }
}

/**
 * Insert a batch of events from the mobile client.
 * Each event object must have at minimum: event_name, platform, timestamp.
 * Unknown event names are filtered out. Max 200 events per call.
 *
 * @param {object[]} events
 * @param {string|null} serverUserId - user_id verified from JWT (overrides client value)
 * @returns {Promise<number>} count of events inserted
 */
async function emitBatch(events, serverUserId = null) {
  if (!Array.isArray(events) || events.length === 0) return 0;

  const valid = events
    .slice(0, 200)
    .filter(ev => EVENTS.has(ev.event_name));

  let inserted = 0;
  for (const ev of valid) {
    await emitEvent({
      event_name:  ev.event_name,
      user_id:     serverUserId ?? ev.user_id ?? null,
      session_id:  ev.session_id ?? null,
      cook_id:     ev.cook_id    ?? null,
      item_id:     ev.item_id    ?? null,
      post_id:     ev.post_id    ?? null,
      order_id:    ev.order_id   ?? null,
      story_id:    ev.story_id   ?? null,
      properties:  ev.properties ?? {},
      platform:    ev.platform   ?? 'unknown',
      app_version: ev.app_version ?? null,
    });
    inserted++;
  }
  return inserted;
}

module.exports = { emitEvent, emitBatch, EVENTS };
