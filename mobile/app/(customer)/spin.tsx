import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, SafeAreaView, Animated,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { MOCK_COOKS, nairaFmt } from '../../src/data/mock';
import { useCart } from '../../src/context/CartContext';
import { Colors, Fonts, Spacing, Radius, Shadow } from '../../src/constants/theme';
import DishPhoto from '../../src/components/ui/DishPhoto';
import Avatar from '../../src/components/ui/Avatar';

// Flatten all dishes across all cooks
const ALL_DISHES = MOCK_COOKS.flatMap(cook =>
  [cook.todayDish, ...(cook.menu ?? [])].map(dish => ({ dish, cook }))
);

function getRandom(exclude: number) {
  let next = Math.floor(Math.random() * ALL_DISHES.length);
  if (ALL_DISHES.length > 1) while (next === exclude) next = Math.floor(Math.random() * ALL_DISHES.length);
  return next;
}

export default function SpinScreen() {
  const router = useRouter();
  const { addItem, items } = useCart();
  const [idx, setIdx] = useState(() => Math.floor(Math.random() * ALL_DISHES.length));
  const [spinning, setSpinning] = useState(false);
  const [added, setAdded] = useState<Set<string>>(new Set());

  const spinAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const { dish, cook } = ALL_DISHES[idx];

  function handleSpin() {
    if (spinning) return;
    setSpinning(true);

    // cycle through 5 random dishes with fade, then land on a new one
    let count = 0;
    const total = 5;
    const cycle = () => {
      Animated.timing(fadeAnim, { toValue: 0, duration: 120, useNativeDriver: true }).start(() => {
        setIdx(i => getRandom(i));
        count++;
        Animated.timing(fadeAnim, { toValue: 1, duration: 120, useNativeDriver: true }).start(() => {
          if (count < total) cycle();
          else setSpinning(false);
        });
      });
    };
    cycle();
  }

  function handleAddToTray() {
    addItem({
      cookId: cook.id,
      cookName: cook.name,
      menuItemId: dish.id,
      dishTitle: dish.title,
      price: dish.price,
      currencyCode: 'NGN',
      qty: 1,
      selectedSides: [],
      removedSides: [],
      allergenAcknowledged: false,
      deliveryWindow: '2pm – 3pm',
    });
    setAdded(a => new Set([...a, dish.id]));
  }

  const isAdded = added.has(dish.id);

  return (
    <View style={styles.root}>
      <SafeAreaView style={{ flex: 1 }}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Spin for meals</Text>
        </View>

        <View style={styles.body}>
          <Text style={styles.eyebrow}>Not sure what to eat?</Text>
          <Text style={styles.subCopy}>Let FOODS pick for you.</Text>

          {/* Dish card */}
          <Animated.View style={[styles.card, { opacity: fadeAnim }]}>
            <DishPhoto tint={dish.photoTint} label={dish.photoLabel} height={200} radius={12} />

            <View style={styles.cardBody}>
              {/* Cook row */}
              <TouchableOpacity
                onPress={() => router.push(`/cook/${cook.id}`)}
                style={styles.cookRow}
              >
                <Avatar name={cook.initial} avatarBg={cook.avatarBg} size={24} />
                <Text style={styles.cookName}>{cook.name}</Text>
                <Text style={styles.cookArea}>· {cook.area}</Text>
              </TouchableOpacity>

              {/* Dish info */}
              <Text style={styles.dishTitle} numberOfLines={2}>{dish.title}</Text>
              <View style={styles.metaRow}>
                <Text style={styles.dishPrice}>{nairaFmt(dish.price)}</Text>
                <View style={styles.slotPill}>
                  <Text style={styles.slotText}>{dish.slotsLeft} left</Text>
                </View>
              </View>

              {/* Actions */}
              <View style={styles.actions}>
                <TouchableOpacity onPress={handleSpin} style={styles.spinAgainBtn} activeOpacity={0.75}>
                  <Ionicons name="dice-outline" size={16} color={Colors.spice} />
                  <Text style={styles.spinAgainLabel}>Spin again</Text>
                </TouchableOpacity>

                {isAdded ? (
                  <View style={styles.addedBtn}>
                    <Ionicons name="checkmark" size={16} color={Colors.successFg} />
                    <Text style={styles.addedLabel}>In your tray</Text>
                  </View>
                ) : (
                  <TouchableOpacity onPress={handleAddToTray} style={styles.addBtn} activeOpacity={0.85}>
                    <Ionicons name="add" size={16} color={Colors.canvas} />
                    <Text style={styles.addLabel}>Add to tray</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </Animated.View>

          {/* Spin button */}
          <TouchableOpacity
            onPress={handleSpin}
            style={[styles.bigSpinBtn, spinning && styles.bigSpinBtnSpinning]}
            activeOpacity={0.85}
          >
            <Ionicons name="dice" size={26} color={Colors.ember} />
            <Text style={styles.bigSpinLabel}>{spinning ? 'Spinning…' : 'Spin'}</Text>
          </TouchableOpacity>
        </View>

        {/* Checkout bar */}
        {items.length > 0 && (
          <View style={styles.checkoutBar}>
            <TouchableOpacity
              onPress={() => router.push('/checkout')}
              style={styles.checkoutBtn}
              activeOpacity={0.85}
            >
              <Text style={styles.checkoutLabel}>
                Go to tray ({items.reduce((s, i) => s + i.qty, 0)})
              </Text>
              <Text style={styles.checkoutTotal}>
                {nairaFmt(items.reduce((s, i) => s + i.price * i.qty, 0))}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },
  header: { paddingHorizontal: Spacing.lg, paddingTop: 16, paddingBottom: 8 },
  headerTitle: { fontFamily: Fonts.serif, fontSize: 24, color: Colors.textInk },
  body: { flex: 1, paddingHorizontal: Spacing.lg, paddingTop: 4 },
  eyebrow: { fontFamily: Fonts.sans, fontSize: 13, color: Colors.bodySoft },
  subCopy: { fontFamily: Fonts.sansMedium, fontSize: 15, color: Colors.textInk, fontWeight: '600', marginBottom: 20 },

  card: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    borderWidth: 0.5, borderColor: Colors.borderWarm,
    overflow: 'hidden',
    ...Shadow.card,
    marginBottom: 20,
  },
  cardBody: { padding: 16 },
  cookRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  cookName: { fontFamily: Fonts.sansMedium, fontSize: 12, color: Colors.textInk, fontWeight: '600' },
  cookArea: { fontFamily: Fonts.sans, fontSize: 12, color: Colors.bodySoft },
  dishTitle: { fontFamily: Fonts.serif, fontSize: 18, color: Colors.textInk, lineHeight: 24, marginBottom: 8 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
  dishPrice: { fontFamily: Fonts.serif, fontSize: 20, color: Colors.spice },
  slotPill: { backgroundColor: Colors.honey, paddingHorizontal: 9, paddingVertical: 3, borderRadius: 40 },
  slotText: { fontFamily: Fonts.sans, fontSize: 11, color: '#5C3B16' },

  actions: { flexDirection: 'row', gap: 10 },
  spinAgainBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 11, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.borderWarm,
  },
  spinAgainLabel: { fontFamily: Fonts.sansMedium, fontSize: 13, color: Colors.spice },
  addBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 11, borderRadius: Radius.md,
    backgroundColor: Colors.ink,
  },
  addLabel: { fontFamily: Fonts.sansMedium, fontSize: 13, color: Colors.canvas, fontWeight: '600' },
  addedBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 11, borderRadius: Radius.md,
    backgroundColor: Colors.successBg,
  },
  addedLabel: { fontFamily: Fonts.sansMedium, fontSize: 13, color: Colors.successFg },

  bigSpinBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: Colors.ink, borderRadius: Radius.lg, paddingVertical: 18,
    ...Shadow.lift,
  },
  bigSpinBtnSpinning: { opacity: 0.7 },
  bigSpinLabel: { fontFamily: Fonts.sansMedium, fontSize: 17, color: Colors.canvas, fontWeight: '600' },

  checkoutBar: { padding: 16, paddingBottom: 0, borderTopWidth: 0.5, borderTopColor: Colors.borderWarm },
  checkoutBtn: {
    backgroundColor: Colors.spice, borderRadius: Radius.lg, paddingVertical: 14, paddingHorizontal: 20,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  checkoutLabel: { fontFamily: Fonts.sansMedium, fontSize: 14, color: Colors.canvas, fontWeight: '600' },
  checkoutTotal: { fontFamily: Fonts.serif, fontSize: 16, color: Colors.ember },
});
