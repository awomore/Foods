import React, { useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Fonts, Spacing, Radius, Shadow } from '../src/constants/theme';

export default function ConfirmationScreen() {
  const router = useRouter();
  const { orderId } = useLocalSearchParams<{ orderId?: string }>();
  const scale = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const checkScale = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.spring(scale, { toValue: 1, tension: 60, friction: 8, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 300, useNativeDriver: true }),
      ]),
      Animated.spring(checkScale, { toValue: 1, tension: 80, friction: 6, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <View style={styles.root}>
      <SafeAreaView style={{ flex: 1 }}>
        <View style={styles.inner}>

          {/* Animated badge */}
          <Animated.View style={[styles.badge, { transform: [{ scale }], opacity }]}>
            <Animated.View style={{ transform: [{ scale: checkScale }] }}>
              <Ionicons name="checkmark" size={40} color={Colors.canvas} />
            </Animated.View>
          </Animated.View>

          {/* Copy */}
          <Text style={styles.headline}>You're at the table.</Text>
          <Text style={styles.sub}>
            Your portion has been claimed. The cook is on it.
          </Text>

          {/* Order card */}
          {orderId && (
            <View style={styles.card}>
              <View style={[styles.cardRow, { marginBottom: 0 }]}>
                <Text style={styles.cardLabel}>Order ref</Text>
                <Text style={styles.cardVal}>{orderId}</Text>
              </View>
            </View>
          )}

          {/* Hold note */}
          <View style={styles.holdPill}>
            <Ionicons name="time-outline" size={13} color={Colors.bodySoft} />
            <Text style={styles.holdText}>Your slot is confirmed and locked in</Text>
          </View>
        </View>

        {/* CTAs */}
        <View style={styles.ctaBar}>
          <TouchableOpacity
            onPress={() => orderId ? router.push(`/tracking/${orderId}`) : router.replace('/(customer)/orders')}
            style={styles.trackBtn}
            activeOpacity={0.85}
          >
            <Ionicons name="map-outline" size={16} color={Colors.canvas} />
            <Text style={styles.trackLabel}>Track my order</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => router.replace('/(customer)')}
            style={styles.homeBtn}
            activeOpacity={0.75}
          >
            <Text style={styles.homeLabel}>Back to home</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },
  inner: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.lg },

  badge: {
    width: 88, height: 88, borderRadius: 44,
    backgroundColor: Colors.spice,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 28,
    ...Shadow.lift,
  },

  headline: {
    fontFamily: Fonts.serif,
    fontSize: 30, color: Colors.textInk,
    textAlign: 'center', marginBottom: 12,
  },
  sub: {
    fontFamily: Fonts.sans, fontSize: 15, color: Colors.body,
    textAlign: 'center', lineHeight: 22, marginBottom: 32,
    paddingHorizontal: Spacing.lg,
  },

  card: {
    width: '100%',
    backgroundColor: Colors.bgCard, borderRadius: Radius.lg, padding: 18,
    borderWidth: 0.5, borderColor: Colors.borderWarm,
    ...Shadow.card,
    marginBottom: 16,
  },
  cardRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'flex-start', marginBottom: 12,
  },
  cardLabel: { fontFamily: Fonts.sans, fontSize: 13, color: Colors.bodySoft },
  cardVal: { fontFamily: Fonts.sansMedium, fontSize: 13, color: Colors.textInk },

  holdPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.cream, borderRadius: 40, paddingHorizontal: 14, paddingVertical: 7,
  },
  holdText: { fontFamily: Fonts.sans, fontSize: 12, color: Colors.bodySoft },

  ctaBar: { padding: Spacing.lg, paddingBottom: 36, gap: 10 },
  trackBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: Colors.ink, borderRadius: Radius.lg, paddingVertical: 16,
  },
  trackLabel: { fontFamily: Fonts.sansMedium, fontSize: 15, color: Colors.canvas },
  homeBtn: {
    alignItems: 'center', paddingVertical: 12,
  },
  homeLabel: { fontFamily: Fonts.sansMedium, fontSize: 14, color: Colors.spice },
});
