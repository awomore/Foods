import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, SafeAreaView,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { notificationsApi, type AppNotification } from '../../src/api/notifications';
import { Colors, Fonts, Spacing, Radius, Shadow } from '../../src/constants/theme';

const TYPE_ICON: Record<string, { name: string; color: string; bg: string }> = {
  order_status:     { name: 'receipt-outline',     color: Colors.spice,     bg: Colors.cream },
  payment:          { name: 'card-outline',         color: Colors.successFg, bg: Colors.successBg },
  booking_quoted:   { name: 'calendar-outline',     color: Colors.infoFg,   bg: Colors.infoBg },
  review_reply:     { name: 'chatbubble-outline',   color: Colors.ember,    bg: Colors.warnBg },
  new_dish:         { name: 'restaurant-outline',   color: Colors.spice,    bg: Colors.cream },
  system:           { name: 'information-circle-outline', color: Colors.bodySoft, bg: Colors.bgCook },
};

function fmtTime(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString('en-NG', { day: 'numeric', month: 'short' });
}

export default function NotificationsScreen() {
  const router = useRouter();
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
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={22} color={Colors.textInk} />
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
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} tintColor={Colors.spice} />
        }
      >
        {notifications.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="notifications-outline" size={40} color={Colors.stone} />
            <Text style={styles.emptyText}>No notifications yet</Text>
            <Text style={styles.emptySub}>We'll let you know when something happens with your orders.</Text>
          </View>
        ) : (
          notifications.map((n, i) => {
            const cfg = TYPE_ICON[n.type] ?? TYPE_ICON.system;
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
                  <Text style={styles.time}>{fmtTime(n.created_at)}</Text>
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },
  topBar: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: Spacing.md, paddingTop: 8, paddingBottom: 12, gap: 12,
  },
  backBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: Colors.bgCook, alignItems: 'center', justifyContent: 'center' },
  pageTitle: { fontFamily: Fonts.serif, fontSize: 22, color: Colors.textInk, flex: 1 },
  markAllBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 40, borderWidth: 1, borderColor: Colors.borderWarm },
  markAllText: { fontFamily: Fonts.sansMedium, fontSize: 12, color: Colors.bodySoft },

  item: {
    flexDirection: 'row', gap: 12, paddingHorizontal: Spacing.lg, paddingVertical: 14,
    borderBottomWidth: 0.5, borderBottomColor: Colors.borderWarm,
  },
  itemUnread: { backgroundColor: Colors.cream + '60' },
  iconWrap: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontFamily: Fonts.sansMedium, fontSize: 14, color: Colors.textInk, flex: 1, fontWeight: '600' },
  unreadDot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: Colors.spice, flexShrink: 0 },
  body: { fontFamily: Fonts.sans, fontSize: 13, color: Colors.body, lineHeight: 18 },
  time: { fontFamily: Fonts.sans, fontSize: 11, color: Colors.bodySoft },

  emptyState: { alignItems: 'center', paddingTop: 80, paddingHorizontal: Spacing.lg, gap: 10 },
  emptyText: { fontFamily: Fonts.sansMedium, fontSize: 15, color: Colors.textInk },
  emptySub: { fontFamily: Fonts.sans, fontSize: 13, color: Colors.bodySoft, textAlign: 'center', lineHeight: 20 },
});
