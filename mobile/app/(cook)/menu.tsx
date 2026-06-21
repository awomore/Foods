import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, RefreshControl, Modal, TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/context/AuthContext';
import { menuApi } from '../../src/api/menu';
import { followsApi } from '../../src/api/follows';
import type { MenuItem } from '../../src/api/cooks';
import { Fonts, Spacing, Radius, Shadow } from '../../src/constants/theme';
import { useColors, type AppColors } from '../../src/context/ThemeContext';
import { useFeedback } from '../../src/components/feedback';
import { useTranslation } from 'react-i18next';
import { fmtCurrency } from '../../src/utils/format';
import DishPhoto from '../../src/components/ui/DishPhoto';
import { SkeletonDishCard } from '../../src/components/ui/Skeleton';

export default function CookMenuScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const C = useColors();
  const styles = useMemo(() => makeStyles(C), [C]);
  const { t: tl } = useTranslation();
  const [items, setItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const feedback = useFeedback();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showBroadcastModal, setShowBroadcastModal] = useState(false);
  const [broadcastType, setBroadcastType] = useState<'new_menu' | 'flash_sale'>('new_menu');
  const [discountPct, setDiscountPct] = useState('');
  const [broadcastMsg, setBroadcastMsg] = useState('');
  const [broadcasting, setBroadcasting] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!user?.cook_id) { setLoading(false); return; }
    if (!silent) setLoading(true);
    try {
      const { items: data } = await menuApi.byCook(user.cook_id);
      setItems(data ?? []);
    } catch (e) {
      console.error('cook menu load error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.cook_id]);

  useEffect(() => { load(); }, [load]);

  async function handleToggleActive(item: MenuItem) {
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, is_active: !i.is_active } : i));
    try {
      await menuApi.update(item.id, { is_active: !item.is_active });
    } catch (e: any) {
      setItems(prev => prev.map(i => i.id === item.id ? { ...i, is_active: item.is_active } : i));
      feedback.error('Error', e.message ?? 'Could not update dish');
    }
  }

  async function handleDelete(id: string) {
    feedback.confirm({
      title: 'Remove dish',
      message: 'This will remove the dish from your menu.',
      confirmLabel: 'Remove',
      danger: true,
      onConfirm: async () => {
        try {
          await menuApi.remove(id);
          setItems(prev => prev.filter(i => i.id !== id));
        } catch (e: any) {
          feedback.error('Error', e.message ?? 'Could not remove dish');
        }
      },
    });
  }

  async function handleBroadcast() {
    setBroadcasting(true);
    try {
      const { sent } = await followsApi.broadcast({
        type: broadcastType,
        message: broadcastMsg.trim() || undefined,
        discount_pct: broadcastType === 'flash_sale' && discountPct ? parseInt(discountPct) : undefined,
      });
      setShowBroadcastModal(false);
      setBroadcastMsg('');
      setDiscountPct('');
      feedback.success('Broadcast sent!', `Notified ${sent} follower${sent !== 1 ? 's' : ''}.`);
    } catch (e: any) {
      feedback.error('Failed', e.error ?? 'Could not send broadcast');
    } finally {
      setBroadcasting(false);
    }
  }

  const today = new Date().toISOString().split('T')[0];
  const todayItems = items.filter(i => i.available_date === today && i.is_active);
  const otherItems = items.filter(i => i.available_date !== today || !i.is_active);

  return (
    <View style={styles.root}>
      {/* Broadcast modal */}
      <Modal visible={showBroadcastModal} transparent animationType="slide">
        <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' }}>
          <View style={{ backgroundColor: C.bgCard, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, gap: 14 }}>
            <Text style={{ fontFamily: Fonts.serif, fontSize: 20, color: C.textInk }}>{tl('cook_menu.notify_followers')}</Text>

            {/* Type selector */}
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {(['new_menu', 'flash_sale'] as const).map(t => (
                <TouchableOpacity
                  key={t}
                  onPress={() => setBroadcastType(t)}
                  style={{ flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: 'center',
                    backgroundColor: broadcastType === t ? C.spice : C.bg,
                    borderWidth: 1, borderColor: broadcastType === t ? C.spice : C.borderWarm }}
                >
                  <Text style={{ fontFamily: Fonts.sansMedium, fontSize: 13,
                    color: broadcastType === t ? '#FFFFFF' : C.body }}>
                    {t === 'new_menu' ? `🍽️ ${tl('cook_menu.new_menu')}` : `⚡ ${tl('cook_menu.flash_sale')}`}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {broadcastType === 'flash_sale' && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <TextInput
                  style={{ flex: 1, backgroundColor: C.bg, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10,
                    fontFamily: Fonts.sans, fontSize: 14, color: C.textInk, borderWidth: 0.5, borderColor: C.borderWarm }}
                  placeholder={tl('cook_menu.discount')}
                  placeholderTextColor={C.bodySoft}
                  value={discountPct}
                  onChangeText={setDiscountPct}
                  keyboardType="numeric"
                />
                <Text style={{ fontFamily: Fonts.sansMedium, fontSize: 15, color: C.body }}>{tl('cook_menu.off')}</Text>
              </View>
            )}

            <TextInput
              style={{ backgroundColor: C.bg, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10,
                fontFamily: Fonts.sans, fontSize: 14, color: C.textInk, borderWidth: 0.5, borderColor: C.borderWarm,
                minHeight: 60, textAlignVertical: 'top' }}
              placeholder={broadcastType === 'new_menu' ? tl('cook_menu.fresh') : tl('cook_menu.limited')}
              placeholderTextColor={C.bodySoft}
              value={broadcastMsg}
              onChangeText={setBroadcastMsg}
              multiline
            />

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity
                onPress={() => setShowBroadcastModal(false)}
                style={{ flex: 1, paddingVertical: 14, borderRadius: 14, alignItems: 'center',
                  borderWidth: 1, borderColor: C.borderWarm }}
              >
                <Text style={{ fontFamily: Fonts.sansMedium, fontSize: 15, color: C.body }}>{tl('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleBroadcast}
                disabled={broadcasting}
                style={{ flex: 2, paddingVertical: 14, borderRadius: 14, alignItems: 'center',
                  backgroundColor: broadcastType === 'flash_sale' ? '#FF6B35' : C.ink }}
              >
                <Text style={{ fontFamily: Fonts.sansMedium, fontSize: 15, color: '#FFFFFF' }}>
                  {broadcasting ? tl('common.sending') : tl('cook_menu.send')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <SafeAreaView>
        <View style={styles.topBar}>
          <Text style={styles.pageTitle}>{tl('cook_menu.title')}</Text>
          <TouchableOpacity
            style={[styles.addBtn, { backgroundColor: C.bg, borderWidth: 1, borderColor: C.borderWarm, marginRight: 8 }]}
            onPress={() => setShowBroadcastModal(true)}
          >
            <Ionicons name="megaphone-outline" size={14} color={C.spice} />
            <Text style={[styles.addBtnText, { color: C.spice }]}>{tl('cook_menu.notify')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.addBtn} onPress={() => router.push('/cook/dish-form' as any)}>
            <Ionicons name="add" size={20} color={C.canvas} />
            <Text style={styles.addBtnText}>{tl('cook_menu.add')}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: Spacing.lg, gap: 12, paddingTop: 8 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} tintColor={C.spice} />
        }
      >
        {todayItems.length > 0 && (
          <View>
            <Text style={styles.sectionLabel}>{tl('cook_menu.on_menu')}</Text>
            {todayItems.map(item => (
              <View key={item.id} style={styles.featuredCard}>
                <DishPhoto
                  uri={item.photos?.[0] ?? null}
                  label={item.title}
                  height={160}
                  radius={12}
                  recyclingKey={item.id}
                />
                <View style={styles.featuredBody}>
                  <View style={styles.featuredTop}>
                    <View style={styles.liveTag}>
                      <View style={styles.liveDot} />
                      <Text style={styles.liveText}>{tl('cook_menu.live_today')}</Text>
                    </View>
                    <TouchableOpacity onPress={() => router.push({ pathname: '/cook/dish-form', params: { id: item.id } } as any)}>
                      <Ionicons name="pencil-outline" size={16} color={C.spice} />
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.featuredTitle}>{item.title}</Text>
                  <View style={styles.featuredMeta}>
                    <Text style={styles.featuredPrice}>{fmtCurrency(item.unit_price, item.currency_code)}</Text>
                    <View style={styles.slotPill}>
                      <Text style={styles.slotText}>
                        {item.total_slots - item.slots_claimed}/{item.total_slots} {tl('cook_menu.slots_left')}
                      </Text>
                    </View>
                  </View>
                </View>
              </View>
            ))}
          </View>
        )}

        {loading ? (
          <>
            <SkeletonDishCard />
            <SkeletonDishCard />
            <SkeletonDishCard />
            <SkeletonDishCard />
          </>
        ) : items.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="restaurant-outline" size={44} color={C.stone} />
            <Text style={styles.emptyText}>{tl('cook_menu.empty')}</Text>
            <Text style={styles.emptySub}>{tl('cook_menu.empty_hint')}</Text>
            <TouchableOpacity
              style={styles.emptyCtaBtn}
              onPress={() => router.push('/cook/dish-form' as any)}
            >
              <Ionicons name="add" size={16} color={C.canvas} />
              <Text style={styles.emptyCtaBtnText}>{tl('cook_menu.add_first')}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View>
            <Text style={styles.sectionLabel}>{tl('cook_menu.all')}</Text>
            {items.map(item => {
              const isExpanded = expandedId === item.id;
              return (
                <TouchableOpacity
                  key={item.id}
                  onPress={() => setExpandedId(isExpanded ? null : item.id)}
                  style={[styles.dishRow, !item.is_active && { opacity: 0.6 }]}
                  activeOpacity={0.8}
                >
                  <DishPhoto
                    uri={item.photos?.[0] ?? null}
                    label={item.title}
                    height={72}
                    width={72}
                    radius={10}
                    recyclingKey={item.id}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.dishTitle} numberOfLines={isExpanded ? undefined : 1}>{item.title}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 }}>
                      <Text style={styles.dishPrice}>{fmtCurrency(item.unit_price, item.currency_code)}</Text>
                      <View style={styles.slotMini}>
                        <Text style={styles.slotMiniText}>
                          {item.total_slots - item.slots_claimed} left
                        </Text>
                      </View>
                      {!item.is_active && (
                        <View style={[styles.slotMini, { backgroundColor: C.errorBg }]}>
                          <Text style={[styles.slotMiniText, { color: C.errorFg }]}>{tl('cook_menu.inactive')}</Text>
                        </View>
                      )}
                    </View>
                    {isExpanded && item.description && (
                      <Text style={styles.dishDesc}>{item.description}</Text>
                    )}
                  </View>
                  <View style={styles.dishActions}>
                    <TouchableOpacity style={styles.iconBtn} onPress={() => handleToggleActive(item)}>
                      <Ionicons
                        name={item.is_active ? 'eye-outline' : 'eye-off-outline'}
                        size={16}
                        color={C.bodySoft}
                      />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.iconBtn} onPress={() => handleDelete(item.id)}>
                      <Ionicons name="trash-outline" size={16} color={C.errorFg} />
                    </TouchableOpacity>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function makeStyles(C: AppColors) { return StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  topBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.lg, paddingTop: 16, paddingBottom: 12 },
  pageTitle: { fontFamily: Fonts.serif, fontSize: 26, color: C.textInk, flex: 1 },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: C.ink, borderRadius: 40, paddingHorizontal: 14, paddingVertical: 8 },
  addBtnText: { fontFamily: Fonts.sansMedium, fontSize: 13, color: C.canvas },

  sectionLabel: { fontFamily: Fonts.sansMedium, fontSize: 13, color: C.caps, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 },

  featuredCard: { backgroundColor: C.bgCard, borderRadius: Radius.lg, borderWidth: 0.5, borderColor: C.borderWarm, ...Shadow.card, overflow: 'hidden', marginBottom: 8 },
  featuredBody: { padding: 14, gap: 6 },
  featuredTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  liveTag: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  liveDot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: C.leaf },
  liveText: { fontFamily: Fonts.sansMedium, fontSize: 12, color: C.successFg },
  featuredTitle: { fontFamily: Fonts.sans, fontSize: 14, color: C.textInk, lineHeight: 20 },
  featuredMeta: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  featuredPrice: { fontFamily: Fonts.serif, fontSize: 18, color: C.spice },
  slotPill: { backgroundColor: C.honey, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 40 },
  slotText: { fontFamily: Fonts.sans, fontSize: 11, color: C.warnFg },

  dishRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, backgroundColor: C.bgCard, borderRadius: Radius.md, padding: 12, marginBottom: 8, borderWidth: 0.5, borderColor: C.borderWarm, ...Shadow.card },
  dishThumb: { width: 52, height: 52, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  dishThumbLabel: { fontFamily: Fonts.serifItalic, fontSize: 10, color: 'rgba(255, 255, 255,0.75)', textAlign: 'center', padding: 2 },
  dishTitle: { fontFamily: Fonts.sans, fontSize: 13, color: C.textInk, lineHeight: 18 },
  dishPrice: { fontFamily: Fonts.serif, fontSize: 15, color: C.spice },
  dishDesc: { fontFamily: Fonts.sans, fontSize: 12, color: C.bodySoft, lineHeight: 18, marginTop: 6 },
  slotMini: { backgroundColor: C.cream, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 40 },
  slotMiniText: { fontFamily: Fonts.sans, fontSize: 10, color: C.bodySoft },
  dishActions: { flexDirection: 'row', gap: 4, marginLeft: 'auto' },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },

  emptyState: { alignItems: 'center', paddingTop: 60, paddingHorizontal: Spacing.lg, gap: 12 },
  emptyText: { fontFamily: Fonts.sansMedium, fontSize: 16, color: C.textInk },
  emptySub: { fontFamily: Fonts.sans, fontSize: 13, color: C.bodySoft, textAlign: 'center', lineHeight: 20 },
  emptyCtaBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 40, backgroundColor: C.spice },
  emptyCtaBtnText: { fontFamily: Fonts.sansMedium, fontSize: 14, color: C.canvas },
}); }
