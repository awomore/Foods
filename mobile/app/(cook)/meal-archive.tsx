import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, Image, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { cooksApi, type ArchiveItem } from '../../src/api/cooks';
import { Fonts, Spacing, Radius, Shadow } from '../../src/constants/theme';
import { useColors, type AppColors } from '../../src/context/ThemeContext';
import { fmtCurrency } from '../../src/utils/format';
import { Bone } from '../../src/components/ui/Skeleton';

export default function MealArchiveScreen() {
  const router = useRouter();
  const C = useColors();
  const styles = useMemo(() => makeStyles(C), [C]);

  const [items, setItems] = useState<ArchiveItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const LIMIT = 30;

  const load = useCallback(async (silent = false, reset = false) => {
    if (!silent) setLoading(true);
    try {
      const { items: fetched } = await cooksApi.archive({ limit: LIMIT, offset: reset ? 0 : 0 });
      setItems(fetched);
      setHasMore(fetched.length === LIMIT);
      setOffset(fetched.length);
    } catch {}
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function loadMore() {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const { items: fetched } = await cooksApi.archive({ limit: LIMIT, offset });
      setItems(prev => [...prev, ...fetched]);
      setHasMore(fetched.length === LIMIT);
      setOffset(o => o + fetched.length);
    } catch {}
    setLoadingMore(false);
  }

  const totalRevenue = items.reduce((sum, i) => sum + i.revenue, 0);
  const totalOrders = items.reduce((sum, i) => sum + i.orders_count, 0);

  if (loading) {
    return (
      <View style={styles.root}>
        <SafeAreaView style={{ flex: 1, padding: Spacing.lg, gap: 12 }}>
          <Bone width="55%" height={22} radius={6} />
          <Bone width="100%" height={100} radius={14} />
          <Bone width="100%" height={100} radius={14} />
          <Bone width="100%" height={100} radius={14} />
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <SafeAreaView>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={22} color={C.textInk} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Meal Archive</Text>
        </View>
      </SafeAreaView>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: Spacing.lg, gap: 16, paddingBottom: 60 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true, true); }} tintColor={C.spice} />}
        onScroll={({ nativeEvent }) => {
          const { layoutMeasurement, contentOffset, contentSize } = nativeEvent;
          if (layoutMeasurement.height + contentOffset.y >= contentSize.height - 200) loadMore();
        }}
        scrollEventThrottle={400}
      >
        {/* Summary strip */}
        <View style={styles.summaryStrip}>
          <View style={styles.summaryCell}>
            <Text style={styles.summaryNum}>{items.length}</Text>
            <Text style={styles.summaryLabel}>Dishes</Text>
          </View>
          <View style={[styles.summaryCell, styles.summaryCellBorder]}>
            <Text style={styles.summaryNum}>{totalOrders.toLocaleString()}</Text>
            <Text style={styles.summaryLabel}>Total orders</Text>
          </View>
          <View style={styles.summaryCell}>
            <Text style={styles.summaryNum}>₦{(totalRevenue / 1000).toFixed(0)}k</Text>
            <Text style={styles.summaryLabel}>Est. revenue</Text>
          </View>
        </View>

        {items.length === 0 && (
          <View style={{ alignItems: 'center', paddingVertical: 60, paddingHorizontal: Spacing.lg, gap: 10 }}>
            <Ionicons name="restaurant-outline" size={48} color={C.stone} />
            <Text style={{ fontFamily: Fonts.serif, fontSize: 20, color: C.textInk }}>
              No dishes yet
            </Text>
            <Text style={{ fontFamily: Fonts.sans, fontSize: 14, color: C.bodySoft, textAlign: 'center', lineHeight: 20 }}>
              Create your first dish to start taking orders.
            </Text>
            <TouchableOpacity
              onPress={() => router.push('/cook/dish-form' as any)}
              style={{ marginTop: 6, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 40, backgroundColor: C.spice }}
            >
              <Text style={{ fontFamily: Fonts.sansMedium, fontSize: 14, color: C.canvas }}>Create Dish</Text>
            </TouchableOpacity>
          </View>
        )}

        {items.map(item => (
          <View key={item.id} style={styles.dishCard}>
            <View style={styles.dishRow}>
              {item.photos?.[0] ? (
                <Image source={{ uri: item.photos[0] }} style={styles.dishThumb} resizeMode="cover" />
              ) : (
                <View style={[styles.dishThumb, { backgroundColor: C.bgCook, alignItems: 'center', justifyContent: 'center' }]}>
                  <Ionicons name="restaurant-outline" size={22} color={C.stone} />
                </View>
              )}
              <View style={{ flex: 1, minWidth: 0 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={styles.dishTitle} numberOfLines={1}>{item.title}</Text>
                  {!item.is_active && (
                    <View style={styles.hiddenBadge}>
                      <Text style={styles.hiddenBadgeText}>Hidden</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.dishPrice}>{fmtCurrency(item.unit_price, item.currency_code)}</Text>
                {item.available_date && (
                  <Text style={styles.dishDate}>
                    {new Date(item.available_date).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </Text>
                )}
              </View>
            </View>

            <View style={styles.statsRow}>
              <View style={styles.statCell}>
                <Text style={styles.statNum}>{item.orders_count}</Text>
                <Text style={styles.statLabel}>Orders</Text>
              </View>
              <View style={[styles.statCell, styles.statCellBorder]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                  <Ionicons name="star" size={13} color={C.spice} />
                  <Text style={styles.statNum}>{item.avg_rating > 0 ? item.avg_rating.toFixed(1) : '—'}</Text>
                </View>
                <Text style={styles.statLabel}>{item.review_count} reviews</Text>
              </View>
              <View style={[styles.statCell, styles.statCellBorder]}>
                <Ionicons name="bookmark" size={13} color={C.spice} />
                <Text style={styles.statNum}>{item.craving_count}</Text>
                <Text style={styles.statLabel}>Cravings</Text>
              </View>
              <View style={styles.statCell}>
                <Text style={styles.statNum}>
                  {item.revenue > 0 ? `₦${(item.revenue / 1000).toFixed(1)}k` : '₦0'}
                </Text>
                <Text style={styles.statLabel}>Revenue</Text>
              </View>
            </View>

            {item.dietary_labels?.length > 0 && (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
                {item.dietary_labels.map(l => (
                  <View key={l} style={styles.labelPill}>
                    <Text style={styles.labelPillText}>{l.replace(/_/g, ' ')}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        ))}

        {loadingMore && (
          <ActivityIndicator color={C.spice} style={{ marginVertical: 20 }} />
        )}
      </ScrollView>
    </View>
  );
}

function makeStyles(C: AppColors) { return StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.md, paddingTop: 8, paddingBottom: 12, gap: 12 },
  backBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: C.bgCook, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontFamily: Fonts.serif, fontSize: 20, color: C.textInk, flex: 1 },
  summaryStrip: { flexDirection: 'row', backgroundColor: C.bgCard, borderRadius: Radius.lg, borderWidth: 0.5, borderColor: C.borderWarm, ...Shadow.card },
  summaryCell: { flex: 1, alignItems: 'center', paddingVertical: 14 },
  summaryCellBorder: { borderLeftWidth: 0.5, borderRightWidth: 0.5, borderColor: C.borderWarm },
  summaryNum: { fontFamily: Fonts.serif, fontSize: 20, color: C.spice },
  summaryLabel: { fontFamily: Fonts.sans, fontSize: 11, color: C.bodySoft, marginTop: 3 },
  dishCard: { backgroundColor: C.bgCard, borderRadius: Radius.xl, borderWidth: 0.5, borderColor: C.borderWarm, padding: 14, gap: 12, ...Shadow.card },
  dishRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  dishThumb: { width: 64, height: 64, borderRadius: Radius.md, overflow: 'hidden' },
  dishTitle: { fontFamily: Fonts.sansMedium, fontSize: 14, color: C.textInk, flex: 1 },
  dishPrice: { fontFamily: Fonts.serif, fontSize: 15, color: C.spice, marginTop: 3 },
  dishDate: { fontFamily: Fonts.sans, fontSize: 11, color: C.bodySoft, marginTop: 2 },
  hiddenBadge: { backgroundColor: C.stone + '22', borderRadius: 40, paddingHorizontal: 7, paddingVertical: 2 },
  hiddenBadgeText: { fontFamily: Fonts.sans, fontSize: 10, color: C.bodySoft },
  statsRow: { flexDirection: 'row', paddingTop: 10, borderTopWidth: 0.5, borderTopColor: C.borderWarm },
  statCell: { flex: 1, alignItems: 'center', gap: 2 },
  statCellBorder: { borderLeftWidth: 0.5, borderLeftColor: C.borderWarm },
  statNum: { fontFamily: Fonts.sansMedium, fontSize: 13, color: C.textInk },
  statLabel: { fontFamily: Fonts.sans, fontSize: 10, color: C.bodySoft },
  labelPill: { backgroundColor: C.healthBg, borderRadius: 40, paddingHorizontal: 8, paddingVertical: 3 },
  labelPillText: { fontFamily: Fonts.sans, fontSize: 10, color: C.healthFg, textTransform: 'capitalize' },
}); }
