import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { invoicesApi, type Invoice } from '../../src/api/invoices';
import { digitalProductsApi, type DigitalProduct } from '../../src/api/digitalProducts';
import { subscriptionsApi, type SubscriptionTier } from '../../src/api/subscriptions';
import { healthKitchenApi, type Subscriber, SPECIALISATION_LABELS } from '../../src/api/healthKitchen';
import { useColors, type AppColors } from '../../src/context/ThemeContext';
import { Fonts, Spacing, Radius, Shadow, FontSize } from '../../src/constants/theme';
import { fmtCurrency, relativeTime } from '../../src/utils/format';
import { Bone } from '../../src/components/ui/Skeleton';

type Tab = 'invoices' | 'products' | 'subscriptions' | 'subscribers';

const TAB_KEYS: { key: Tab; labelKey: string; icon: string }[] = [
  { key: 'invoices',      labelKey: 'cook_commerce.tabs.invoices',      icon: 'receipt-outline' },
  { key: 'products',      labelKey: 'cook_commerce.tabs.products',      icon: 'storefront-outline' },
  { key: 'subscriptions', labelKey: 'cook_commerce.tabs.subscriptions', icon: 'star-outline' },
  { key: 'subscribers',   labelKey: 'cook_commerce.tabs.subscribers',   icon: 'people-outline' },
];

const INVOICE_STATUS_COLORS: Record<string, string> = {
  draft: '#9CA3AF', sent: '#2A5FBF', paid: '#2E8B3F',
  overdue: '#DC2626', cancelled: '#9CA3AF', partial: '#FF6B35',
};

