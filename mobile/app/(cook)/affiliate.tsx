import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  RefreshControl, Share, Modal, TextInput, Switch, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { affiliateApi, type AffiliateLink } from '../../src/api/affiliate';
import { Fonts, Spacing, Radius, Shadow } from '../../src/constants/theme';
import { useColors, type AppColors } from '../../src/context/ThemeContext';
import { useFeedback } from '../../src/components/feedback';
import { fmtCurrency, relativeTime } from '../../src/utils/format';

const BASE = 'https://foodsbyme.com/a';

export default function AffiliateScreen() {
  const router = useRouter();
  const C = useColors();
  const styles = useMemo(() => makeStyles(C), [C]);
  const feedback = useFeedback();

  const [links, setLinks] = useState<AffiliateLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);

  const [newUrl, setNewUrl] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newCommission, setNewCommission] = useState('10');

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const { links: data } = await affiliateApi.list();
      setLinks(data ?? []);
    } catch (e) {
      console.error('affiliate load error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleCreate() {
    if (!newUrl.trim()) { feedback.warn('URL required', 'Enter a destination URL.'); return; }
    setCreating(true);
    try {
      const { link } = await affiliateApi.create({
        url: newUrl.trim(),
        title: newTitle.trim() || undefined,
        description: newDesc.trim() || undefined,
        commission_rate: parseFloat(newCommission) || 10,
      });
      setLinks(prev => [link, ...prev]);
      setShowCreate(false);
      setNewUrl(''); setNewTitle(''); setNewDesc(''); setNewCommission('10');
      feedback.success('Link created!', `Share ${BASE}/${link.code} to earn commissions.`);
    } catch (e: any) {
      feedback.error('Failed', e.error ?? 'Could not create link');
    } finally {
      setCreating(false);
    }
  }

  async function handleShare(link: AffiliateLink) {
    const url = `${BASE}/${link.code}`;
    await Share.share({
      message: `${link.title ?? 'Check this out'} — ${url}`,
      url,
    });
  }

  async function handleToggle(link: AffiliateLink) {
    const next = !link.is_active;
    setLinks(prev => prev.map(l => l.id === link.id ? { ...l, is_active: next } : l));
    try {
      await affiliateApi.update(link.id, { is_active: next });
    } catch {
      setLinks(prev => prev.map(l => l.id === link.id ? { ...l, is_active: link.is_active } : l));
    }
  }

  const totalClicks   = links.reduce((s, l) => s + l.click_count, 0);
  const totalEarned   = links.reduce((s, l) => s + (l.total_earned ?? 0), 0);
  const totalConversions = links.reduce((s, l) => s + (l.conversion_count ?? 0), 0);

  return (
    <View style={styles.root}>
      {/* Create modal */}
      <Modal visible={showCreate} transparent animationType="slide">
        <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' }}>
          <View style={{ backgroundColor: C.bgCard, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, gap: 14 }}>
            <Text style={{ fontFamily: Fonts.serif, fontSize: 20, color: C.textInk }}>New affiliate link</Text>

            {[
              { label: 'Destination URL *', value: newUrl, onChange: setNewUrl, placeholder: 'https://…', keyboard: 'url' as const },
              { label: 'Link title', value: newTitle, onChange: setNewTitle, placeholder: 'e.g. My Cookbook' },
              { label: 'Description (optional)', value: newDesc, onChange: setNewDesc, placeholder: 'Short description…' },
              { label: 'Commission rate %', value: newCommission, onChange: setNewCommission, placeholder: '10', keyboard: 'numeric' as const },
            ].map(f => (
              <View key={f.label} style={{ gap: 4 }}>
                <Text style={{ fontFamily: Fonts.sansMedium, fontSize: 12, color: C.bodySoft }}>{f.label}</Text>
                <TextInput
                  style={{ backgroundColor: C.bg, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10,
                    fontFamily: Fonts.sans, fontSize: 14, color: C.textInk, borderWidth: 0.5, borderColor: C.borderWarm }}
                  placeholder={f.placeholder}
                  placeholderTextColor={C.bodySoft}
                  value={f.value}
                  onChangeText={f.onChange}
                  keyboardType={f.keyboard}
                  autoCapitalize="none"
                />
              </View>
            ))}

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity
                onPress={() => setShowCreate(false)}
                style={{ flex: 1, paddingVertical: 14, borderRadius: 14, alignItems: 'center',
                  borderWidth: 1, borderColor: C.borderWarm }}
              >
                <Text style={{ fontFamily: Fonts.sansMedium, fontSize: 15, color: C.body }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleCreate}
                disabled={creating}
                style={{ flex: 2, paddingVertical: 14, borderRadius: 14, alignItems: 'center', backgroundColor: C.ink }}
              >
                {creating
                  ? <ActivityIndicator color="#FFF" size="small" />
                  : <Text style={{ fontFamily: Fonts.sansMedium, fontSize: 15, color: '#FFFFFF' }}>Create link</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <SafeAreaView edges={['top']} style={{ backgroundColor: C.bg }}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={22} color={C.textInk} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Affiliate Links</Text>
          <TouchableOpacity
            style={{ backgroundColor: C.spice, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20 }}
            onPress={() => setShowCreate(true)}
          >
            <Text style={{ fontFamily: Fonts.sansMedium, fontSize: 13, color: '#FFF' }}>+ New</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} />}
        contentContainerStyle={{ padding: Spacing.lg, gap: 16, paddingBottom: 40 }}
      >
        {/* Summary cards */}
        <View style={{ flexDirection: 'row', gap: 10 }}>
          {[
            { label: 'Total clicks', value: totalClicks.toLocaleString() },
            { label: 'Conversions', value: totalConversions.toLocaleString() },
            { label: 'Total earned', value: fmtCurrency(totalEarned, 'NGN') },
          ].map(s => (
            <View key={s.label} style={[styles.statCard, { flex: 1 }]}>
              <Text style={styles.statLabel}>{s.label}</Text>
              <Text style={styles.statValue} numberOfLines={1}>{s.value}</Text>
            </View>
          ))}
        </View>

        {loading ? (
          <View style={{ alignItems: 'center', paddingTop: 40 }}>
            <ActivityIndicator color={C.spice} />
          </View>
        ) : links.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="link-outline" size={40} color={C.stone} />
            <Text style={styles.emptyText}>No affiliate links yet</Text>
            <Text style={styles.emptySub}>Create a link to start earning commissions when followers buy through your link.</Text>
          </View>
        ) : (
          links.map(link => {
            const shortUrl = `${BASE}/${link.code}`;
            const convRate = link.click_count > 0
              ? `${((link.conversion_count / link.click_count) * 100).toFixed(1)}%`
              : '—';
            return (
              <View key={link.id} style={styles.card}>
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
                  <View style={{ flex: 1, gap: 3 }}>
                    <Text style={styles.linkTitle}>{link.title ?? 'Untitled link'}</Text>
                    <Text style={styles.linkUrl} numberOfLines={1}>{shortUrl}</Text>
                    {link.description && (
                      <Text style={styles.linkDesc} numberOfLines={2}>{link.description}</Text>
                    )}
                  </View>
                  <Switch
                    value={link.is_active}
                    onValueChange={() => handleToggle(link)}
                    trackColor={{ true: C.spice, false: C.borderWarm }}
                    thumbColor="#FFF"
                  />
                </View>

                <View style={styles.statsRow}>
                  {[
                    { label: 'Clicks', value: link.click_count },
                    { label: 'Conv.', value: convRate },
                    { label: 'Earned', value: fmtCurrency(link.total_earned ?? 0, 'NGN') },
                    { label: `${link.commission_rate}% rate`, value: null },
                  ].map((s, i) => (
                    <View key={i} style={{ alignItems: 'center' }}>
                      <Text style={styles.statMiniVal}>{s.value ?? ''}</Text>
                      <Text style={styles.statMiniLabel}>{s.label}</Text>
                    </View>
                  ))}
                </View>

                <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
                  <TouchableOpacity
                    style={[styles.actionBtn, { flex: 2, backgroundColor: C.spice }]}
                    onPress={() => handleShare(link)}
                  >
                    <Ionicons name="share-outline" size={14} color="#FFF" />
                    <Text style={{ fontFamily: Fonts.sansMedium, fontSize: 13, color: '#FFF' }}>Share</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionBtn, { flex: 1, borderWidth: 1, borderColor: C.borderWarm }]}
                    onPress={async () => {
                      const { setStringAsync } = await import('expo-clipboard');
                      await setStringAsync(shortUrl);
                      feedback.success('Copied!', shortUrl);
                    }}
                  >
                    <Ionicons name="copy-outline" size={14} color={C.body} />
                    <Text style={{ fontFamily: Fonts.sans, fontSize: 13, color: C.body }}>Copy</Text>
                  </TouchableOpacity>
                </View>

                <Text style={styles.createdAt}>Created {relativeTime(link.created_at)}</Text>
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

function makeStyles(C: AppColors) { return StyleSheet.create({
  root:        { flex: 1, backgroundColor: C.bg },
  header:      { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.lg, paddingTop: 16, paddingBottom: 12, gap: 12 },
  headerTitle: { flex: 1, fontFamily: Fonts.serif, fontSize: 22, color: C.textInk },

  statCard:    { backgroundColor: C.bgCard, borderRadius: Radius.md, padding: 12, borderWidth: 0.5, borderColor: C.borderWarm, ...Shadow.card },
  statLabel:   { fontFamily: Fonts.sans, fontSize: 11, color: C.bodySoft, textTransform: 'uppercase', letterSpacing: 0.4 },
  statValue:   { fontFamily: Fonts.serif, fontSize: 17, color: C.textInk, marginTop: 3 },

  card:        { backgroundColor: C.bgCard, borderRadius: Radius.lg, padding: 16, borderWidth: 0.5, borderColor: C.borderWarm, ...Shadow.card, gap: 12 },
  linkTitle:   { fontFamily: Fonts.sansMedium, fontSize: 14, color: C.textInk },
  linkUrl:     { fontFamily: Fonts.sans, fontSize: 12, color: C.spice },
  linkDesc:    { fontFamily: Fonts.sans, fontSize: 12, color: C.bodySoft, lineHeight: 17 },

  statsRow:    { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderTopWidth: 0.5, borderBottomWidth: 0.5, borderColor: C.borderWarm },
  statMiniVal: { fontFamily: Fonts.sansMedium, fontSize: 13, color: C.textInk, textAlign: 'center' },
  statMiniLabel: { fontFamily: Fonts.sans, fontSize: 10, color: C.bodySoft, textAlign: 'center', marginTop: 1 },

  actionBtn:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 12 },
  createdAt:   { fontFamily: Fonts.sans, fontSize: 11, color: C.bodySoft },

  empty:       { alignItems: 'center', paddingTop: 60, gap: 12, paddingHorizontal: 20 },
  emptyText:   { fontFamily: Fonts.sansMedium, fontSize: 16, color: C.textInk },
  emptySub:    { fontFamily: Fonts.sans, fontSize: 13, color: C.bodySoft, textAlign: 'center', lineHeight: 20 },
}); }
