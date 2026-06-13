import React, { useState, useRef, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Animated, Dimensions, ActivityIndicator, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { useColors, type AppColors } from '../src/context/ThemeContext';
import { Fonts, Spacing, Radius, Shadow } from '../src/constants/theme';
import { cooksApi, type CookCard } from '../src/api/cooks';
import Avatar from '../src/components/ui/Avatar';
import { fmtCurrency } from '../src/utils/format';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export const ONBOARDING_DONE_KEY = '@onboarding_v1_done';
export const ONBOARDING_CUISINES_KEY = '@onboarding_cuisines_v1';

// ─── Cuisine data ─────────────────────────────────────────────────────────────

type Cuisine = {
  key: string;
  label: string;
  emoji: string;
  color: string;
};

const CUISINES: Cuisine[] = [
  { key: 'nigerian',    label: 'Nigerian',       emoji: '🍲', color: '#FF8A5C' },
  { key: 'rice',        label: 'Rice Dishes',    emoji: '🍚', color: '#FF6B35' },
  { key: 'grills',      label: 'Grills & Suya',  emoji: '🔥', color: '#DC2626' },
  { key: 'pastries',    label: 'Pastries',        emoji: '🥐', color: '#FF8A5C' },
  { key: 'healthy',     label: 'Healthy',         emoji: '🥗', color: '#2E8B3F' },
  { key: 'soups',       label: 'Soups & Stews',  emoji: '🍜', color: '#FF6B35' },
  { key: 'seafood',     label: 'Seafood',         emoji: '🦐', color: '#2A5FBF' },
  { key: 'continental', label: 'Continental',    emoji: '🍝', color: '#8B2E6A' },
  { key: 'street',      label: 'Street Food',    emoji: '🌮', color: '#FF8A5C' },
  { key: 'drinks',      label: 'Drinks',          emoji: '🧃', color: '#2A5FBF' },
  { key: 'desserts',    label: 'Desserts',        emoji: '🍮', color: '#8B2E6A' },
  { key: 'surprise',    label: 'Surprise Me',    emoji: '🎲', color: '#FF6B35' },
];

// ─── Component ────────────────────────────────────────────────────────────────

export default function OnboardingScreen() {
  const router = useRouter();
  const C = useColors();
  const styles = useMemo(() => makeStyles(C), [C]);

  const [step, setStep] = useState(0); // 0=cuisines, 1=nearby, 2=value
  const [selected, setSelected] = useState<string[]>([]);
  const [nearbyCooks, setNearbyCooks] = useState<CookCard[]>([]);
  const [loadingNearby, setLoadingNearby] = useState(false);
  const [locationDenied, setLocationDenied] = useState(false);

  const slideX = useRef(new Animated.Value(0)).current;

  const advanceTo = (nextStep: number) => {
    Animated.timing(slideX, {
      toValue: -SCREEN_WIDTH * nextStep,
      duration: 320,
      useNativeDriver: true,
    }).start();
    setStep(nextStep);
  };

  // ── Step 0 handlers ──────────────────────────────────────────────────────
  const toggleCuisine = (key: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelected(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  const handleCuisinesContinue = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await AsyncStorage.setItem(ONBOARDING_CUISINES_KEY, JSON.stringify(selected));
    setLoadingNearby(true);
    advanceTo(1);

    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        const res = await cooksApi.list({
          lat: loc.coords.latitude,
          lng: loc.coords.longitude,
          radius: 25,
          limit: 6,
        });
        setNearbyCooks(res.cooks ?? []);
      } else {
        setLocationDenied(true);
        const res = await cooksApi.list({ limit: 6 });
        setNearbyCooks(res.cooks ?? []);
      }
    } catch {
      setLocationDenied(true);
    } finally {
      setLoadingNearby(false);
    }
  }, [selected]);

  // ── Step 1 handlers ──────────────────────────────────────────────────────
  const handleNearbyDone = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    advanceTo(2);
  };

  // ── Step 2 handlers ──────────────────────────────────────────────────────
  const handleFinish = useCallback(async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await AsyncStorage.setItem(ONBOARDING_DONE_KEY, '1');
    router.replace('/(customer)');
  }, []);

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <View style={styles.root}>
      <SafeAreaView style={{ flex: 1 }}>
        {/* Progress dots */}
        <View style={styles.progressRow}>
          {[0, 1, 2].map(i => (
            <View
              key={i}
              style={[styles.dot, i === step ? styles.dotActive : i < step ? styles.dotDone : styles.dotInactive]}
            />
          ))}
        </View>

        {/* Slides */}
        <Animated.View
          style={[styles.slidesContainer, { transform: [{ translateX: slideX }] }]}
        >
          {/* ── SLIDE 0 — Cuisine picker ───────────────────────────────── */}
          <View style={styles.slide}>
            <Text style={styles.headline}>What are you{'\n'}craving?</Text>
            <Text style={styles.subhead}>Pick 2–3 favourites. We'll personalise your feed.</Text>

            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.cuisineGrid}
            >
              {CUISINES.map(c => {
                const active = selected.includes(c.key);
                return (
                  <TouchableOpacity
                    key={c.key}
                    style={[styles.cuisineTile, active && { borderColor: c.color, borderWidth: 2, backgroundColor: c.color + '12' }]}
                    onPress={() => toggleCuisine(c.key)}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.cuisineEmoji}>{c.emoji}</Text>
                    <Text style={[styles.cuisineLabel, active && { color: c.color, fontFamily: Fonts.sansMedium }]}>
                      {c.label}
                    </Text>
                    {active && (
                      <View style={[styles.cuisineCheck, { backgroundColor: c.color }]}>
                        <Ionicons name="checkmark" size={10} color="#fff" />
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <View style={styles.slideFooter}>
              <TouchableOpacity
                style={[styles.primaryBtn, selected.length < 1 && styles.primaryBtnDisabled]}
                onPress={handleCuisinesContinue}
                disabled={selected.length < 1}
                activeOpacity={0.85}
              >
                <Text style={styles.primaryBtnText}>
                  {selected.length === 0 ? 'Pick at least one' : `Continue with ${selected.length} selected`}
                </Text>
                <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          </View>

          {/* ── SLIDE 1 — Nearby creators ──────────────────────────────── */}
          <View style={styles.slide}>
            <Text style={styles.headline}>
              {locationDenied ? 'Top creators' : 'Creators near you'}
            </Text>
            <Text style={styles.subhead}>
              {locationDenied
                ? 'Set your area later to discover home cooks within 10km.'
                : 'Home-cooked food, made fresh today — not reheated from yesterday.'}
            </Text>

            {loadingNearby ? (
              <View style={styles.loadingBox}>
                <ActivityIndicator color={C.spice} size="large" />
                <Text style={styles.loadingText}>Finding cooks near you…</Text>
              </View>
            ) : (
              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ gap: 10, paddingBottom: 8 }}
              >
                {nearbyCooks.slice(0, 5).map(cook => (
                  <View key={cook.id} style={styles.nearbyCookRow}>
                    <Avatar
                      name={cook.display_name}
                      avatarUrl={cook.avatar_url}
                      size={48}
                      hasStory={cook.has_story}
                      isLive={cook.is_live}
                    />
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text style={styles.nearbyCookName}>{cook.display_name}</Text>
                      <Text style={styles.nearbyCookSub} numberOfLines={1}>
                        {cook.location ?? 'Near you'}
                        {cook.distance_km > 0 ? ` · ${cook.distance_km}km away` : ''}
                      </Text>
                    </View>
                    {cook.today_items?.[0] && (
                      <Text style={styles.nearbyCookPrice}>
                        from {fmtCurrency(cook.today_items[0].unit_price, cook.currency_code ?? 'NGN')}
                      </Text>
                    )}
                    {cook.is_live && (
                      <View style={styles.liveChip}>
                        <View style={styles.liveDot} />
                        <Text style={styles.liveText}>LIVE</Text>
                      </View>
                    )}
                  </View>
                ))}
                {nearbyCooks.length === 0 && !loadingNearby && (
                  <View style={styles.emptyNearby}>
                    <Text style={styles.emptyNearbyText}>
                      No cooks found yet — check back as more join near you.
                    </Text>
                  </View>
                )}
              </ScrollView>
            )}

            <View style={styles.slideFooter}>
              <TouchableOpacity
                style={styles.primaryBtn}
                onPress={handleNearbyDone}
                activeOpacity={0.85}
              >
                <Text style={styles.primaryBtnText}>See my personalised feed</Text>
                <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          </View>

          {/* ── SLIDE 2 — Value delivery ───────────────────────────────── */}
          <View style={[styles.slide, styles.valueSlideCentered]}>
            <View style={styles.valueIconWrap}>
              <Text style={{ fontSize: 56 }}>🍽️</Text>
            </View>
            <Text style={[styles.headline, { textAlign: 'center' }]}>
              You're all set.
            </Text>
            <Text style={[styles.subhead, { textAlign: 'center', marginBottom: 32 }]}>
              Discover home cooks, order fresh meals, and support creators in your community.
            </Text>

            <View style={styles.valuePoints}>
              {[
                { icon: 'location-outline', text: 'Cooks within 10km of you' },
                { icon: 'leaf-outline',     text: 'Made fresh today, not yesterday' },
                { icon: 'heart-outline',    text: 'Real people, real food, real stories' },
              ].map(p => (
                <View key={p.icon} style={styles.valuePoint}>
                  <View style={styles.valuePointIcon}>
                    <Ionicons name={p.icon as any} size={18} color={C.spice} />
                  </View>
                  <Text style={styles.valuePointText}>{p.text}</Text>
                </View>
              ))}
            </View>

            <View style={styles.slideFooter}>
              <TouchableOpacity
                style={styles.primaryBtn}
                onPress={handleFinish}
                activeOpacity={0.85}
              >
                <Text style={styles.primaryBtnText}>Start exploring</Text>
                <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          </View>
        </Animated.View>
      </SafeAreaView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

function makeStyles(C: AppColors) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: C.bg },

    progressRow: {
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 8,
      paddingTop: 16,
      paddingBottom: 8,
    },
    dot:         { width: 8, height: 8, borderRadius: 4 },
    dotActive:   { backgroundColor: C.spice, width: 24 },
    dotDone:     { backgroundColor: C.spice + '60' },
    dotInactive: { backgroundColor: C.borderWarm },

    slidesContainer: {
      flexDirection: 'row',
      width: SCREEN_WIDTH * 3,
      flex: 1,
    },
    slide: {
      width: SCREEN_WIDTH,
      flex: 1,
      paddingHorizontal: Spacing.lg,
      paddingTop: 24,
    },
    valueSlideCentered: {
      alignItems: 'center',
      justifyContent: 'center',
    },

    headline: {
      fontFamily: Fonts.serif,
      fontSize: 30,
      color: C.textInk,
      lineHeight: 38,
      marginBottom: 8,
    },
    subhead: {
      fontFamily: Fonts.sans,
      fontSize: 15,
      color: C.bodySoft,
      lineHeight: 22,
      marginBottom: 24,
    },

    // Cuisine grid
    cuisineGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
      paddingBottom: 16,
    },
    cuisineTile: {
      width: (SCREEN_WIDTH - Spacing.lg * 2 - 20) / 3,
      backgroundColor: C.bgCard,
      borderRadius: Radius.lg,
      borderWidth: 1,
      borderColor: C.borderWarm,
      padding: 14,
      alignItems: 'center',
      gap: 6,
      ...Shadow.card,
      position: 'relative',
    },
    cuisineEmoji:  { fontSize: 28 },
    cuisineLabel:  { fontFamily: Fonts.sans, fontSize: 12, color: C.body, textAlign: 'center' },
    cuisineCheck: {
      position: 'absolute',
      top: 6,
      right: 6,
      width: 18,
      height: 18,
      borderRadius: 9,
      alignItems: 'center',
      justifyContent: 'center',
    },

    // Nearby cooks
    nearbyCookRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: C.bgCard,
      borderRadius: Radius.lg,
      padding: 14,
      borderWidth: 0.5,
      borderColor: C.borderWarm,
      ...Shadow.card,
    },
    nearbyCookName:  { fontFamily: Fonts.sansMedium, fontSize: 14, color: C.textInk },
    nearbyCookSub:   { fontFamily: Fonts.sans, fontSize: 12, color: C.bodySoft },
    nearbyCookPrice: { fontFamily: Fonts.sansMedium, fontSize: 12, color: C.spice },
    liveChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: C.errorBg,
      borderRadius: 40,
      paddingHorizontal: 8,
      paddingVertical: 4,
    },
    liveDot:  { width: 5, height: 5, borderRadius: 3, backgroundColor: C.errorFg },
    liveText: { fontFamily: Fonts.sansMedium, fontSize: 9, color: C.errorFg, letterSpacing: 0.5 },

    loadingBox:  { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
    loadingText: { fontFamily: Fonts.sans, fontSize: 14, color: C.bodySoft },
    emptyNearby: { paddingVertical: 32, alignItems: 'center' },
    emptyNearbyText: { fontFamily: Fonts.sans, fontSize: 14, color: C.bodySoft, textAlign: 'center', lineHeight: 20 },

    // Value screen
    valueIconWrap: { marginBottom: 24, alignItems: 'center' },
    valuePoints:   { gap: 14, width: '100%', marginBottom: 32 },
    valuePoint: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      backgroundColor: C.bgCard,
      borderRadius: Radius.md,
      padding: 14,
      borderWidth: 0.5,
      borderColor: C.borderWarm,
    },
    valuePointIcon: {
      width: 36,
      height: 36,
      borderRadius: 10,
      backgroundColor: C.warnBg,
      alignItems: 'center',
      justifyContent: 'center',
    },
    valuePointText: { fontFamily: Fonts.sansMedium, fontSize: 14, color: C.body, flex: 1 },

    // Footer / CTA
    slideFooter: {
      paddingTop: 16,
      paddingBottom: Platform.OS === 'ios' ? 8 : 16,
    },
    primaryBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
      backgroundColor: C.ink,
      borderRadius: Radius.full,
      paddingVertical: 16,
    },
    primaryBtnDisabled: { opacity: 0.4 },
    primaryBtnText: {
      fontFamily: Fonts.sansMedium,
      fontSize: 15,
      color: '#FFFFFF',
    },
  });
}
