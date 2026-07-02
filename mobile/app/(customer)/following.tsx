import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, RefreshControl, Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { followsApi } from '../../src/api/follows';
import { useColors, type AppColors } from '../../src/context/ThemeContext';
import { Fonts, Spacing, Radius, Shadow } from '../../src/constants/theme';
import Avatar from '../../src/components/ui/Avatar';
import { useFeedback } from '../../src/components/feedback';
import { SkeletonRow } from '../../src/components/ui/Skeleton';
import { useTranslation } from 'react-i18next';

interface Follow {
  id: string;
  cook_id: string;
  display_name: string;
  username: string;
  location: string | null;
  average_rating: number;
  is_live: boolean;
  cook_avatar: string | null;
  notify_new_menu: boolean;
  notify_diary_post: boolean;
  notify_flash_sale: boolean;
  notify_surprise_drop: boolean;
}

export default function FollowingScreen() {
  const C = useColors();
  const styles = useMemo(() => makeStyles(C), [C]);
  const router = useRouter();
  const feedback = useFeedback();
  const { t } = useTranslation();
  const [follows, setFollows] = useState<Follow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [unfollowing, setUnfollowing] = useState<string | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await followsApi.list();
      setFollows((res as any).follows ?? []);
    } catch {}
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleUnfollow(follow: Follow) {
    feedback.confirm({
      title: t('following.unfollow_confirm_title', { name: follow.display_name }),
      message: t('following.unfollow_confirm_body'),
      confirmLabel: t('following.unfollow'),
      onConfirm: async () => {
        setUnfollowing(follow.cook_id);
        try {
          await followsApi.unfollow(follow.cook_id);
          setFollows(prev => prev.filter(f => f.cook_id !== follow.cook_id));
        } catch {
          feedback.error(t('common.error'), t('following.unfollow_error'));
        }
        setUnfollowing(null);
      },
    });
  }

  async function updatePref(follow: Follow, pref: keyof Pick<Follow, 'notify_new_menu' | 'notify_diary_post' | 'notify_flash_sale' | 'notify_surprise_drop'>, val: boolean) {
    setFollows(prev => prev.map(f => f.cook_id === follow.cook_id ? { ...f, [pref]: val } : f));
    try {
      await followsApi.follow(follow.cook_id, { [pref]: val });
    } catch {
      setFollows(prev => prev.map(f => f.cook_id === follow.cook_id ? { ...f, [pref]: !val } : f));
    }
  }

  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top']}>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
            <Ionicons name="chevron-back" size={22} color={C.ink} />
          </TouchableOpacity>
          <Text style={styles.pageTitle}>{t('following.title')}</Text>
          <View style={{ width: 22 }} />
        </View>
      </SafeAreaView>

      {loading ? (
        <View style={{ padding: Spacing.md, gap: 12 }}>
          {[1, 2, 3, 4].map(k => <SkeletonRow key={k} />)}
        </View>
      ) : follows.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="people-outline" size={48} color={C.stone} />
          <Text style={styles.emptyTitle}>{t('following.empty_title')}</Text>
          <Text style={styles.emptySub}>{t('following.empty_body')}</Text>
          <TouchableOpacity
            style={styles.emptyBtn}
            onPress={() => router.replace('/(customer)' as any)}
          >
            <Text style={styles.emptyBtnText}>{t('following.discover')}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={follows}
          keyExtractor={f => f.cook_id}
          contentContainerStyle={{ padding: Spacing.md, gap: 12, paddingBottom: 40 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} tintColor={C.spice} />
          }
          renderItem={({ item: f }) => (
            <View style={styles.card}>
              {/* Cook identity */}
              <TouchableOpacity
                style={styles.identity}
                onPress={() => router.push(`/cook/${f.cook_id}` as any)}
                activeOpacity={0.8}
              >
                <Avatar name={f.display_name} avatarUrl={f.cook_avatar} size={44} isLive={f.is_live} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{f.display_name}</Text>
                  <Text style={styles.handle}>
                    @{f.username}{f.location ? ` · ${f.location}` : ''}
                    {f.is_live ? ` · 🔴 ${t('following.live')}` : ''}
                  </Text>
                </View>
                {unfollowing === f.cook_id ? (
                  <ActivityIndicator size="small" color={C.bodySoft} />
                ) : (
                  <TouchableOpacity
                    style={styles.unfollowBtn}
                    onPress={() => handleUnfollow(f)}
                    hitSlop={8}
                  >
                    <Text style={styles.unfollowText}>{t('following.unfollow')}</Text>
                  </TouchableOpacity>
                )}
              </TouchableOpacity>

              {/* Notification preferences */}
              <View style={styles.prefs}>
                <Text style={styles.prefsLabel}>{t('following.notify_about')}</Text>
                {([
                  { key: 'notify_new_menu',     label: t('following.pref_new_menu') },
                  { key: 'notify_diary_post',   label: t('following.pref_posts') },
                  { key: 'notify_flash_sale',   label: t('following.pref_flash_sale') },
                  { key: 'notify_surprise_drop',label: t('following.pref_surprise_drop') },
                ] as const).map(({ key, label }) => (
                  <View key={key} style={styles.prefRow}>
                    <Text style={styles.prefLabel}>{label}</Text>
                    <Switch
                      value={f[key]}
                      onValueChange={val => updatePref(f, key, val)}
                      trackColor={{ true: C.spice, false: C.borderWarm }}
                      thumbColor="#fff"
                    />
                  </View>
                ))}
              </View>
            </View>
          )}
        />
      )}
    </View>
  );
}

function makeStyles(C: AppColors) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: C.bg },
    topBar: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: Spacing.md, paddingVertical: Spacing.md,
      borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.borderWarm,
    },
    pageTitle: { fontFamily: Fonts.serif, fontSize: 20, color: C.ink },
    card: {
      backgroundColor: C.bgCard, borderRadius: Radius.lg,
      borderWidth: 0.5, borderColor: C.borderWarm,
      ...Shadow.card, overflow: 'hidden',
    },
    identity: {
      flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
      padding: Spacing.md,
    },
    name: { fontFamily: Fonts.sansMedium, fontSize: 14, color: C.ink },
    handle: { fontFamily: Fonts.sans, fontSize: 12, color: C.bodySoft, marginTop: 1 },
    unfollowBtn: {
      paddingHorizontal: 12, paddingVertical: 6,
      borderRadius: Radius.full, borderWidth: 1, borderColor: C.borderWarm,
    },
    unfollowText: { fontFamily: Fonts.sansMedium, fontSize: 12, color: C.bodySoft },
    prefs: {
      borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.borderWarm,
      paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    },
    prefsLabel: { fontFamily: Fonts.sansMedium, fontSize: 11, color: C.bodySoft, letterSpacing: 0.5, marginBottom: 6 },
    prefRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 4 },
    prefLabel: { fontFamily: Fonts.sans, fontSize: 13, color: C.body },
    empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: Spacing.xl },
    emptyTitle: { fontFamily: Fonts.serif, fontSize: 18, color: C.ink },
    emptySub: { fontFamily: Fonts.sans, fontSize: 14, color: C.bodySoft, textAlign: 'center', lineHeight: 20 },
    emptyBtn: { marginTop: 6, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 40, backgroundColor: C.spice },
    emptyBtnText: { fontFamily: Fonts.sansMedium, fontSize: 14, color: C.canvas },
  });
}
