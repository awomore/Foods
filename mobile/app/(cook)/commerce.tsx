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
import { subscriptionsApi, type SubscriptionTier } from '../../src/api/subscriptions';
import { healthKitchenApi, type Subscriber, SPECIALISATION_LABELS } from '../../src/api/healthKitchen';
import { useColors, type AppColors } from '../../src/context/ThemeContext';
import { Fonts, Spacing, Radius, Shadow, FontSize } from '../../src/constants/theme';
import { fmtCurrency, relativeTime } from '../../src/utils/format';
import { Bone } from '../../src/components/ui/Skeleton';

type Tab = 'invoices' | 'products' | 'subscriptions' | 'subscribers';

const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: 'invoices',      label: 'Invoices',    icon: 'receipt-outline' },
  { key: 'products',      label: 'Store',        icon: 'storefront-outline' },
  { key: 'subscriptions', label: 'Memberships',  icon: 'star-outline' },
  { key: 'subscribers',   label: 'Subscribers',  icon: 'people-outline' },
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
  const [tiers, setTiers] = useState<SubscriptionTier[]>([]);
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    try {
      const [invRes, prodRes, tierRes, subRes] = await Promise.allSettled([
        invoicesApi.list(),
        digitalProductsApi.myProducts(),
        subscriptionsApi.tiers('me'),
        healthKitchenApi.mySubscribers(),
      ]);
      if (invRes.status === 'fulfilled') setInvoices(invRes.value.invoices ?? []);
      if (prodRes.status === 'fulfilled') setProducts(prodRes.value.products ?? []);
      if (tierRes.status === 'fulfilled') setTiers(tierRes.value.tiers ?? []);
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
          {tab === 'subscriptions' && (
            <SubscriptionsTab tiers={tiers} router={router} C={C} styles={styles} />
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
            subscriptions: '/subscription/tiers',
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
