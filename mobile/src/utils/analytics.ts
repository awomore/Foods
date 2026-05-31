/** Fire-and-forget event tracking. Wire to PostHog / Amplitude in production. */
export function trackEvent(name: string, properties?: Record<string, unknown>) {
  if (__DEV__) {
    console.log('[Analytics]', name, properties);
  }
  // TODO: posthog.capture(name, properties);
}

/**
 * craving_to_publish_conversion — cook chose "Cook Now" or published a dish
 *   that had active cravings. Fire at the point of intent (Cook Now press).
 *
 * publish_to_order_conversion — an order was placed for a dish that had active
 *   cravings at publish time. Best tracked server-side; fire here if you have
 *   the signal client-side (e.g. after order confirmed on a previously-craved dish).
 */
