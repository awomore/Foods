import { useEffect } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { useColors } from '../../src/context/ThemeContext';

// The OAuth callback deep-links back into the app as
//   foodsbyme://social-verify/success?platform=…&handle=…
//   foodsbyme://social-verify/error?platform=…&reason=…
//
// The screen that started the flow is already listening for that URL with
// Linking.addEventListener — it shows the toast and reloads the account list.
// This route exists only so expo-router has somewhere to put the incoming URL.
// Without it the deep link matched no route, fell through to +not-found, and the
// creator's reward for approving on Instagram was an error screen.
//
// So render nothing and get out of the way: return to the screen that launched
// the browser, which still holds the result the listener just delivered. On a
// cold start there is no such screen, so send cooks to Connected Accounts —
// where the connection they just made is on display.
export default function SocialVerifyReturn() {
  const C = useColors();

  useEffect(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/(cook)/connected-accounts' as never);
  }, []);

  return <View style={{ flex: 1, backgroundColor: C.bg }} />;
}
