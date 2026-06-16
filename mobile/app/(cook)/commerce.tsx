import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { invoicesApi, type Invoice } from '../../src/api/invoices';
import { digitalProductsApi, type DigitalProduct } from '../../src/api/digitalProducts';
import { coursesApi, type Course } from '../../src/api/courses';
import { subscriptionsApi, type SubscriptionTier } from '../../src/api/subscriptions';
import { healthKitchenApi, type MealPlan, type Subscriber, SPECIALISATION_LABELS } from '../../src/api/healthKitchen';
import { useColors, type AppColors } from '../../src/context/ThemeContext';
import { Fonts, Spacing, Radius, Shadow, FontSize } from '../../src/constants/theme';
import { fmtCurrency, relativeTime } from '../../src/utils/format';
import { Bone } from '../../src/components/ui/Skeleton';

type Tab = 'invoices' | 'products' | 'courses' | 'subscriptions' | 'meal_plans' | 'subscribers';

const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: 'invoices',      label: 'Invoices',      icon: 'receipt-outline' },
  { key: 'products',      label: 'Store',          icon: 'storefront-outline' },
  { key: 'courses',       label: 'Courses',        icon: 'school-outline' },
  { key: 'subscriptions', label: 'Memberships',    icon: 'star-outline' },
  { key: 'meal_plans',    label: 'Meal Plans',     icon: 'leaf-outline' },
  { key: 'subscribers',   label: 'Subscribers',    icon: 'people-outline' },
];

const INVOICE_STATUS_COLORS: Record<string, string> = {
  draft: '#9CA3AF', sent: '#2A5FBF', paid: '#2E8B3F',
  overdue: '#DC2626', cancelled: '#9CA3AF', partial: '#FF6B35',
};

