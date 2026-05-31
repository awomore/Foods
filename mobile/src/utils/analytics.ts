/**
 * FOODSbyme Analytics Client
 *
 * Responsibilities:
 *  - Assign and persist a session ID per app session.
 *  - Queue events locally and flush to /api/analytics/events in batches.
 *  - Persist the queue to AsyncStorage on failure so no events are lost.
 *  - Never throw — analytics must never break the main app flow.
 *
 * Usage:
 *   import { trackEvent, initAnalytics } from '../utils/analytics';
 *
 *   // On auth change (app startup / login / logout):
 *   initAnalytics(user?.id);
 *
 *   // In any screen or handler:
 *   trackEvent('dish_viewed', { source: 'home' }, { cook_id, item_id });
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const QUEUE_KEY      = '@foodsbyme:analytics_queue_v1';
const BATCH_SIZE     = 50;
const FLUSH_INTERVAL = 30_000; // ms
const MAX_QUEUE      = 500;    // cap to prevent unbounded memory use

const BASE_URL = (process.env.EXPO_PUBLIC_API_URL
  ?? 'https://foodsbyme-production.up.railway.app') + '/api';

// ── Types ──────────────────────────────────────────────────────────────────────

export interface TrackContext {
  cook_id?:  string;
  item_id?:  string;
  post_id?:  string;
  order_id?: string;
  story_id?: string;
}

interface QueuedEvent extends TrackContext {
  event_name:  string;
  session_id:  string;
  user_id?:    string;
  properties:  Record<string, unknown>;
  platform:    string;
  app_version: string;
  timestamp:   string;
}

// ── Module state ───────────────────────────────────────────────────────────────

let _sessionId: string | null = null;
let _userId:    string | null = null;
let _queue:     QueuedEvent[] = [];
let _timer:     ReturnType<typeof setInterval> | null = null;
let _flushing = false;
let _initialized = false;

// ── Helpers ────────────────────────────────────────────────────────────────────

function newSessionId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function getSessionId(): string {
  if (!_sessionId) _sessionId = newSessionId();
  return _sessionId;
}

// ── Public API ──────────────────────────────────────────────────────────────────

/**
 * Call on app start and whenever the authenticated user changes.
 * Restores any events queued from a previous session before they were sent.
 */
export async function initAnalytics(userId?: string | null) {
  _userId = userId ?? null;

  if (!_sessionId) _sessionId = newSessionId();

  // Restore events persisted from a previous crash/close
  if (!_initialized) {
    _initialized = true;
    try {
      const stored = await AsyncStorage.getItem(QUEUE_KEY);
      if (stored) {
        const saved = JSON.parse(stored) as QueuedEvent[];
        _queue.unshift(...saved.slice(0, MAX_QUEUE));
        await AsyncStorage.removeItem(QUEUE_KEY);
      }
    } catch { /* storage unavailable — start fresh */ }

    if (!_timer) {
      _timer = setInterval(flushQueue, FLUSH_INTERVAL);
    }
  }
}

/** Update the authenticated user without resetting the session. */
export function setAnalyticsUser(userId: string | null) {
  _userId = userId;
}

/** Start a new logical session (e.g., on app foreground after background). */
export function resetSession() {
  _sessionId = newSessionId();
}

/**
 * Track an event.
 * Fire-and-forget — never await this in UI code.
 *
 * @param name       Event name from the canonical taxonomy (see backend EVENTS set).
 * @param properties Arbitrary key/value metadata.
 * @param ctx        Entity IDs — cook, item, post, order, story.
 */
export function trackEvent(
  name: string,
  properties: Record<string, unknown> = {},
  ctx?: TrackContext,
): void {
  const event: QueuedEvent = {
    event_name:  name,
    session_id:  getSessionId(),
    ..._userId   ? { user_id: _userId } : {},
    ...ctx,
    properties,
    platform:    Platform.OS,
    app_version: '1.0.0',
    timestamp:   new Date().toISOString(),
  };

  _queue.push(event);

  if (__DEV__) {
    // eslint-disable-next-line no-console
    console.log('[Analytics]', name, { ...properties, ...ctx });
  }

  if (_queue.length >= BATCH_SIZE) {
    flushQueue();
  }
}

/** Flush any remaining events. Call on graceful app close. */
export function shutdownAnalytics(): void {
  if (_timer) {
    clearInterval(_timer);
    _timer = null;
  }
  flushQueue();
}

// ── Internal flush ──────────────────────────────────────────────────────────────

async function flushQueue(): Promise<void> {
  if (_flushing || _queue.length === 0) return;
  _flushing = true;

  const batch = _queue.splice(0, BATCH_SIZE);

  try {
    const token = await AsyncStorage.getItem('auth_token');
    const res = await fetch(`${BASE_URL}/analytics/events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ events: batch }),
    });
    // Non-2xx: put events back for retry
    if (!res.ok) {
      _queue.unshift(...batch);
    }
  } catch {
    // Network failure: put back and persist to AsyncStorage for next session
    _queue.unshift(...batch);
    if (_queue.length > MAX_QUEUE) _queue.length = MAX_QUEUE;
    AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(_queue.slice(0, 200))).catch(() => {});
  } finally {
    _flushing = false;
  }
}
