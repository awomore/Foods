import React, { useState, useRef, useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { MOCK_COOKS, nairaFmt } from '../../src/data/mock';
import { useCart } from '../../src/context/CartContext';
import { Fonts, Spacing, Radius, Shadow } from '../../src/constants/theme';
import { useColors, type AppColors } from '../../src/context/ThemeContext';
import DishPhoto from '../../src/components/ui/DishPhoto';
import Avatar from '../../src/components/ui/Avatar';

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
  const C = useColors();
  const styles = useMemo(() => makeStyles(C), [C]);
  const { addItem, items } = useCart();
  const [idx, setIdx] = useState(() => Math.floor(Math.random() * ALL_DISHES.length));
  const [spinning, setSpinning] = useState(false);
  const [added, setAdded] = useState<Set<string>>(new Set());

  const fadeAnim = useRef(new Animated.Value(1)).current;

  const { dish, cook } = ALL_DISHES[idx];

  function handleSpin() {
    if (spinning) return;
    setSpinning(true);

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
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Spin for meals</Text>
        </View>

        <View style={styles.body}>
          <Text style={styles.eyebrow}>Not sure what to eat?</Text>
          <Text style={styles.subCopy}>Let FOODS pick for you.</Text>

          <Animated.View style={[styles.card, { opacity: fadeAnim }]}>
            <DishPhoto tint={dish.photoTint} label={dish.photoLabel} height={200} radius={12} />

            <View style={styles.cardBody}>
              <TouchableOpacity
                onPress={() => router.push(`/cook/${cook.id}`)}
                style={styles.cookRow}
              >
                <Avatar name={cook.initial} avatarBg={cook.avatarBg} size={24} />
                <Text style={styles.cookName}>{cook.name}</Text>
                <Text style={styles.cookArea}>· {cook.area}</Text>
              </TouchableOpacity>

              <Text style={styles.dishTitle} numberOfLines={2}>{dish.title}</Text>
              <View style={styles.metaRow}>
                <Text style={styles.dishPrice}>{nairaFmt(dish.price)}</Text>
                <View style={styles.slotPill}>
                  <Text style={styles.slotText}>{dish.slotsLeft} left</Text>
                </View>
              </View>

              <View style={styles.actions}>
                <TouchableOpacity onPress={handleSpin} style={styles.spinAgainBtn} activeOpacity={0.75}>
                  <Ionicons name="dice-outline" size={16} color={C.spice} />
                  <Text style={styles.spinAgainLabel}>Spin again</Text>
                </TouchableOpacity>

                {isAdded ? (
                  <View style={styles.addedBtn}>
                    <Ionicons name="checkmark" size={16} color={C.successFg} />
                    <Text style={styles.addedLabel}>In your tray</Text>
                  </View>
                ) : (
                  <TouchableOpacity onPress={handleAddToTray} style={styles.addBtn} activeOpacity={0.85}>
                    <Ionicons name="add" size={16} color={C.canvas} />
                    <Text style={styles.addLabel}>Add to tray</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </Animated.View>

          <TouchableOpacity
            onPress={handleSpin}
            style={[styles.bigSpinBtn, spinning && styles.bigSpinBtnSpinning]}
            activeOpacity={0.85}
          >
            <Ionicons name="dice" size={26} color={C.ember} />
            <Text style={styles.bigSpinLabel}>{spinning ? 'Spinning…' : 'Spin'}</Text>
          </TouchableOpacity>
        </View>

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

function makeStyles(C: AppColors) { return StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  header: { paddingHorizontal: Spacing.lg, paddingTop: 16, paddingBottom: 8 },
  headerTitle: { fontFamily: Fonts.serif, fontSize: 24, color: C.textInk },
  body: { flex: 1, paddingHorizontal: Spacing.lg, paddingTop: 4 },
  eyebrow: { fontFamily: Fonts.sans, fontSize: 13, color: C.bodySoft },
  subCopy: { fontFamily: Fonts.sansMedium, fontSize: 15, color: C.textInk, marginBottom: 20 },

  card: {
    backgroundColor: C.bgCard,
    borderRadius: Radius.lg,
    borderWidth: 0.5, borderColor: C.borderWarm,
    overflow: 'hidden',
    ...Shadow.card,
    marginBottom: 20,
  },
  cardBody: { padding: 16 },
  cookRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  cookName: { fontFamily: Fonts.sansMedium, fontSize: 12, color: C.textInk },
  cookArea: { fontFamily: Fonts.sans, fontSize: 12, color: C.bodySoft },
  dishTitle: { fontFamily: Fonts.serif, fontSize: 18, color: C.textInk, lineHeight: 24, marginBottom: 8 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
  dishPrice: { fontFamily: Fonts.serif, fontSize: 20, color: C.spice },
  slotPill: { backgroundColor: C.honey, paddingHorizontal: 9, paddingVertical: 3, borderRadius: 40 },
  slotText: { fontFamily: Fonts.sans, fontSize: 11, color: C.warnFg },

  actions: { flexDirection: 'row', gap: 10 },
  spinAgainBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 11, borderRadius: Radius.md,
    borderWidth: 1, borderColor: C.borderWarm,
  },
  spinAgainLabel: { fontFamily: Fonts.sansMedium, fontSize: 13, color: C.spice },
  addBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 11, borderRadius: Radius.md,
    backgroundColor: C.ink,
  },
  addLabel: { fontFamily: Fonts.sansMedium, fontSize: 13, color: C.canvas },
  addedBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 11, borderRadius: Radius.md,
    backgroundColor: C.successBg,
  },
  addedLabel: { fontFamily: Fonts.sansMedium, fontSize: 13, color: C.successFg },

  bigSpinBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: C.ink, borderRadius: Radius.lg, paddingVertical: 18,
    ...Shadow.lift,
  },
  bigSpinBtnSpinning: { opacity: 0.7 },
  bigSpinLabel: { fontFamily: Fonts.sansMedium, fontSize: 17, color: C.canvas },

  checkoutBar: { padding: 16, paddingBottom: 0, borderTopWidth: 0.5, borderTopColor: C.borderWarm },
  checkoutBtn: {
    backgroundColor: C.spice, borderRadius: Radius.lg, paddingVertical: 14, paddingHorizontal: 20,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  checkoutLabel: { fontFamily: Fonts.sansMedium, fontSize: 14, color: C.canvas },
  checkoutTotal: { fontFamily: Fonts.serif, fontSize: 16, color: C.ember },
}); }
