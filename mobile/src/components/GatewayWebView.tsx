import React from 'react';
import { ActivityIndicator, View, type StyleProp, type ViewStyle } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';

/**
 * The payment sheet's browser, for either rail.
 *
 * Flutterwave runs its inline form from `html` and reports through
 * postMessage. A hosted checkout (Bachs) loads `paymentLink` and ends by
 * navigating to our return page, /api/payments/return. That navigation is
 * turned into the same message the inline form sends, so the screens keep a
 * single onMessage handler. The message only closes the sheet: the screen
 * still verifies the payment with the server before fulfilling anything.
 */
export const PAYMENT_RETURN_PATH = '/api/payments/return';

export function hostedCheckoutOutcome(url: string): 'successful' | 'cancelled' | null {
  if (!url.includes(PAYMENT_RETURN_PATH) && !url.startsWith('foodsbyme://payment-complete')) return null;
  const query = url.split('?')[1] ?? '';
  const status = new URLSearchParams(query).get('status');
  return status === 'cancelled' ? 'cancelled' : 'successful';
}

export default function GatewayWebView({
  paymentLink, html, onMessage, style,
}: {
  paymentLink?: string | null;
  html: string;
  onMessage: (event: WebViewMessageEvent) => void;
  style?: StyleProp<ViewStyle>;
}) {
  // Synthesise the inline form's message from a hosted-checkout outcome.
  const report = (outcome: 'successful' | 'cancelled') => {
    const data = outcome === 'cancelled'
      ? { event: 'modal.closed', status: 'cancelled' }
      : { event: 'payment.completed', status: 'successful' };
    onMessage({ nativeEvent: { data: JSON.stringify(data) } } as WebViewMessageEvent);
  };

  return (
    <WebView
      source={paymentLink ? { uri: paymentLink } : { html }}
      onMessage={onMessage}
      onShouldStartLoadWithRequest={req => {
        const outcome = hostedCheckoutOutcome(req.url);
        if (outcome) { report(outcome); return false; }
        return true;
      }}
      javaScriptEnabled
      domStorageEnabled
      startInLoadingState
      renderLoading={() => (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" />
        </View>
      )}
      style={[{ flex: 1 }, style]}
    />
  );
}
