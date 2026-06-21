import React, { useState, useMemo, useCallback } from 'react';
import {
  View, Text, TextInput, FlatList, TouchableOpacity,
  StyleSheet, StatusBar, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Updates from 'expo-updates';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useLocale } from '../src/context/LocaleContext';
import { COUNTRIES, type Country } from '../src/i18n/countries';
import { SUPPORTED_LANGS } from '../src/i18n/setup';
import { Fonts, Radius, Spacing } from '../src/constants/theme';

const SPICE = '#FF6B35';
const INK = '#111827';
const BODY = '#4B5563';
const BORDER = '#E5E7EB';
const BG = '#FFFFFF';
const SELECTED_BG = '#FFF1EB';

// Group countries: Nigeria first, then alphabetical
const NIGERIA_FIRST = [
  COUNTRIES.find(c => c.code === 'NG')!,
  ...COUNTRIES.filter(c => c.code !== 'NG').sort((a, b) => a.name.localeCompare(b.name)),
];

export default function SelectLanguageScreen() {
  const { t } = useTranslation();
  const { changeLanguage, language } = useLocale();
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Country | null>(null);
  const [loading, setLoading] = useState(false);

  const filtered = useMemo(() => {
    if (!query.trim()) return NIGERIA_FIRST;
    const q = query.toLowerCase();
    return NIGERIA_FIRST.filter(c =>
      c.name.toLowerCase().includes(q) ||
      c.code.toLowerCase().includes(q) ||
      (SUPPORTED_LANGS[c.lang]?.nativeLabel ?? '').toLowerCase().includes(q)
    );
  }, [query]);

  const handleSelect = useCallback((country: Country) => {
    setSelected(country);
  }, []);

  const handleContinue = useCallback(async () => {
    if (!selected || loading) return;
    setLoading(true);
    try {
      const { needsReload } = await changeLanguage(selected.lang);
      if (needsReload && !__DEV__) {
        await Updates.reloadAsync();
      } else {
        router.replace('/');
      }
    } catch {
      router.replace('/');
    } finally {
      setLoading(false);
    }
  }, [selected, loading, changeLanguage, router]);

  const langInfo = selected ? SUPPORTED_LANGS[selected.lang] : null;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <StatusBar barStyle="dark-content" backgroundColor={BG} />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.logo}>FOODS</Text>
        <Text style={styles.title}>{t('lang.select_title')}</Text>
        <Text style={styles.subtitle}>{t('lang.select_subtitle')}</Text>
      </View>

      {/* Search */}
      <View style={styles.searchRow}>
        <Ionicons name="search" size={16} color={BODY} style={{ marginRight: 8 }} />
        <TextInput
          style={styles.searchInput}
          placeholder={t('lang.search')}
          placeholderTextColor="#9CA3AF"
          value={query}
          onChangeText={setQuery}
          autoCorrect={false}
          autoCapitalize="none"
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => setQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="close-circle" size={16} color="#9CA3AF" />
          </TouchableOpacity>
        )}
      </View>

      {/* Country list */}
      <FlatList
        data={filtered}
        keyExtractor={item => item.code}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.list}
        renderItem={({ item }) => {
          const isChosen = selected?.code === item.code;
          const lang = SUPPORTED_LANGS[item.lang];
          return (
            <TouchableOpacity
              style={[styles.row, isChosen && styles.rowSelected]}
              onPress={() => handleSelect(item)}
              activeOpacity={0.7}
            >
              <Text style={styles.flag}>{item.flag}</Text>
              <View style={styles.rowBody}>
                <Text style={[styles.countryName, isChosen && styles.countryNameSelected]}>
                  {item.name}
                </Text>
                {lang && (
                  <Text style={[styles.langLabel, isChosen && styles.langLabelSelected]}>
                    {lang.nativeLabel}
                  </Text>
                )}
              </View>
              {isChosen && (
                <Ionicons name="checkmark-circle" size={20} color={SPICE} />
              )}
            </TouchableOpacity>
          );
        }}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />

      {/* Footer / Continue */}
      <View style={styles.footer}>
        {selected && langInfo && (
          <View style={styles.selectedBadge}>
            <Text style={styles.selectedFlag}>{selected.flag}</Text>
            <Text style={styles.selectedText}>
              {selected.name} · {langInfo.nativeLabel}
            </Text>
          </View>
        )}
        <TouchableOpacity
          style={[styles.btn, (!selected || loading) && styles.btnDisabled]}
          onPress={handleContinue}
          disabled={!selected || loading}
          activeOpacity={0.85}
        >
          <Text style={styles.btnText}>
            {loading ? '…' : t('lang.continue')}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BG },
  header: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 12 },
  logo: { fontFamily: Fonts.sansMedium, fontSize: 13, color: SPICE, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 12 },
  title: { fontFamily: Fonts.sansMedium, fontSize: 24, color: INK, marginBottom: 4 },
  subtitle: { fontFamily: Fonts.sans, fontSize: 14, color: BODY },
  searchRow: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 24, marginBottom: 8, backgroundColor: '#F9FAFB', borderRadius: Radius.md, borderWidth: 1, borderColor: BORDER, paddingHorizontal: 12, paddingVertical: 10 },
  searchInput: { flex: 1, fontFamily: Fonts.sans, fontSize: 14, color: INK },
  list: { paddingHorizontal: 24, paddingBottom: 8 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 12, borderRadius: Radius.md },
  rowSelected: { backgroundColor: SELECTED_BG },
  flag: { fontSize: 24, marginRight: 12 },
  rowBody: { flex: 1 },
  countryName: { fontFamily: Fonts.sansMedium, fontSize: 15, color: INK },
  countryNameSelected: { color: SPICE },
  langLabel: { fontFamily: Fonts.sans, fontSize: 12, color: BODY, marginTop: 1 },
  langLabelSelected: { color: SPICE },
  separator: { height: 1, backgroundColor: BORDER, marginLeft: 48 },
  footer: { paddingHorizontal: 24, paddingBottom: Platform.OS === 'android' ? 24 : 8, paddingTop: 12, borderTopWidth: 1, borderTopColor: BORDER, gap: Spacing.sm },
  selectedBadge: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: SELECTED_BG, borderRadius: Radius.md, paddingHorizontal: 12, paddingVertical: 8 },
  selectedFlag: { fontSize: 18 },
  selectedText: { fontFamily: Fonts.sansMedium, fontSize: 13, color: SPICE },
  btn: { backgroundColor: SPICE, borderRadius: Radius.md, paddingVertical: 16, alignItems: 'center' },
  btnDisabled: { backgroundColor: '#FFC4A8' },
  btnText: { fontFamily: Fonts.sansMedium, fontSize: 16, color: '#FFFFFF', letterSpacing: 0.2 },
});
