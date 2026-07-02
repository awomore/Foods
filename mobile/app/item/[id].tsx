import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { menuApi } from '../../src/api/menu';
import { cooksApi, type CookDetail, type MenuItem } from '../../src/api/cooks';
import { trackEvent } from '../../src/utils/analytics';
import { cravingsApi } from '../../src/api/cravings';
import { notifyAvailableApi } from '../../src/api/notifyAvailable';
import { feedApi } from '../../src/api/feed';
import { useCart } from '../../src/context/CartContext';
import { useAuth } from '../../src/context/AuthContext';
import { Fonts, Spacing, Radius } from '../../src/constants/theme';
import { useColors, type AppColors } from '../../src/context/ThemeContext';
import { useFeedback } from '../../src/components/feedback';
import { fmtCurrency } from '../../src/utils/format';
import Avatar from '../../src/components/ui/Avatar';
import StatusDot from '../../src/components/ui/StatusDot';
import DishPhoto from '../../src/components/ui/DishPhoto';
import { Bone } from '../../src/components/ui/Skeleton';
import { useHealthProfile } from '../../src/hooks/useHealthProfile';
import { computeAllergenMatches } from '../../src/utils/allergens';
import { useTranslation } from 'react-i18next';
import i18n from '../../src/i18n/setup';

function buildDeliverySlots(): string[] {
  const now = new Date();
  const h = now.getHours();
  const slots: string[] = [];
  const fmt = (d: Date, label: string) => {
    const start = new Date(d);
    const end = new Date(d);
    end.setHours(end.getHours() + 2);
    const pad = (n: number) => String(n).padStart(2, '0');
    const fmt12 = (hh: number) => {
      const ampm = hh >= 12 ? 'pm' : 'am';
      const h12 = hh % 12 === 0 ? 12 : hh % 12;
      return `${h12}${ampm}`;
    };
    return `${label}, ${fmt12(start.getHours())}–${fmt12(end.getHours())}`;
  };
  const windows = [10, 12, 14, 16, 18];
  for (const wh of windows) {
    if (wh > h + 1) {
      const d = new Date(now); d.setHours(wh, 0, 0, 0);
      slots.push(fmt(d, i18n.t('item_detail.today')));
    }
  }
  for (const wh of [9, 12, 15, 18]) {
    const d = new Date(now); d.setDate(d.getDate() + 1); d.setHours(wh, 0, 0, 0);
    slots.push(fmt(d, i18n.t('item_detail.tomorrow')));
  }
  return slots.slice(0, 6);
}

const DELIVERY_SLOTS = buildDeliverySlots();

