import { Link, Stack } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useColors } from '../src/context/ThemeContext';
import { Text as AppText } from '../src/components/ui/Text';

export default function NotFoundScreen() {
  const C = useColors();
  return (
    <>
      <Stack.Screen options={{ title: 'Oops!' }} />
      <View style={[styles.container, { backgroundColor: C.canvas }]}>
        <AppText style={[styles.title, { color: C.ink }]}>This screen doesn't exist.</AppText>
        <Link href="/" style={styles.link}>
          <AppText style={[styles.linkText, { color: C.spice }]}>Go to home screen</AppText>
        </Link>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },
  title: { fontSize: 20, fontWeight: 'bold' },
  link: { marginTop: 15, paddingVertical: 15 },
  linkText: { fontSize: 14 },
});
