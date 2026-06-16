import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  RefreshControl, Modal, TextInput, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { cateringApi, type CateringEventType } from '../../src/api/catering';
import { Fonts, Spacing, Radius, Shadow } from '../../src/constants/theme';
import { useColors, type AppColors } from '../../src/context/ThemeContext';
import { useFeedback } from '../../src/components/feedback';
import { fmtCurrency } from '../../src/utils/format';

const EVENT_ICONS: Record<string, string> = {
  wedding: '💍', birthday: '🎂', corporate: '💼', graduation: '🎓',
  naming: '👶', anniversary: '🥂', funeral: '🕊️', other: '🎉',
};

const FILTER_TYPES: { key: string; label: string }[] = [
  { key: '',           label: 'All events' },
  { key: 'wedding',    label: 'Wedding' },
  { key: 'birthday',   label: 'Birthday' },
  { key: 'corporate',  label: 'Corporate' },
  { key: 'graduation', label: 'Graduation' },
  { key: 'other',      label: 'Other' },
];

type Brief = {
  id: string;
  event_type: CateringEventType;
  event_name: string | null;
  event_date: string;
  guest_count: number;
  venue_address: string;
  menu_description: string | null;
  dietary_requirements: string | null;
  bid_count: number;
  customer_name: string;
  budget_min: number | null;
  budget_max: number | null;
};

