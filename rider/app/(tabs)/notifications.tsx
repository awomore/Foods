import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../src/api/client';
import { C, Sp, R, Fs, F } from '../../src/theme';

interface Notification {
  id: string;
  title: string;
  body: string | null;
  type: string | null;
  is_read: boolean;
  created_at: string;
}

function timeAgo(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function iconForType(type: string | null): React.ComponentProps<typeof Ionicons>['name'] {
  switch (type) {
    case 'order_assigned':  return 'bicycle-outline';
    case 'order_ready':     return 'bag-check-outline';
    case 'earnings':        return 'wallet-outline';
    case 'kyc':             return 'shield-checkmark-outline';
    case 'system':          return 'information-circle-outline';
    default:                return 'notifications-outline';
  }
}

export default function NotificationsScreen() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const res = await api.get<{ notifications: Notification[]; unread_count: number }>(
        '/notifications?limit=40'
      );
      setNotifications(res.notifications);
      setUnreadCount(res.unread_count);
    } catch (e: any) {
      setError(e.error ?? 'Could not load notifications');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const markRead = useCallback(async (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    setUnreadCount(prev => Math.max(0, prev - 1));
    api.patch(`/notifications/${id}/read`, {}).catch(() => {});
  }, []);

  const markAllRead = useCallback(async () => {
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    setUnreadCount(0);
    api.patch('/notifications/mark-all-read', {}).catch(() => {});
  }, []);

  function onRefresh() {
    setRefreshing(true);
    load(true);
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Notifications</Text>
        {unreadCount > 0 && (
          <TouchableOpacity onPress={markAllRead} style={styles.markAllBtn}>
            <Text style={styles.markAllText}>Mark all read</Text>
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={C.spice} />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Ionicons name="alert-circle-outline" size={36} color={C.stone} />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={() => load()} style={styles.retryBtn}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={item => item.id}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.spice} />
          }
          contentContainerStyle={notifications.length === 0 ? styles.emptyContainer : undefined}
          ListEmptyComponent={
            <View style={styles.center}>
              <Ionicons name="notifications-off-outline" size={44} color={C.stone} />
              <Text style={styles.emptyText}>No notifications yet</Text>
              <Text style={styles.emptySub}>Order alerts and updates will appear here</Text>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.item, !item.is_read && styles.itemUnread]}
              onPress={() => { if (!item.is_read) markRead(item.id); }}
              activeOpacity={0.7}
            >
              <View style={[styles.iconWrap, !item.is_read && styles.iconWrapUnread]}>
                <Ionicons
                  name={iconForType(item.type)}
                  size={20}
                  color={item.is_read ? C.stone : C.spice}
                />
              </View>
              <View style={styles.itemBody}>
                <View style={styles.itemTop}>
                  <Text style={[styles.itemTitle, !item.is_read && styles.itemTitleUnread]} numberOfLines={1}>
                    {item.title}
                  </Text>
                  <Text style={styles.itemTime}>{timeAgo(item.created_at)}</Text>
                </View>
                {item.body ? (
                  <Text style={styles.itemBody2} numberOfLines={2}>{item.body}</Text>
                ) : null}
              </View>
              {!item.is_read && <View style={styles.unreadDot} />}
            </TouchableOpacity>
          )}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:           { flex: 1, backgroundColor: C.bg },
  header:         { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Sp.lg, paddingVertical: Sp.md, borderBottomWidth: 1, borderBottomColor: C.borderWarm },
  title:          { flex: 1, fontFamily: F.sansMedium, fontSize: Fs.lg, color: C.ink },
  markAllBtn:     { paddingHorizontal: Sp.md, paddingVertical: Sp.xs },
  markAllText:    { fontFamily: F.sans, fontSize: Fs.sm, color: C.spice },
  center:         { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Sp.sm, padding: Sp.xl },
  errorText:      { fontFamily: F.sans, fontSize: Fs.sm, color: C.stone, textAlign: 'center' },
  retryBtn:       { marginTop: Sp.xs, paddingHorizontal: Sp.lg, paddingVertical: Sp.sm, borderRadius: R.md, backgroundColor: C.spice },
  retryText:      { fontFamily: F.sansMedium, fontSize: Fs.sm, color: '#fff' },
  emptyContainer: { flex: 1 },
  emptyText:      { fontFamily: F.sansMedium, fontSize: Fs.md, color: C.ink },
  emptySub:       { fontFamily: F.sans, fontSize: Fs.sm, color: C.stone, textAlign: 'center' },
  item:           { flexDirection: 'row', alignItems: 'flex-start', padding: Sp.md, paddingHorizontal: Sp.lg, gap: Sp.md, backgroundColor: C.bg },
  itemUnread:     { backgroundColor: C.spice + '08' },
  iconWrap:       { width: 40, height: 40, borderRadius: R.full ?? 20, backgroundColor: C.border + '30', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  iconWrapUnread: { backgroundColor: C.spice + '15' },
  itemBody:       { flex: 1, gap: 3 },
  itemTop:        { flexDirection: 'row', alignItems: 'center', gap: Sp.xs },
  itemTitle:      { flex: 1, fontFamily: F.sans, fontSize: Fs.sm, color: C.stone },
  itemTitleUnread:{ fontFamily: F.sansMedium, color: C.ink },
  itemTime:       { fontFamily: F.sans, fontSize: Fs.xs, color: C.stone, flexShrink: 0 },
  itemBody2:      { fontFamily: F.sans, fontSize: Fs.xs, color: C.stone, lineHeight: 18 },
  unreadDot:      { width: 8, height: 8, borderRadius: 4, backgroundColor: C.spice, marginTop: 6, flexShrink: 0 },
  separator:      { height: 1, backgroundColor: C.borderWarm, marginLeft: 68 },
});