export default function CommerceScreen() {
  const router = useRouter();
  const C = useColors();
  const styles = useMemo(() => makeStyles(C), [C]);
  const [tab, setTab] = useState<Tab>('invoices');
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [products, setProducts] = useState<DigitalProduct[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [tiers, setTiers] = useState<SubscriptionTier[]>([]);
  const [mealPlans, setMealPlans] = useState<MealPlan[]>([]);
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    try {
      const [invRes, prodRes, courseRes, tierRes, planRes, subRes] = await Promise.allSettled([
        invoicesApi.list(),
        digitalProductsApi.myProducts(),
        coursesApi.myCourses(),
        subscriptionsApi.tiers('me'),
        healthKitchenApi.myCreatorPlans(),
        healthKitchenApi.mySubscribers(),
      ]);
      if (invRes.status === 'fulfilled') setInvoices(invRes.value.invoices ?? []);
      if (prodRes.status === 'fulfilled') setProducts(prodRes.value.products ?? []);
      if (courseRes.status === 'fulfilled') setCourses(courseRes.value.courses ?? []);
      if (tierRes.status === 'fulfilled') setTiers(tierRes.value.tiers ?? []);
      if (planRes.status === 'fulfilled') setMealPlans(planRes.value.plans ?? []);
      if (subRes.status === 'fulfilled') setSubscribers(subRes.value.subscribers ?? []);
    } catch {}
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={C.ink} />
        </TouchableOpacity>
        <Text style={styles.title}>Creator Commerce</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Tab bar */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabBar} contentContainerStyle={styles.tabBarContent}>
        {TABS.map(t => (
          <TouchableOpacity
            key={t.key}
            style={[styles.tabItem, tab === t.key && styles.tabItemActive]}
            onPress={() => setTab(t.key)}
          >
            <Ionicons name={t.icon as any} size={15} color={tab === t.key ? C.canvas : C.bodySoft} />
            <Text style={[styles.tabLabel, tab === t.key && styles.tabLabelActive]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading ? (
        <View style={{ flex: 1, padding: Spacing.lg, gap: 12 }}>
          <Bone width="100%" height={80} radius={12} />
          <Bone width="100%" height={80} radius={12} />
          <Bone width="100%" height={80} radius={12} />
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} />}>
          {tab === 'invoices' && (
            <InvoicesTab invoices={invoices} router={router} C={C} styles={styles} />
          )}
          {tab === 'products' && (
            <ProductsTab products={products} router={router} C={C} styles={styles} />
          )}
          {tab === 'courses' && (
            <CoursesTab courses={courses} router={router} C={C} styles={styles} />
          )}
          {tab === 'subscriptions' && (
            <SubscriptionsTab tiers={tiers} router={router} C={C} styles={styles} />
          )}
          {tab === 'meal_plans' && (
            <MealPlansTab plans={mealPlans} router={router} C={C} styles={styles} />
          )}
          {tab === 'subscribers' && (
            <SubscribersTab subscribers={subscribers} router={router} C={C} styles={styles} />
          )}
        </ScrollView>
      )}

      {/* FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => {
          const routes: Record<Tab, string> = {
            invoices:      '/invoice/create',
            products:      '/product/create',
            courses:       '/course/create',
            subscriptions: '/subscription/tiers',
            meal_plans:    '/(cook)/health-plans',
            subscribers:   '/(cook)/health-subscribers',
          };
          router.push(routes[tab] as any);
        }}
      >
        <Ionicons name="add" size={26} color={C.canvas} />
      </TouchableOpacity>
    </SafeAreaView>
  );
}

function InvoicesTab({ invoices, router, C, styles }: any) {
  const total = invoices.filter((i: Invoice) => i.status === 'paid').reduce((s: number, i: Invoice) => s + i.paid_amount, 0);
  return (
    <View style={{ gap: Spacing.md }}>
      <View style={styles.summaryCard}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>{invoices.length}</Text>
          <Text style={styles.summaryLabel}>Total</Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>{invoices.filter((i: Invoice) => i.status === 'paid').length}</Text>
          <Text style={styles.summaryLabel}>Paid</Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={[styles.summaryValue, { color: C.spice }]}>{fmtCurrency(total, 'NGN')}</Text>
          <Text style={styles.summaryLabel}>Earned</Text>
        </View>
      </View>

      {!invoices.length ? (
        <EmptyState icon="receipt-outline" title="No invoices yet" body="Create your first invoice to start getting paid." ctaLabel="Create Invoice" onCta={() => router.push('/invoice/create' as any)} C={C} styles={styles} />
      ) : (
        invoices.map((inv: Invoice) => (
          <TouchableOpacity
            key={inv.id}
            style={styles.listCard}
            onPress={() => router.push({ pathname: '/invoice/[id]', params: { id: inv.id } } as any)}
          >
            <View style={styles.listCardLeft}>
              <Text style={styles.listCardTitle}>{inv.invoice_number}</Text>
              <Text style={styles.listCardSub}>{inv.customer_name} · {relativeTime(inv.created_at)}</Text>
            </View>
            <View style={styles.listCardRight}>
              <Text style={styles.listCardAmount}>{fmtCurrency(inv.total, 'NGN')}</Text>
              <View style={[styles.statusDot, { backgroundColor: INVOICE_STATUS_COLORS[inv.status] ?? C.bodySoft }]}>
                <Text style={styles.statusDotText}>{inv.status}</Text>
              </View>
            </View>
          </TouchableOpacity>
        ))
      )}
    </View>
  );
}


function ProductsTab({ products, router, C, styles }: any) {
  return (
    <View style={{ gap: Spacing.md }}>
      {!products.length ? (
        <EmptyState icon="storefront-outline" title="No digital products yet" body="Create recipe books, meal plans and more to sell to your audience." C={C} styles={styles} />
      ) : (
        products.map((p: DigitalProduct) => (
          <TouchableOpacity
            key={p.id}
            style={styles.listCard}
            onPress={() => router.push({ pathname: '/product/edit/[id]', params: { id: p.id } } as any)}
          >
            <View style={styles.listCardLeft}>
              <Text style={styles.listCardTitle}>{p.title}</Text>
              <Text style={styles.listCardSub}>{p.type.replace('_',' ')} · {p.download_count} downloads</Text>
            </View>
            <View style={styles.listCardRight}>
              <Text style={styles.listCardAmount}>{fmtCurrency(p.price, 'NGN')}</Text>
              <View style={[styles.statusDot, { backgroundColor: p.is_published ? C.leaf : C.bodySoft }]}>
                <Text style={styles.statusDotText}>{p.is_published ? 'live' : 'draft'}</Text>
              </View>
            </View>
          </TouchableOpacity>
        ))
      )}
    </View>
  );
}

function CoursesTab({ courses, router, C, styles }: any) {
  return (
    <View style={{ gap: Spacing.md }}>
      {!courses.length ? (
        <EmptyState icon="school-outline" title="No courses yet" body="Create a cooking course to teach and earn from your knowledge." C={C} styles={styles} />
      ) : (
        courses.map((c: Course) => (
          <TouchableOpacity
            key={c.id}
            style={styles.listCard}
            onPress={() => router.push({ pathname: '/course/[id]', params: { id: c.id } } as any)}
          >
            <View style={styles.listCardLeft}>
              <Text style={styles.listCardTitle}>{c.title}</Text>
              <Text style={styles.listCardSub}>{c.lesson_count} lessons · {c.enrollment_count} enrolled</Text>
            </View>
            <View style={styles.listCardRight}>
              <Text style={styles.listCardAmount}>{c.is_free ? 'Free' : fmtCurrency(c.price, 'NGN')}</Text>
              <View style={[styles.statusDot, { backgroundColor: c.is_published ? C.leaf : C.bodySoft }]}>
                <Text style={styles.statusDotText}>{c.is_published ? 'live' : 'draft'}</Text>
              </View>
            </View>
          </TouchableOpacity>
        ))
      )}
    </View>
  );
}

function SubscriptionsTab({ tiers, router, C, styles }: any) {
  const activeCount = tiers.filter((t: SubscriptionTier) => t.is_active).length;
  return (
    <View style={{ gap: Spacing.md }}>
      {tiers.length > 0 && (
        <View style={styles.summaryCard}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>{tiers.length}</Text>
            <Text style={styles.summaryLabel}>Tiers</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>{activeCount}</Text>
            <Text style={styles.summaryLabel}>Active</Text>
          </View>
        </View>
      )}

      {!tiers.length ? (
        <EmptyState icon="star-outline" title="No membership tiers yet" body="Create tiers to offer exclusive content, early access, and perks to your biggest fans." ctaLabel="Create Tier" onCta={() => router.push('/subscription/tiers' as any)} C={C} styles={styles} />
      ) : (
        tiers.map((t: SubscriptionTier) => (
          <TouchableOpacity
            key={t.id}
            style={styles.listCard}
            onPress={() => router.push({ pathname: '/subscription/tiers', params: { id: t.id } } as any)}
          >
            <View style={styles.listCardLeft}>
              <Text style={styles.listCardTitle}>{t.name}</Text>
              <Text style={styles.listCardSub}>
                {t.billing_period.charAt(0).toUpperCase() + t.billing_period.slice(1)}
                {t.benefits?.length ? ` · ${t.benefits.length} benefit${t.benefits.length > 1 ? 's' : ''}` : ''}
              </Text>
              {t.benefits?.slice(0, 2).map((b: string, i: number) => (
                <Text key={i} style={[styles.listCardSub, { marginTop: 2 }]}>· {b}</Text>
              ))}
            </View>
            <View style={styles.listCardRight}>
              <Text style={styles.listCardAmount}>{fmtCurrency(t.price, 'NGN')}</Text>
              <View style={[styles.statusDot, { backgroundColor: t.is_active ? C.leaf : C.bodySoft }]}>
                <Text style={styles.statusDotText}>{t.is_active ? 'active' : 'off'}</Text>
              </View>
            </View>
          </TouchableOpacity>
        ))
      )}
    </View>
  );
}

function MealPlansTab({ plans, router, C, styles }: any) {
  const published = plans.filter((p: MealPlan) => p.is_published).length;
  return (
    <View style={{ gap: Spacing.md }}>
      {plans.length > 0 && (
        <View style={styles.summaryCard}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>{plans.length}</Text>
            <Text style={styles.summaryLabel}>Plans</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>{published}</Text>
            <Text style={styles.summaryLabel}>Published</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryValue, { color: C.spice }]}>
              {plans.reduce((s: number, p: MealPlan) => s + p.subscriber_count, 0)}
            </Text>
            <Text style={styles.summaryLabel}>Subscribers</Text>
          </View>
        </View>
      )}
      {!plans.length ? (
        <EmptyState icon="leaf-outline" title="No meal plans yet" body="Create structured meal plans to guide your health-focused customers." ctaLabel="Create Plan" onCta={() => router.push('/(cook)/health-plans' as any)} C={C} styles={styles} />
      ) : (
        plans.map((p: MealPlan) => (
          <TouchableOpacity
            key={p.id}
            style={styles.listCard}
            onPress={() => router.push({ pathname: '/health/plan/[id]', params: { id: p.id } } as any)}
          >
            <View style={styles.listCardLeft}>
              <Text style={styles.listCardTitle}>{p.title}</Text>
              <Text style={styles.listCardSub}>
                {p.target_condition ? SPECIALISATION_LABELS[p.target_condition] ?? p.target_condition : 'General'}
                {' · '}{p.duration_weeks}w · {p.meals_per_day} meals/day
              </Text>
              <Text style={styles.listCardSub}>{p.subscriber_count} subscriber{p.subscriber_count !== 1 ? 's' : ''}</Text>
            </View>
            <View style={styles.listCardRight}>
              <Text style={styles.listCardAmount}>{p.price > 0 ? fmtCurrency(p.price, p.currency ?? 'NGN') : 'Free'}</Text>
              <View style={[styles.statusDot, { backgroundColor: p.is_published ? C.leaf : C.bodySoft }]}>
                <Text style={styles.statusDotText}>{p.is_published ? 'live' : 'draft'}</Text>
              </View>
            </View>
          </TouchableOpacity>
        ))
      )}
    </View>
  );
}

function SubscribersTab({ subscribers, router, C, styles }: any) {
  const active = subscribers.filter((s: Subscriber) => s.is_active).length;
  return (
    <View style={{ gap: Spacing.md }}>
      {subscribers.length > 0 && (
        <View style={styles.summaryCard}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>{subscribers.length}</Text>
            <Text style={styles.summaryLabel}>Total</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryValue, { color: C.leaf }]}>{active}</Text>
            <Text style={styles.summaryLabel}>Active</Text>
          </View>
        </View>
      )}
      {!subscribers.length ? (
        <EmptyState icon="people-outline" title="No health subscribers yet" body="Subscribers will appear here once they follow your health kitchen." C={C} styles={styles} />
      ) : (
        subscribers.map((s: Subscriber) => (
          <TouchableOpacity
            key={s.user_id}
            style={styles.listCard}
            onPress={() => router.push('/(cook)/health-subscribers' as any)}
          >
            <View style={styles.listCardLeft}>
              <Text style={styles.listCardTitle}>{s.full_name}</Text>
              <Text style={styles.listCardSub}>
                {s.active_plan_title ?? 'No active plan'}
                {s.conditions?.length ? ` · ${s.conditions.slice(0, 2).map((c: string) => SPECIALISATION_LABELS[c] ?? c).join(', ')}` : ''}
              </Text>
            </View>
            <View style={styles.listCardRight}>
              <View style={[styles.statusDot, { backgroundColor: s.is_active ? C.leaf : C.bodySoft }]}>
                <Text style={styles.statusDotText}>{s.is_active ? 'active' : 'inactive'}</Text>
              </View>
            </View>
          </TouchableOpacity>
        ))
      )}
    </View>
  );
}

function EmptyState({ icon, title, body, ctaLabel, onCta, C, styles }: any) {
  return (
    <View style={styles.emptyState}>
      <Ionicons name={icon} size={40} color={C.stone} />
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyBody}>{body}</Text>
      {ctaLabel && onCta && (
        <TouchableOpacity onPress={onCta} style={styles.emptyCta}>
          <Text style={styles.emptyCtaText}>{ctaLabel}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

function makeStyles(C: AppColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: C.bg },
    header: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
      borderBottomWidth: 1, borderBottomColor: C.borderWarm,
    },
    backBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
    title: { fontFamily: Fonts.sansMedium, fontSize: FontSize.lg, color: C.ink },
    tabBar: { maxHeight: 48, borderBottomWidth: 1, borderBottomColor: C.borderWarm },
    tabBarContent: { paddingHorizontal: Spacing.lg, gap: 4, alignItems: 'center' },
    tabItem: {
      flexDirection: 'row', alignItems: 'center', gap: 6,
      paddingHorizontal: 14, paddingVertical: 10,
      borderRadius: Radius.full,
    },
    tabItemActive: { backgroundColor: C.ink },
    tabLabel: { fontFamily: Fonts.sansMedium, fontSize: FontSize.sm, color: C.bodySoft },
    tabLabelActive: { color: C.canvas },
    loadingState: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    content: { padding: Spacing.lg, paddingBottom: 100 },
    summaryCard: {
      flexDirection: 'row', backgroundColor: C.bgCard,
      borderRadius: Radius.lg, padding: Spacing.md, ...Shadow.card,
    },
    summaryItem: { flex: 1, alignItems: 'center' },
    summaryValue: { fontFamily: Fonts.sansMedium, fontSize: FontSize.xl, color: C.ink },
    summaryLabel: { fontFamily: Fonts.sans, fontSize: FontSize.sm, color: C.bodySoft },
    listCard: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      backgroundColor: C.bgCard, borderRadius: Radius.lg, padding: Spacing.md, ...Shadow.card,
    },
    listCardLeft: { flex: 1, marginRight: Spacing.md },
    listCardTitle: { fontFamily: Fonts.sansMedium, fontSize: FontSize.body, color: C.ink },
    listCardSub: { fontFamily: Fonts.sans, fontSize: FontSize.sm, color: C.bodySoft, marginTop: 2 },
    listCardRight: { alignItems: 'flex-end', gap: 4 },
    listCardAmount: { fontFamily: Fonts.sansMedium, fontSize: FontSize.body, color: C.spice },
    statusDot: { borderRadius: Radius.full, paddingHorizontal: 8, paddingVertical: 3 },
    statusDotText: { fontFamily: Fonts.sans, fontSize: FontSize.xs, color: C.canvas },
    emptyState: { alignItems: 'center', paddingVertical: Spacing.xxl, gap: Spacing.sm },
    emptyTitle: { fontFamily: Fonts.sansMedium, fontSize: FontSize.lg, color: C.ink },
    emptyBody: { fontFamily: Fonts.sans, fontSize: FontSize.body, color: C.bodySoft, textAlign: 'center', lineHeight: 22 },
    emptyCta: { marginTop: 4, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 40, backgroundColor: C.spice },
    emptyCtaText: { fontFamily: Fonts.sansMedium, fontSize: FontSize.body, color: C.canvas },
    fab: {
      position: 'absolute', bottom: 24, right: 24,
      width: 56, height: 56, borderRadius: 28,
      backgroundColor: C.spice, alignItems: 'center', justifyContent: 'center',
      elevation: 8, shadowColor: C.spice, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8,
    },
  });
}