export default function CateringMarketplaceScreen() {
  const router = useRouter();
  const C = useColors();
  const styles = useMemo(() => makeStyles(C), [C]);
  const feedback = useFeedback();

  const [briefs, setBriefs] = useState<Brief[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filterType, setFilterType] = useState('');

  const [bidModal, setBidModal] = useState<Brief | null>(null);
  const [bidPrice, setBidPrice] = useState('');
  const [bidNotes, setBidNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const { briefs: data } = await cateringApi.marketplace({
        event_type: filterType || undefined,
        limit: 30,
      });
      setBriefs((data ?? []) as Brief[]);
    } catch (e) {
      console.error('catering marketplace error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filterType]);

  useEffect(() => { load(); }, [load]);

  async function handleBid() {
    if (!bidModal) return;
    const price = parseFloat(bidPrice.replace(/,/g, ''));
    if (!price || price <= 0) { feedback.warn('Price required', 'Enter your quoted price.'); return; }
    setSubmitting(true);
    try {
      await cateringApi.bid(bidModal.id, {
        quoted_price: price,
        notes: bidNotes.trim() || undefined,
        availability_confirmed: true,
      });
      setBidModal(null);
      setBidPrice('');
      setBidNotes('');
      // Update bid count in list
      setBriefs(prev => prev.map(b => b.id === bidModal.id ? { ...b, bid_count: b.bid_count + 1 } : b));
      feedback.success('Bid submitted!', 'The customer has been notified of your quote.');
    } catch (e: any) {
      feedback.error('Failed', e.error ?? 'Could not submit bid');
    } finally {
      setSubmitting(false);
    }
  }

  function fmtDate(dateStr: string) {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  const daysUntil = (dateStr: string) => {
    const d = Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000);
    if (d === 0) return 'Today';
    if (d === 1) return 'Tomorrow';
    if (d < 0) return 'Past';
    return `In ${d} days`;
  };

  return (
    <View style={styles.root}>
      {/* Bid modal */}
      <Modal visible={!!bidModal} transparent animationType="slide">
        <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' }}>
          <View style={{ backgroundColor: C.bgCard, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, gap: 14 }}>
            <Text style={{ fontFamily: Fonts.serif, fontSize: 20, color: C.textInk }}>Submit a bid</Text>
            {bidModal && (
              <View style={{ backgroundColor: C.bg, borderRadius: 12, padding: 12, gap: 4 }}>
                <Text style={{ fontFamily: Fonts.sansMedium, fontSize: 14, color: C.textInk }}>
                  {EVENT_ICONS[bidModal.event_type]} {bidModal.event_name ?? bidModal.event_type}
                </Text>
                <Text style={{ fontFamily: Fonts.sans, fontSize: 12, color: C.bodySoft }}>
                  {bidModal.guest_count} guests · {fmtDate(bidModal.event_date)}
                </Text>
              </View>
            )}
            <View style={{ gap: 4 }}>
              <Text style={{ fontFamily: Fonts.sansMedium, fontSize: 12, color: C.bodySoft }}>Your quoted price (₦) *</Text>
              <TextInput
                style={{ backgroundColor: C.bg, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
                  fontFamily: Fonts.serif, fontSize: 20, color: C.textInk, borderWidth: 0.5, borderColor: C.borderWarm }}
                placeholder="0.00"
                placeholderTextColor={C.bodySoft}
                value={bidPrice}
                onChangeText={setBidPrice}
                keyboardType="numeric"
              />
            </View>
            <View style={{ gap: 4 }}>
              <Text style={{ fontFamily: Fonts.sansMedium, fontSize: 12, color: C.bodySoft }}>Notes to customer (optional)</Text>
              <TextInput
                style={{ backgroundColor: C.bg, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10,
                  fontFamily: Fonts.sans, fontSize: 14, color: C.textInk, borderWidth: 0.5, borderColor: C.borderWarm,
                  minHeight: 70, textAlignVertical: 'top' }}
                placeholder="What's included, menu ideas, availability…"
                placeholderTextColor={C.bodySoft}
                value={bidNotes}
                onChangeText={setBidNotes}
                multiline
              />
            </View>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity
                onPress={() => setBidModal(null)}
                style={{ flex: 1, paddingVertical: 14, borderRadius: 14, alignItems: 'center',
                  borderWidth: 1, borderColor: C.borderWarm }}
              >
                <Text style={{ fontFamily: Fonts.sansMedium, fontSize: 15, color: C.body }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleBid}
                disabled={submitting}
                style={{ flex: 2, paddingVertical: 14, borderRadius: 14, alignItems: 'center', backgroundColor: C.spice }}
              >
                {submitting
                  ? <ActivityIndicator color="#FFF" size="small" />
                  : <Text style={{ fontFamily: Fonts.sansMedium, fontSize: 15, color: '#FFF' }}>Submit bid</Text>}
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
          <Text style={styles.headerTitle}>Catering Briefs</Text>
        </View>

        {/* Filter chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
          {FILTER_TYPES.map(f => (
            <TouchableOpacity
              key={f.key}
              onPress={() => setFilterType(f.key)}
              style={[styles.chip, filterType === f.key && styles.chipActive]}
            >
              <Text style={[styles.chipText, filterType === f.key && styles.chipTextActive]}>{f.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </SafeAreaView>

      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} />}
        contentContainerStyle={{ padding: Spacing.lg, gap: 14, paddingBottom: 40 }}
      >
        {loading ? (
          <View style={{ alignItems: 'center', paddingTop: 40 }}>
            <ActivityIndicator color={C.spice} />
          </View>
        ) : briefs.length === 0 ? (
          <View style={styles.empty}>
            <Text style={{ fontSize: 40 }}>🍽️</Text>
            <Text style={styles.emptyText}>No open briefs right now</Text>
            <Text style={styles.emptySub}>Check back soon — customers post catering requests here.</Text>
          </View>
        ) : (
          briefs.map(brief => {
            const urgency = daysUntil(brief.event_date);
            const isUrgent = new Date(brief.event_date).getTime() - Date.now() < 7 * 86400000;
            return (
              <View key={brief.id} style={styles.card}>
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
                  <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: C.cream, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ fontSize: 22 }}>{EVENT_ICONS[brief.event_type] ?? '🎉'}</Text>
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={styles.briefTitle}>
                      {brief.event_name ?? brief.event_type.charAt(0).toUpperCase() + brief.event_type.slice(1)}
                    </Text>
                    <Text style={styles.briefMeta}>
                      {brief.guest_count} guests · {fmtDate(brief.event_date)}
                    </Text>
                  </View>
                  <View style={[styles.urgencyPill, { backgroundColor: isUrgent ? '#FEF2F2' : C.cream }]}>
                    <Text style={{ fontFamily: Fonts.sansMedium, fontSize: 11, color: isUrgent ? '#DC2626' : C.spice }}>
                      {urgency}
                    </Text>
                  </View>
                </View>

                {brief.venue_address && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Ionicons name="location-outline" size={13} color={C.bodySoft} />
                    <Text style={styles.briefMeta} numberOfLines={1}>{brief.venue_address}</Text>
                  </View>
                )}

                {brief.menu_description && (
                  <Text style={styles.briefDesc} numberOfLines={3}>{brief.menu_description}</Text>
                )}

                {brief.dietary_requirements && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Ionicons name="leaf-outline" size={13} color={C.leaf} />
                    <Text style={[styles.briefMeta, { color: C.leaf }]} numberOfLines={1}>{brief.dietary_requirements}</Text>
                  </View>
                )}

                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
                  <Text style={styles.bidCount}>
                    {brief.bid_count === 0 ? 'No bids yet — be first!' : `${brief.bid_count} bid${brief.bid_count !== 1 ? 's' : ''} submitted`}
                  </Text>
                  <TouchableOpacity
                    style={styles.bidBtn}
                    onPress={() => setBidModal(brief)}
                  >
                    <Text style={styles.bidBtnText}>Place bid</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

function makeStyles(C: AppColors) { return StyleSheet.create({
  root:         { flex: 1, backgroundColor: C.bg },
  header:       { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.lg, paddingTop: 16, paddingBottom: 8, gap: 12 },
  headerTitle:  { flex: 1, fontFamily: Fonts.serif, fontSize: 22, color: C.textInk },

  filters:      { paddingHorizontal: Spacing.lg, paddingBottom: 12, gap: 8 },
  chip:         { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 40, backgroundColor: C.bgCard, borderWidth: 0.5, borderColor: C.borderWarm },
  chipActive:   { backgroundColor: C.ink, borderColor: 'transparent' },
  chipText:     { fontFamily: Fonts.sansMedium, fontSize: 13, color: C.body },
  chipTextActive: { color: C.canvas },

  card:         { backgroundColor: C.bgCard, borderRadius: Radius.lg, padding: 16, borderWidth: 0.5, borderColor: C.borderWarm, ...Shadow.card, gap: 10 },
  briefTitle:   { fontFamily: Fonts.sansMedium, fontSize: 15, color: C.textInk },
  briefMeta:    { fontFamily: Fonts.sans, fontSize: 12, color: C.bodySoft },
  briefDesc:    { fontFamily: Fonts.sans, fontSize: 13, color: C.body, lineHeight: 19 },
  urgencyPill:  { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 40 },

  bidCount:     { fontFamily: Fonts.sans, fontSize: 12, color: C.bodySoft },
  bidBtn:       { backgroundColor: C.spice, paddingHorizontal: 18, paddingVertical: 9, borderRadius: 20 },
  bidBtnText:   { fontFamily: Fonts.sansMedium, fontSize: 13, color: '#FFF' },

  empty:        { alignItems: 'center', paddingTop: 60, gap: 12, paddingHorizontal: 20 },
  emptyText:    { fontFamily: Fonts.sansMedium, fontSize: 16, color: C.textInk },
  emptySub:     { fontFamily: Fonts.sans, fontSize: 13, color: C.bodySoft, textAlign: 'center', lineHeight: 20 },
}); }
