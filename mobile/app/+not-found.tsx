import { Link, Stack } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useColors } from '../src/context/ThemeContext';
import AppText from '../src/components/ui/Text';
import { useTranslation } from 'react-i18next';

export default function NotFoundScreen() {
  const C = useColors();
  const { t } = useTranslation();
  return (
    <>
      <Stack.Screen options={{ title: t('not_found.title') }} />
      <View style={[styles.container, { backgroundColor: C.canvas }]}>
        <AppText style={[styles.title, { color: C.ink }]}>{t('not_found.body')}</AppText>
        <Link href="/" style={styles.link}>
          <AppText style={[styles.linkText, { color: C.spice }]}>{t('not_found.home')}</AppText>
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