export default function ItemDetailScreen() {
  const router = useRouter();
  const { id, cookId } = useLocalSearchParams<{ id: string; cookId: string }>();
  const { addItem } = useCart();
  const { user } = useAuth();
  const { profile: healthProfile } = useHealthProfile();
  const C = useColors();
  const { t } = useTranslation();
  const styles = useMemo(() => makeStyles(C), [C]);

  const [item, setItem] = useState<(MenuItem & { cook_name: string; cook_username: string; cook_location: string | null }) | null>(null);
  const [cook, setCook] = useState<CookDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [qty, setQty] = useState(1);
  const [selectedSides, setSelectedSides] = useState<string[]>([]);
  const [allergenAcknowledged, setAllergenAcknowledged] = useState(false);
  const [deliveryTiming, setDeliveryTiming] = useState<'now' | 'scheduled'>('now');
  const [selectedWindow, setSelectedWindow] = useState<string | null>(null);
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [craved, setCraved] = useState(false);
  const feedback = useFeedback();
  const [craving, setCraving] = useState(false);
  const [watching, setWatching] = useState(false);
  const [watchLoading, setWatchLoading] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [{ item: i }, cookData] = await Promise.all([
        menuApi.get(id!),
        cookId ? cooksApi.get(cookId) : Promise.resolve(null),
      ]);
      setItem(i as any);
      if (cookData) setCook(cookData.cook);
      // Default: all included sides are selected
      const sides = (i as any).sides ?? [];
      setSelectedSides(sides.filter((s: any) => s.included).map((s: any) => s.name));
      trackEvent('dish_viewed', { source: cookId ? 'cook_profile' : 'direct' },
        { item_id: (i as any).id, cook_id: (i as any).cook_id });
    } catch (e: any) {
    } finally {
      setLoading(false);
    }
  }, [id, cookId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!user || !id) return;
    notifyAvailableApi.check(id).then(r => setWatching(r.watching)).catch(() => {});
  }, [user, id]);

  async function handleLike() {
    if (!user) return;
    const next = !liked;
    setLiked(next);
    setLikeCount(n => next ? n + 1 : n - 1);
    try {
      await feedApi.likeMenuItem(id!);
      trackEvent(next ? 'dish_liked' : 'dish_unliked', {},
        { item_id: id, cook_id: item?.cook_id });
    } catch {
      setLiked(!next);
      setLikeCount(n => next ? n - 1 : n + 1);
    }
  }

  async function handleCrave() {
    if (!user) {
      feedback.warn(t('item_detail.sign_in_required'), t('item_detail.sign_in_required_crave'));
      return;
    }
    if (!item) return;
    if (craved) {
      feedback.info(t('item_detail.already_craved'), t('item_detail.already_craved_body'));
      return;
    }
    setCraving(true);
    try {
      await cravingsApi.add({
        menu_item_id: item.id,
        cook_id: item.cook_id,
        dish_title: item.title,
        dish_price: item.unit_price,
        dish_photo: item.photos?.[0] ?? null,
        currency_code: item.currency_code,
      });
      setCraved(true);
      feedback.success(t('item_detail.added_to_cravings'), t('item_detail.added_to_cravings_body'));
    } catch (e: any) {
      feedback.error(t('common.error'), e.error ?? t('item_detail.add_craving_failed'));
    }
    setCraving(false);
  }

  async function handleNotifyMe() {
    if (!user) {
      feedback.confirm({
        title: t('item_detail.sign_in_to_notify'),
        message: t('item_detail.sign_in_to_notify_body'),
        confirmLabel: t('item_detail.sign_in'),
        cancelLabel: t('common.cancel'),
        onConfirm: () => router.push('/(auth)/welcome' as any),
      });
      return;
    }
    if (!item) return;
    setWatchLoading(true);
    try {
      if (watching) {
        await notifyAvailableApi.remove(item.id);
        setWatching(false);
        feedback.info(t('item_detail.removed'), t('item_detail.removed_body'));
      } else {
        await notifyAvailableApi.register(item.id);
        setWatching(true);
        feedback.success(t('item_detail.on_the_list'), t('item_detail.on_the_list_body'));
      }
    } catch (e: any) {
      feedback.error(t('common.error'), e.error ?? t('item_detail.notify_update_failed'));
    } finally {
      setWatchLoading(false);
    }
  }

  function toggleSide(name: string) {
    setSelectedSides(ss => ss.includes(name) ? ss.filter(x => x !== name) : [...ss, name]);
  }

  function handleClaim() {
    if (!item) return;

    // Guest gate — redirect to sign-in before any cart action
    if (!user) {
      feedback.confirm({
        title: t('item_detail.sign_in_to_order'),
        message: t('item_detail.sign_in_to_order_body'),
        confirmLabel: t('item_detail.sign_in'),
        cancelLabel: t('item_detail.browse_more'),
        onConfirm: () => router.push('/(auth)/welcome' as any),
      });
      return;
    }

    const sides = (item as any).sides ?? [];
    const removed = sides.filter((s: any) => !selectedSides.includes(s.name) && s.included).map((s: any) => s.name);

    addItem({
      menuItemId: item.id,
      cookId: item.cook_id,
      cookName: item.cook_name ?? cook?.display_name ?? 'Cook',
      dishTitle: item.title,
      price: item.unit_price,
      currencyCode: item.currency_code,
      qty,
      selectedSides,
      removedSides: removed,
      allergenAcknowledged,
      matchedAllergens,
      matchedIngredients,
      deliveryWindow: deliveryTiming === 'scheduled' ? (selectedWindow ?? undefined) : undefined,
    });
    trackEvent('cart_item_added', { qty, source: 'item_detail' },
      { item_id: item.id, cook_id: item.cook_id });
    router.push('/checkout');
  }

  if (loading) {
    return (
      <View style={styles.root}>
        <SafeAreaView style={{ flex: 1 }}>
          <Bone width="100%" height={280} radius={0} />
          <View style={{ padding: Spacing.lg, gap: 12 }}>
            <Bone width="30%" height={12} />
            <Bone width="80%" height={26} radius={6} />
            <Bone width="40%" height={18} radius={6} />
            <Bone width="100%" height={1} />
            <Bone width="100%" height={60} radius={10} />
            <Bone width="100%" height={52} radius={12} />
          </View>
        </SafeAreaView>
      </View>
    );
  }

  if (!item) {
    return (
      <View style={[styles.root, { alignItems: 'center', justifyContent: 'center', padding: 24 }]}>
        <Text style={{ fontFamily: Fonts.serif, fontSize: 20, color: C.textInk }}>{t('item_detail.dish_not_found')}</Text>
        <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 16 }}>
          <Text style={{ fontFamily: Fonts.sans, color: C.spice }}>{t('common.back')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const customerAllergens = healthProfile?.allergens ?? [];
  const { matchedAllergens, matchedIngredients } = computeAllergenMatches(
    customerAllergens,
    item.ingredients ?? [],
    item.allergens ?? [],
  );
  const allergenMatch = matchedAllergens;
  const slotsLeft = item.total_slots - item.slots_claimed;
  const sides = (item as any).sides ?? [];

  return (
    <View style={styles.root}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
        {/* Hero photo */}
        <View style={{ position: 'relative' }}>
          <DishPhoto
            uri={item.photos?.[0] ?? null}
            label={item.title}
            height={280}
            radius={0}
            isSoldOut={slotsLeft <= 0}
            slotsLeft={slotsLeft}
          />
          <SafeAreaView style={{ position: 'absolute', top: 0, left: 0, right: 0 }}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backPill}>
              <Ionicons name="chevron-back" size={18} color={C.textInk} />
            </TouchableOpacity>
          </SafeAreaView>
        </View>

        <View style={styles.content}>
          {/* Cook link */}
          <TouchableOpacity
            onPress={() => router.push(`/cook/${item.cook_id}`)}
            style={styles.cookRow}
          >
            <Avatar name={(item.cook_name ?? 'C').charAt(0)} avatarUrl={cook?.avatar_url} avatarBg={C.ember} size={28} />
            <Text style={styles.cookLink}>
              {t('item_detail.from_cook', { name: item.cook_name ?? cook?.display_name, location: item.cook_location ?? cook?.location ?? '' })}
            </Text>
            <StatusDot status={cook?.is_live ? 'cooking-now' : 'done'} />
          </TouchableOpacity>

          {/* Title + price */}
          <View style={styles.titleRow}>
            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.price}>{fmtCurrency(item.unit_price, item.currency_code)}</Text>
          </View>

          {/* Slots + credentials */}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
            <View style={[styles.slotPill, slotsLeft <= 2 && styles.slotPillLow]}>
              <Text style={[styles.slotText, slotsLeft <= 2 && styles.slotTextLow]}>
                {slotsLeft <= 0 ? t('item_detail.sold_out') : slotsLeft <= 2 ? t('item_detail.only_left', { count: slotsLeft }) : t('item_detail.of_total_left', { count: slotsLeft, total: item.total_slots })}
              </Text>
            </View>
            {cook?.food_safety_verified && (
              <View style={[styles.slotPill, { backgroundColor: C.infoBg }]}>
                <Text style={[styles.slotText, { color: C.infoFg }]}>{t('item_detail.food_safety_verified')}</Text>
              </View>
            )}
            {(item.like_count ?? 0) > 0 && (
              <View style={[styles.slotPill, { flexDirection: 'row', alignItems: 'center', gap: 4 }]}>
                <Ionicons name="heart" size={11} color={C.errorFg} />
                <Text style={styles.slotText}>{item.like_count}</Text>
              </View>
            )}
            {(item.craving_count ?? 0) > 0 && (
              <View style={[styles.slotPill, { flexDirection: 'row', alignItems: 'center', gap: 4 }]}>
                <Ionicons name="bookmark" size={11} color={C.spice} />
                <Text style={styles.slotText}>{t('item_detail.craving_count', { count: item.craving_count })}</Text>
              </View>
            )}
          </View>

          {/* Dietary labels */}
          {(item as any).dietary_labels?.length > 0 && (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
              {((item as any).dietary_labels as string[]).map((label: string) => {
                const ICONS: Record<string, string> = {
                  vegan: '🌱', vegetarian: '🥦', halal: '☪️', keto: '🥑',
                  gluten_free: '🌾', high_protein: '💪', low_carb: '📉',
                  diabetic_friendly: '🩺', low_sugar: '🍬', dairy_free: '🥛',
                };
                const DISPLAY: Record<string, string> = {
                  vegan: t('item_detail.diet_vegan'), vegetarian: t('item_detail.diet_vegetarian'), halal: t('item_detail.diet_halal'), keto: t('item_detail.diet_keto'),
                  gluten_free: t('item_detail.diet_gluten_free'), high_protein: t('item_detail.diet_high_protein'), low_carb: t('item_detail.diet_low_carb'),
                  diabetic_friendly: t('item_detail.diet_diabetic_friendly'), low_sugar: t('item_detail.diet_low_sugar'), dairy_free: t('item_detail.diet_dairy_free'),
                };
                return (
                  <View
                    key={label}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: C.healthBg, borderRadius: 40, paddingHorizontal: 9, paddingVertical: 4 }}
                  >
                    <Text style={{ fontSize: 11 }}>{ICONS[label] ?? '•'}</Text>
                    <Text style={{ fontFamily: Fonts.sansMedium, fontSize: 11, color: C.healthFg }}>
                      {DISPLAY[label] ?? label}
                    </Text>
                  </View>
                );
              })}
            </View>
          )}

          {/* Description */}
          {item.description && <Text style={styles.desc}>{item.description}</Text>}

          {/* Ingredients */}
          {item.ingredients?.length > 0 && (
            <View style={{ marginTop: 16 }}>
              <Text style={styles.sectionLabel}>{t('item_detail.ingredients')}</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 6, gap: 4 }}>
                {item.ingredients.map((ing, idx) => {
                  const isMatch = matchedIngredients.includes(ing);
                  return (
                    <Text
                      key={idx}
                      style={{
                        fontFamily: Fonts.sans,
                        fontSize: 13,
                        lineHeight: 20,
                        color: isMatch ? C.errorFg : C.body,
                        fontWeight: isMatch ? '600' : '400',
                      }}
                    >
                      {ing}{idx < item.ingredients.length - 1 ? ', ' : ''}
                    </Text>
                  );
                })}
              </View>
            </View>
          )}

          {/* Cook note */}
          {item.cook_note && (
            <View style={styles.noteBox}>
              <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start' }}>
                <Avatar name={(item.cook_name ?? 'C').charAt(0)} avatarUrl={cook?.avatar_url} avatarBg={C.ember} size={22} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.noteAuthor}>{t('item_detail.cook_says', { name: item.cook_name ?? cook?.display_name })}</Text>
                  <Text style={styles.noteText}>{item.cook_note}</Text>
                </View>
              </View>
            </View>
          )}

          {/* Allergen warning */}
          {allergenMatch.length > 0 && (
            <View style={styles.allergenBox}>
              <Ionicons name="warning" size={16} color={C.errorFg} />
              <View style={{ flex: 1 }}>
                <Text style={styles.allergenTitle}>{t('item_detail.allergen_warning_title')}</Text>
                <Text style={styles.allergenText}>
                  {t('item_detail.allergen_warning_body', {
                    items: matchedIngredients.length > 0 ? matchedIngredients.join(', ') : allergenMatch.join(', '),
                    allergens: allergenMatch.join(', '),
                  })}
                </Text>
                <TouchableOpacity
                  style={{ flexDirection: 'row', gap: 6, alignItems: 'center', marginTop: 10 }}
                  onPress={() => setAllergenAcknowledged(a => !a)}
                >
                  <View style={[styles.sideCheck, allergenAcknowledged && styles.sideCheckActive]}>
                    {allergenAcknowledged && <Ionicons name="checkmark" size={12} color={C.canvas} />}
                  </View>
                  <Text style={{ fontFamily: Fonts.sans, fontSize: 12, color: C.errorFg }}>
                    {t('item_detail.allergen_acknowledge')}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Sides */}
          {sides.length > 0 && (
            <View style={styles.sidesSection}>
              <Text style={styles.sectionLabel}>{t('item_detail.comes_with')}</Text>
              {sides.map((s: any) => (
                <TouchableOpacity
                  key={s.name}
                  onPress={() => s.optional && toggleSide(s.name)}
                  style={styles.sideRow}
                >
                  <View style={[styles.sideCheck, selectedSides.includes(s.name) && styles.sideCheckActive]}>
                    {selectedSides.includes(s.name) && <Ionicons name="checkmark" size={12} color={C.canvas} />}
                  </View>
                  <Text style={styles.sideName}>{s.name}</Text>
                  {!s.optional && (
                    <View style={styles.includedPill}><Text style={styles.includedText}>{t('item_detail.included')}</Text></View>
                  )}
                  {s.optional && !s.included && (
                    <Text style={styles.optionalText}>{t('item_detail.optional')}</Text>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Qty */}
          <View style={styles.qtyRow}>
            <Text style={styles.sectionLabel}>{t('item_detail.portions')}</Text>
            <View style={styles.qtyControls}>
              <TouchableOpacity onPress={() => setQty(q => Math.max(1, q - 1))} style={styles.qtyBtn}>
                <Ionicons name="remove" size={18} color={C.body} />
              </TouchableOpacity>
              <Text style={styles.qtyNum}>{qty}</Text>
              <TouchableOpacity
                onPress={() => setQty(q => Math.min(slotsLeft, q + 1))}
                style={[styles.qtyBtn, styles.qtyBtnActive]}
                disabled={qty >= slotsLeft}
              >
                <Ionicons name="add" size={18} color={C.canvas} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Delivery timing */}
          <View style={{ marginTop: 20 }}>
            <Text style={styles.sectionLabel}>{t('item_detail.when_do_you_want')}</Text>
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
              <TouchableOpacity
                style={[styles.timingChip, deliveryTiming === 'now' && styles.timingChipActive]}
                onPress={() => { setDeliveryTiming('now'); setSelectedWindow(null); }}
              >
                <Ionicons name="flash-outline" size={14} color={deliveryTiming === 'now' ? C.canvas : C.bodySoft} />
                <Text style={[styles.timingChipText, deliveryTiming === 'now' && styles.timingChipTextActive]}>{t('item_detail.order_now')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.timingChip, deliveryTiming === 'scheduled' && styles.timingChipActive]}
                onPress={() => setDeliveryTiming('scheduled')}
              >
                <Ionicons name="calendar-outline" size={14} color={deliveryTiming === 'scheduled' ? C.canvas : C.bodySoft} />
                <Text style={[styles.timingChipText, deliveryTiming === 'scheduled' && styles.timingChipTextActive]}>{t('item_detail.schedule')}</Text>
              </TouchableOpacity>
            </View>
            {deliveryTiming === 'scheduled' && (
              <View style={{ gap: 8 }}>
                {DELIVERY_SLOTS.map(slot => (
                  <TouchableOpacity
                    key={slot}
                    style={[styles.slotRow, selectedWindow === slot && styles.slotRowActive]}
                    onPress={() => setSelectedWindow(slot)}
                    activeOpacity={0.75}
                  >
                    <Ionicons name="time-outline" size={15} color={selectedWindow === slot ? C.spice : C.bodySoft} />
                    <Text style={[styles.slotRowText, selectedWindow === slot && { color: C.spice }]}>{slot}</Text>
                    {selectedWindow === slot && <Ionicons name="checkmark-circle" size={16} color={C.spice} />}
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        </View>
      </ScrollView>

      {/* Sticky CTA */}
      <View style={styles.stickyBar}>
        {/* Price + delivery fee disclosure */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 2, marginBottom: 10 }}>
          <Text style={{ fontFamily: Fonts.serif, fontSize: 18, color: C.textInk }}>
            {fmtCurrency(item.unit_price * qty, item.currency_code)}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Ionicons name="bicycle-outline" size={13} color={C.bodySoft} />
            <Text style={{ fontFamily: Fonts.sans, fontSize: 12, color: C.bodySoft }}>
              {t('item_detail.delivery_shown_at_checkout')}
            </Text>
          </View>
        </View>
        <View style={styles.stickyActions}>
          <TouchableOpacity style={styles.iconAction} onPress={handleLike} activeOpacity={0.7}>
            <Ionicons name={liked ? 'heart' : 'heart-outline'} size={22} color={liked ? C.errorFg : C.bodySoft} />
            {likeCount > 0 && <Text style={styles.iconActionCount}>{likeCount}</Text>}
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.craveBtn, craved && styles.craveBtnActive]}
            onPress={handleCrave}
            disabled={craving || craved}
            activeOpacity={0.8}
          >
            {craving
              ? <ActivityIndicator size="small" color={craved ? C.spice : C.canvas} />
              : <>
                  <Ionicons name={craved ? 'bookmark' : 'bookmark-outline'} size={15} color={craved ? C.spice : C.canvas} />
                  <Text style={[styles.craveBtnText, craved && { color: C.spice }]}>
                    {craved ? t('item_detail.craved') : t('item_detail.crave')}
                  </Text>
                </>}
          </TouchableOpacity>
        </View>
        {slotsLeft <= 0 ? (
          <TouchableOpacity
            onPress={handleNotifyMe}
            style={[styles.claimBtn, { backgroundColor: watching ? C.bgCard : C.ink, borderWidth: watching ? 1 : 0, borderColor: C.borderWarm }]}
            activeOpacity={0.85}
            disabled={watchLoading}
          >
            {watchLoading ? (
              <ActivityIndicator color={watching ? C.bodySoft : C.canvas} />
            ) : (
              <>
                <Ionicons name={watching ? 'notifications' : 'notifications-outline'} size={16} color={watching ? C.bodySoft : C.canvas} />
                <Text style={[styles.claimLabel, { color: watching ? C.bodySoft : C.canvas }]}>
                  {watching ? t('item_detail.on_the_list_short') : t('item_detail.notify_when_back')}
                </Text>
              </>
            )}
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            onPress={handleClaim}
            style={[styles.claimBtn, (allergenMatch.length > 0 && !allergenAcknowledged) && { opacity: 0.5 }]}
            activeOpacity={0.85}
            disabled={(allergenMatch.length > 0 && !allergenAcknowledged) || (deliveryTiming === 'scheduled' && !selectedWindow)}
          >
            <Text style={styles.claimLabel}>
              {deliveryTiming === 'scheduled' && !selectedWindow
                ? t('item_detail.pick_time_slot')
                : deliveryTiming === 'scheduled' && selectedWindow
                ? (qty > 1 ? t('item_detail.claim_portions_scheduled', { count: qty }) : t('item_detail.claim_portion_scheduled'))
                : (qty > 1 ? t('item_detail.claim_portions', { count: qty }) : t('item_detail.claim_portion'))}
            </Text>
            <Text style={styles.claimPrice}>{fmtCurrency(item.unit_price * qty, item.currency_code)}</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

function makeStyles(C: AppColors) { return StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  backPill: { margin: 16, width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255, 255, 255,0.88)', alignItems: 'center', justifyContent: 'center' },
  content: { padding: Spacing.lg },
  cookRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  cookLink: { fontFamily: Fonts.sans, fontSize: 12, color: C.bodySoft, flex: 1 },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 },
  title: { fontFamily: Fonts.serif, fontSize: 22, color: C.textInk, lineHeight: 28, flex: 1 },
  price: { fontFamily: Fonts.serif, fontSize: 24, color: C.spice, flexShrink: 0 },
  slotPill: { backgroundColor: C.honey, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 40 },
  slotPillLow: { backgroundColor: C.errorBg },
  slotText: { fontFamily: Fonts.sansMedium, fontSize: 11, color: '#5C3B16' },
  slotTextLow: { color: C.errorFg },
  desc: { fontFamily: Fonts.sans, fontSize: 14, color: C.body, lineHeight: 22, marginTop: 16 },
  noteBox: { backgroundColor: C.honey, borderRadius: 12, padding: 14, marginTop: 16 },
  noteAuthor: { fontFamily: Fonts.sansMedium, fontSize: 12, color: '#5C3B16' },
  noteText: { fontFamily: Fonts.sans, fontSize: 12, color: '#5C3B16', lineHeight: 18, fontStyle: 'italic', marginTop: 4 },
  allergenBox: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', backgroundColor: C.errorBg, borderRadius: 12, padding: 14, marginTop: 14, borderWidth: 0.5, borderColor: 'rgba(192,57,43,0.2)' },
  allergenTitle: { fontFamily: Fonts.sansMedium, fontSize: 13, color: C.errorFg },
  allergenText: { fontFamily: Fonts.sans, fontSize: 12, color: C.errorFg, opacity: 0.85, marginTop: 2, lineHeight: 18 },
  sidesSection: { marginTop: 20 },
  sectionLabel: { fontFamily: Fonts.sansMedium, fontSize: 14, color: C.textInk, marginBottom: 10 },
  sideRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11, borderBottomWidth: 0.5, borderBottomColor: C.borderWarm },
  sideCheck: { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: C.borderWarm, alignItems: 'center', justifyContent: 'center' },
  sideCheckActive: { backgroundColor: C.spice, borderColor: C.spice },
  sideName: { fontFamily: Fonts.sans, fontSize: 13, color: C.body, flex: 1 },
  includedPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 40, backgroundColor: C.bgCook, borderWidth: 0.5, borderColor: C.borderWarm },
  includedText: { fontFamily: Fonts.sans, fontSize: 10, color: C.textInk },
  optionalText: { fontFamily: Fonts.sans, fontSize: 12, color: C.bodySoft },
  qtyRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 20 },
  qtyControls: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  qtyBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: C.bgCook, borderWidth: 0.5, borderColor: C.borderWarm, alignItems: 'center', justifyContent: 'center' },
  qtyBtnActive: { backgroundColor: C.ink, borderWidth: 0 },
  qtyNum: { fontFamily: Fonts.serif, fontSize: 22, color: C.spice, minWidth: 22, textAlign: 'center' },
  stickyBar: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 16, paddingBottom: 36, backgroundColor: C.bg, borderTopWidth: 0.5, borderTopColor: C.borderWarm, gap: 10 },
  stickyActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconAction: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 8 },
  iconActionCount: { fontFamily: Fonts.sansMedium, fontSize: 12, color: C.bodySoft },
  craveBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.ink, borderRadius: 40, paddingHorizontal: 16, paddingVertical: 9 },
  craveBtnActive: { backgroundColor: C.bgCard, borderWidth: 1, borderColor: C.spice },
  craveBtnText: { fontFamily: Fonts.sansMedium, fontSize: 13, color: C.canvas },
  claimBtn: { backgroundColor: C.ink, borderRadius: Radius.lg, paddingVertical: 16, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  claimLabel: { fontFamily: Fonts.sansMedium, fontSize: 15, color: C.canvas },
  claimPrice: { fontFamily: Fonts.serif, fontSize: 18, color: C.ember },
  timingChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 10, borderRadius: Radius.full, borderWidth: 1, borderColor: C.borderWarm, backgroundColor: C.bgCard },
  timingChipActive: { backgroundColor: C.ink, borderColor: C.ink },
  timingChipText: { fontFamily: Fonts.sansMedium, fontSize: 13, color: C.bodySoft },
  timingChipTextActive: { color: C.canvas },
  slotRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: Radius.md, borderWidth: 0.5, borderColor: C.borderWarm, backgroundColor: C.bgCard },
  slotRowActive: { borderColor: C.spice, backgroundColor: C.bgCook },
  slotRowText: { fontFamily: Fonts.sans, fontSize: 13, color: C.body, flex: 1 },
}); }