export default function CommerceScreen() {
  const router = useRouter();
  const C = useColors();
  const styles = useMemo(() => makeStyles(C), [C]);
  const { t } = useTranslation();
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
        <Text style={styles.title}>{t('cook_commerce.title')}</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Tab bar */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabBar} contentContainerStyle={styles.tabBarContent}>
        {TAB_KEYS.map(item => (
          <TouchableOpacity
            key={item.key}
            style={[styles.tabItem, tab === item.key && styles.tabItemActive]}
            onPress={() => setTab(item.key)}
          >
            <Ionicons name={item.icon as any} size={15} color={tab === item.key ? C.canvas : C.bodySoft} />
            <Text style={[styles.tabLabel, tab === item.key && styles.tabLabelActive]}>{t(item.labelKey)}</Text>
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
            <InvoicesTab invoices={invoices} router={router} C={C} styles={styles} t={t} />
          )}
          {tab === 'products' && (
            <ProductsTab products={products} router={router} C={C} styles={styles} t={t} />
          )}
          {tab === 'subscriptions' && (
            <SubscriptionsTab tiers={tiers} router={router} C={C} styles={styles} t={t} />
          )}
          {tab === 'subscribers' && (
            <SubscribersTab subscribers={subscribers} router={router} C={C} styles={styles} t={t} />
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

function InvoicesTab({ invoices, router, C, styles, t }: any) {
  const total = invoices.filter((i: Invoice) => i.status === 'paid').reduce((s: number, i: Invoice) => s + i.paid_amount, 0);
  return (
    <View style={{ gap: Spacing.md }}>
      <View style={styles.summaryCard}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>{invoices.length}</Text>
          <Text style={styles.summaryLabel}>{t('cook_commerce.total')}</Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>{invoices.filter((i: Invoice) => i.status === 'paid').length}</Text>
          <Text style={styles.summaryLabel}>{t('cook_commerce.paid')}</Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={[styles.summaryValue, { color: C.spice }]}>{fmtCurrency(total, 'NGN')}</Text>
          <Text style={styles.summaryLabel}>{t('cook_commerce.earned')}</Text>
        </View>
      </View>

      {!invoices.length ? (
        <EmptyState icon="receipt-outline" title={t('cook_commerce.no_invoices')} body={t('cook_commerce.no_invoices_hint')} ctaLabel={t('cook_commerce.create_invoice')} onCta={() => router.push('/invoice/create' as any)} C={C} styles={styles} />
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
                <Text style={styles.statusDotText}>{t(`cook_commerce.status_${inv.status}`)}</Text>
              </View>
            </View>
          </TouchableOpacity>
        ))
      )}
    </View>
  );
}


function ProductsTab({ products, router, C, styles, t }: any) {
  return (
    <View style={{ gap: Spacing.md }}>
      {!products.length ? (
        <EmptyState icon="storefront-outline" title={t('cook_commerce.no_products')} body={t('cook_commerce.no_products_hint')} C={C} styles={styles} />
      ) : (
        products.map((p: DigitalProduct) => (
          <TouchableOpacity
            key={p.id}
            style={styles.listCard}
            onPress={() => router.push({ pathname: '/product/edit/[id]', params: { id: p.id } } as any)}
          >
            <View style={styles.listCardLeft}>
              <Text style={styles.listCardTitle}>{p.title}</Text>
              <Text style={styles.listCardSub}>{p.type.replace('_',' ')} · {t('cook_commerce.downloads_count', { count: p.download_count })}</Text>
            </View>
            <View style={styles.listCardRight}>
              <Text style={styles.listCardAmount}>{fmtCurrency(p.price, 'NGN')}</Text>
              <View style={[styles.statusDot, { backgroundColor: p.is_published ? C.leaf : C.bodySoft }]}>
                <Text style={styles.statusDotText}>{p.is_published ? t('cook_commerce.live') : t('cook_commerce.draft')}</Text>
              </View>
            </View>
          </TouchableOpacity>
        ))
      )}
    </View>
  );
}


function SubscriptionsTab({ tiers, router, C, styles, t }: any) {
  const activeCount = tiers.filter((tier: SubscriptionTier) => tier.is_active).length;
  return (
    <View style={{ gap: Spacing.md }}>
      {tiers.length > 0 && (
        <View style={styles.summaryCard}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>{tiers.length}</Text>
            <Text style={styles.summaryLabel}>{t('cook_commerce.tiers')}</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>{activeCount}</Text>
            <Text style={styles.summaryLabel}>{t('cook_commerce.active')}</Text>
          </View>
        </View>
      )}

      {!tiers.length ? (
        <EmptyState icon="star-outline" title={t('cook_commerce.no_tiers')} body={t('cook_commerce.no_tiers_hint')} ctaLabel={t('cook_commerce.create_tier')} onCta={() => router.push('/subscription/tiers' as any)} C={C} styles={styles} />
      ) : (
        tiers.map((tier: SubscriptionTier) => (
          <TouchableOpacity
            key={tier.id}
            style={styles.listCard}
            onPress={() => router.push({ pathname: '/subscription/tiers', params: { id: tier.id } } as any)}
          >
            <View style={styles.listCardLeft}>
              <Text style={styles.listCardTitle}>{tier.name}</Text>
              <Text style={styles.listCardSub}>
                {tier.billing_period.charAt(0).toUpperCase() + tier.billing_period.slice(1)}
                {tier.benefits?.length ? ` · ${t('cook_commerce.benefits_count', { count: tier.benefits.length })}` : ''}
              </Text>
              {tier.benefits?.slice(0, 2).map((b: string, i: number) => (
                <Text key={i} style={[styles.listCardSub, { marginTop: 2 }]}>· {b}</Text>
              ))}
            </View>
            <View style={styles.listCardRight}>
              <Text style={styles.listCardAmount}>{fmtCurrency(tier.price, 'NGN')}</Text>
              <View style={[styles.statusDot, { backgroundColor: tier.is_active ? C.leaf : C.bodySoft }]}>
                <Text style={styles.statusDotText}>{tier.is_active ? t('cook_commerce.active_lower') : t('cook_commerce.off')}</Text>
              </View>
            </View>
          </TouchableOpacity>
        ))
      )}
    </View>
  );
}


function SubscribersTab({ subscribers, router, C, styles, t }: any) {
  const active = subscribers.filter((s: Subscriber) => s.is_active).length;
  return (
    <View style={{ gap: Spacing.md }}>
      {subscribers.length > 0 && (
        <View style={styles.summaryCard}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>{subscribers.length}</Text>
            <Text style={styles.summaryLabel}>{t('cook_commerce.total')}</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryValue, { color: C.leaf }]}>{active}</Text>
            <Text style={styles.summaryLabel}>{t('cook_commerce.active')}</Text>
          </View>
        </View>
      )}
      {!subscribers.length ? (
        <EmptyState icon="people-outline" title={t('cook_commerce.no_subscribers')} body={t('cook_commerce.no_subscribers_hint')} C={C} styles={styles} />
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
                {s.active_plan_title ?? t('cook_commerce.no_active_plan')}
                {s.conditions?.length ? ` · ${s.conditions.slice(0, 2).map((c: string) => SPECIALISATION_LABELS[c] ?? c).join(', ')}` : ''}
              </Text>
            </View>
            <View style={styles.listCardRight}>
              <View style={[styles.statusDot, { backgroundColor: s.is_active ? C.leaf : C.bodySoft }]}>
                <Text style={styles.statusDotText}>{s.is_active ? t('cook_commerce.active_lower') : t('cook_commerce.inactive')}</Text>
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
