import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, SafeAreaView,
  ActivityIndicator, RefreshControl, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/context/AuthContext';
import { menuApi } from '../../src/api/menu';
import type { MenuItem } from '../../src/api/cooks';
import { Colors, Fonts, Spacing, Radius, Shadow } from '../../src/constants/theme';
import DishPhoto from '../../src/components/ui/DishPhoto';

function fmtCurrency(amount: number, currency = 'NGN'): string {
  const symbols: Record<string, string> = { NGN: '₦', KES: 'KSh ', GHS: 'GH₵', ZAR: 'R', EGP: 'E£' };
  return (symbols[currency] ?? currency + ' ') + Number(amount).toLocaleString('en-NG', { maximumFractionDigits: 0 });
}

export default function CookMenuScreen() {
  const router = useRouter();
  const { user } = useAuth();
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
        <ActivityIndicator color={Colors.spice} />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <SafeAreaView>
        <View style={styles.topBar}>
          <Text style={styles.pageTitle}>My menu</Text>
          <TouchableOpacity style={styles.addBtn} onPress={() => router.push('/cook/dish-form' as any)}>
            <Ionicons name="add" size={20} color={Colors.canvas} />
            <Text style={styles.addBtnText}>Add dish</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: Spacing.lg, gap: 12, paddingTop: 8 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} tintColor={Colors.spice} />
        }
      >
        {/* Today's featured */}
        {todayItems.length > 0 && (
          <View>
            <Text style={styles.sectionLabel}>On the menu today</Text>
            {todayItems.map(item => (
              <View key={item.id} style={styles.featuredCard}>
                <DishPhoto label={item.title} height={160} radius={12} />
                <View style={styles.featuredBody}>
                  <View style={styles.featuredTop}>
                    <View style={styles.liveTag}>
                      <View style={styles.liveDot} />
                      <Text style={styles.liveText}>Live today</Text>
                    </View>
                    <TouchableOpacity onPress={() => router.push({ pathname: '/cook/dish-form', params: { id: item.id } } as any)}>
                      <Ionicons name="pencil-outline" size={16} color={Colors.spice} />
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

        {/* All dishes */}
        {items.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="restaurant-outline" size={40} color={Colors.stone} />
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
                  <View style={[styles.dishThumb, { backgroundColor: Colors.ember }]}>
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
                        <View style={[styles.slotMini, { backgroundColor: Colors.errorBg }]}>
                          <Text style={[styles.slotMiniText, { color: Colors.errorFg }]}>Inactive</Text>
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
                        color={Colors.bodySoft}
                      />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.iconBtn} onPress={() => handleDelete(item.id)}>
                      <Ionicons name="trash-outline" size={16} color={Colors.errorFg} />
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

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },
  topBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.lg, paddingTop: 16, paddingBottom: 12 },
  pageTitle: { fontFamily: Fonts.serif, fontSize: 26, color: Colors.textInk, flex: 1 },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: Colors.ink, borderRadius: 40, paddingHorizontal: 14, paddingVertical: 8 },
  addBtnText: { fontFamily: Fonts.sansMedium, fontSize: 13, color: Colors.canvas },

  sectionLabel: { fontFamily: Fonts.sansMedium, fontSize: 13, color: Colors.caps, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 },

  featuredCard: { backgroundColor: Colors.bgCard, borderRadius: Radius.lg, borderWidth: 0.5, borderColor: Colors.borderWarm, ...Shadow.card, overflow: 'hidden', marginBottom: 8 },
  featuredBody: { padding: 14, gap: 6 },
  featuredTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  liveTag: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  liveDot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: Colors.leaf },
  liveText: { fontFamily: Fonts.sansMedium, fontSize: 12, color: Colors.successFg },
  featuredTitle: { fontFamily: Fonts.sans, fontSize: 14, color: Colors.textInk, lineHeight: 20 },
  featuredMeta: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  featuredPrice: { fontFamily: Fonts.serif, fontSize: 18, color: Colors.spice },
  slotPill: { backgroundColor: Colors.honey, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 40 },
  slotText: { fontFamily: Fonts.sans, fontSize: 11, color: '#5C3B16' },

  dishRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, backgroundColor: Colors.bgCard, borderRadius: Radius.md, padding: 12, marginBottom: 8, borderWidth: 0.5, borderColor: Colors.borderWarm, ...Shadow.card },
  dishThumb: { width: 52, height: 52, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  dishThumbLabel: { fontFamily: Fonts.serifItalic, fontSize: 10, color: 'rgba(250,246,240,0.75)', textAlign: 'center', padding: 2 },
  dishTitle: { fontFamily: Fonts.sans, fontSize: 13, color: Colors.textInk, lineHeight: 18 },
  dishPrice: { fontFamily: Fonts.serif, fontSize: 15, color: Colors.spice },
  dishDesc: { fontFamily: Fonts.sans, fontSize: 12, color: Colors.bodySoft, lineHeight: 18, marginTop: 6 },
  slotMini: { backgroundColor: Colors.cream, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 40 },
  slotMiniText: { fontFamily: Fonts.sans, fontSize: 10, color: Colors.bodySoft },
  dishActions: { flexDirection: 'row', gap: 4, marginLeft: 'auto' },
  iconBtn: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center' },

  emptyState: { alignItems: 'center', paddingTop: 60, gap: 10 },
  emptyText: { fontFamily: Fonts.sansMedium, fontSize: 15, color: Colors.textInk },
  emptySub: { fontFamily: Fonts.sans, fontSize: 13, color: Colors.bodySoft, textAlign: 'center' },
});
