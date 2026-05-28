import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { notificationsApi, type AppNotification } from '../../src/api/notifications';
import { Fonts, Spacing, Radius } from '../../src/constants/theme';
import { useColors, type AppColors } from '../../src/context/ThemeContext';
import { relativeTime } from '../../src/utils/format';
import { SkeletonNotification } from '../../src/components/ui/Skeleton';

export default function NotificationsScreen() {
  const router = useRouter();
  const C = useColors();
  const styles = useMemo(() => makeStyles(C), [C]);

  const TYPE_ICON = useMemo(() => ({
    order_status:   { name: 'receipt-outline',            color: C.spice,     bg: C.cream },
    payment:        { name: 'card-outline',               color: C.successFg, bg: C.successBg },
    booking_quoted: { name: 'calendar-outline',           color: C.infoFg,   bg: C.infoBg },
    review_reply:   { name: 'chatbubble-outline',         color: C.ember,    bg: C.warnBg },
    new_dish:       { name: 'restaurant-outline',         color: C.spice,    bg: C.cream },
    system:         { name: 'information-circle-outline', color: C.bodySoft, bg: C.bgCook },
  }), [C]);

  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const { notifications: data, unread_count } = await notificationsApi.list({ limit: 50 });
      setNotifications(data ?? []);
      setUnreadCount(unread_count);
    } catch {
      setNotifications([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleMarkAllRead() {
    try {
      await notificationsApi.markAllRead();
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch {}
  }

  async function handleMarkRead(n: AppNotification) {
    if (n.is_read) return;
    try {
      await notificationsApi.markRead(n.id);
      setNotifications(prev => prev.map(x => x.id === n.id ? { ...x, is_read: true } : x));
      setUnreadCount(c => Math.max(0, c - 1));
    } catch {}
  }

  return (
    <View style={styles.root}>
      <SafeAreaView>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={22} color={C.textInk} />
          </TouchableOpacity>
          <Text style={styles.pageTitle}>Notifications</Text>
          {unreadCount > 0 && (
            <TouchableOpacity onPress={handleMarkAllRead} style={styles.markAllBtn}>
              <Text style={styles.markAllText}>Mark all read</Text>
            </TouchableOpacity>
          )}
        </View>
      </SafeAreaView>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 32 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} tintColor={C.spice} />
        }
      >
        {loading ? (
          <>
            {[1, 2, 3, 4, 5].map(k => <SkeletonNotification key={k} />)}
          </>
        ) : notifications.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="notifications-outline" size={40} color={C.stone} />
            <Text style={styles.emptyText}>No notifications yet</Text>
            <Text style={styles.emptySub}>We'll let you know when something happens with your orders.</Text>
          </View>
        ) : (
          notifications.map((n, i) => {
            const cfg = (TYPE_ICON as any)[n.type] ?? TYPE_ICON.system;
            const isLast = i === notifications.length - 1;
            return (
              <TouchableOpacity
                key={n.id}
                style={[styles.item, !n.is_read && styles.itemUnread, isLast && { borderBottomWidth: 0 }]}
                onPress={() => handleMarkRead(n)}
                activeOpacity={0.7}
              >
                <View style={[styles.iconWrap, { backgroundColor: cfg.bg }]}>
                  <Ionicons name={cfg.name as any} size={18} color={cfg.color} />
                </View>
                <View style={{ flex: 1, gap: 3 }}>
                  <View style={styles.titleRow}>
                    <Text style={styles.title} numberOfLines={1}>{n.title}</Text>
                    {!n.is_read && <View style={styles.unreadDot} />}
                  </View>
                  <Text style={styles.body} numberOfLines={2}>{n.body}</Text>
                  <Text style={styles.time}>{relativeTime(n.created_at)}</Text>
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

function makeStyles(C: AppColors) { return StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  topBar: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: Spacing.md, paddingTop: 8, paddingBottom: 12, gap: 12,
  },
  backBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: C.bgCook, alignItems: 'center', justifyContent: 'center' },
  pageTitle: { fontFamily: Fonts.serif, fontSize: 22, color: C.textInk, flex: 1 },
  markAllBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 40, borderWidth: 1, borderColor: C.borderWarm },
  markAllText: { fontFamily: Fonts.sansMedium, fontSize: 12, color: C.bodySoft },

  item: {
    flexDirection: 'row', gap: 12, paddingHorizontal: Spacing.lg, paddingVertical: 14,
    borderBottomWidth: 0.5, borderBottomColor: C.borderWarm,
  },
  itemUnread: { backgroundColor: C.cream },
  iconWrap: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontFamily: Fonts.sansMedium, fontSize: 14, color: C.textInk, flex: 1 },
  unreadDot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: C.spice, flexShrink: 0 },
  body: { fontFamily: Fonts.sans, fontSize: 13, color: C.body, lineHeight: 18 },
  time: { fontFamily: Fonts.sans, fontSize: 11, color: C.bodySoft },

  emptyState: { alignItems: 'center', paddingTop: 80, paddingHorizontal: Spacing.lg, gap: 10 },
  emptyText: { fontFamily: Fonts.sansMedium, fontSize: 15, color: C.textInk },
  emptySub: { fontFamily: Fonts.sans, fontSize: 13, color: C.bodySoft, textAlign: 'center', lineHeight: 20 },
}); }
