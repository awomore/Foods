import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/context/AuthContext';
import { menuApi } from '../../src/api/menu';
import type { MenuItem } from '../../src/api/cooks';
import { Fonts, Spacing, Radius, Shadow } from '../../src/constants/theme';
import { useColors, type AppColors } from '../../src/context/ThemeContext';
import { fmtCurrency } from '../../src/utils/format';
import DishPhoto from '../../src/components/ui/DishPhoto';

export default function CookMenuScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const C = useColors();
  const styles = useMemo(() => makeStyles(C), [C]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

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
    try {
      await menuApi.update(item.id, { is_active: !item.is_active });
      setItems(prev => prev.map(i => i.id === item.id ? { ...i, is_active: !i.is_active } : i));
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'Could not update dish');
    }
  }

  async function handleDelete(id: string) {
    Alert.alert('Remove dish', 'This will remove the dish from your menu.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive',
        onPress: async () => {
          try {
            await menuApi.remove(id);
            setItems(prev => prev.filter(i => i.id !== id));
          } catch (e: any) {
            Alert.alert('Error', e.message ?? 'Could not remove dish');
          }
        },
      },
    ]);
  }

  const today = new Date().toISOString().split('T')[0];
  const todayItems = items.filter(i => i.available_date === today && i.is_active);
  const otherItems = items.filter(i => i.available_date !== today || !i.is_active);

  if (loading) {
    return (
      <View style={[styles.root, { alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator color={C.spice} />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <SafeAreaView>
        <View style={styles.topBar}>
          <Text style={styles.pageTitle}>My menu</Text>
          <TouchableOpacity style={styles.addBtn} onPress={() => router.push('/cook/dish-form' as any)}>
            <Ionicons name="add" size={20} color={C.canvas} />
            <Text style={styles.addBtnText}>Add dish</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: Spacing.lg, gap: 12, paddingTop: 8 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} tintColor={C.spice} />
        }
      >
        {todayItems.length > 0 && (
          <View>
            <Text style={styles.sectionLabel}>On the menu today</Text>
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
                      <Text style={styles.liveText}>Live today</Text>
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
                        {item.total_slots - item.slots_claimed}/{item.total_slots} slots left
                      </Text>
                    </View>
                  </View>
                </View>
              </View>
            ))}
          </View>
        )}

        {items.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="restaurant-outline" size={40} color={C.stone} />
            <Text style={styles.emptyText}>No dishes yet</Text>
            <Text style={styles.emptySub}>Add your first dish to start taking orders</Text>
          </View>
        ) : (
          <View>
            <Text style={styles.sectionLabel}>All dishes</Text>
            {items.map(item => {
              const isExpanded = expandedId === item.id;
              return (
                <TouchableOpacity
                  key={item.id}
                  onPress={() => setExpandedId(isExpanded ? null : item.id)}
                  style={[styles.dishRow, !item.is_active && { opacity: 0.6 }]}
                  activeOpacity={0.8}
                >
                  <View style={[styles.dishThumb, { backgroundColor: C.ember }]}>
                    <Text style={styles.dishThumbLabel}>{item.title.slice(0, 4)}</Text>
                  </View>
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
                          <Text style={[styles.slotMiniText, { color: C.errorFg }]}>Inactive</Text>
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
  dishThumbLabel: { fontFamily: Fonts.serifItalic, fontSize: 10, color: 'rgba(250,246,240,0.75)', textAlign: 'center', padding: 2 },
  dishTitle: { fontFamily: Fonts.sans, fontSize: 13, color: C.textInk, lineHeight: 18 },
  dishPrice: { fontFamily: Fonts.serif, fontSize: 15, color: C.spice },
  dishDesc: { fontFamily: Fonts.sans, fontSize: 12, color: C.bodySoft, lineHeight: 18, marginTop: 6 },
  slotMini: { backgroundColor: C.cream, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 40 },
  slotMiniText: { fontFamily: Fonts.sans, fontSize: 10, color: C.bodySoft },
  dishActions: { flexDirection: 'row', gap: 4, marginLeft: 'auto' },
  iconBtn: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center' },

  emptyState: { alignItems: 'center', paddingTop: 60, gap: 10 },
  emptyText: { fontFamily: Fonts.sansMedium, fontSize: 15, color: C.textInk },
  emptySub: { fontFamily: Fonts.sans, fontSize: 13, color: C.bodySoft, textAlign: 'center' },
}); }
