import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { invoicesApi, type Invoice, quotationsApi, type Quotation } from '../../src/api/invoices';
import { digitalProductsApi, type DigitalProduct } from '../../src/api/digitalProducts';
import { coursesApi, type Course } from '../../src/api/courses';
import { subscriptionsApi, type SubscriptionTier } from '../../src/api/subscriptions';
import { useColors, type AppColors } from '../../src/context/ThemeContext';
import { Fonts, Spacing, Radius, Shadow, FontSize } from '../../src/constants/theme';
import { fmtCurrency, relativeTime } from '../../src/utils/format';

type Tab = 'invoices' | 'quotes' | 'products' | 'courses' | 'subscriptions';

const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: 'invoices',      label: 'Invoices',      icon: 'receipt-outline' },
  { key: 'quotes',        label: 'Quotes',         icon: 'document-text-outline' },
  { key: 'products',      label: 'Store',          icon: 'book-outline' },
  { key: 'courses',       label: 'Courses',        icon: 'school-outline' },
  { key: 'subscriptions', label: 'Memberships',   icon: 'star-outline' },
];

const INVOICE_STATUS_COLORS: Record<string, string> = {
  draft: '#A89880', sent: '#2A5FBF', paid: '#2E8B3F',
  overdue: '#C0392B', cancelled: '#A89880', partial: '#B36A2E',
};

export default function CommerceScreen() {
  const router = useRouter();
  const C = useColors();
  const styles = useMemo(() => makeStyles(C), [C]);
  const [tab, setTab] = useState<Tab>('invoices');
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [quotes, setQuotes] = useState<Quotation[]>([]);
  const [products, setProducts] = useState<DigitalProduct[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [tiers, setTiers] = useState<SubscriptionTier[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [invRes, quoteRes, prodRes, courseRes, tierRes] = await Promise.allSettled([
        invoicesApi.list(),
        quotationsApi.list(),
        digitalProductsApi.myProducts(),
        coursesApi.myCourses(),
        subscriptionsApi.tiers('me'),
      ]);
      if (invRes.status === 'fulfilled') setInvoices(invRes.value.invoices ?? []);
      if (quoteRes.status === 'fulfilled') setQuotes(quoteRes.value.quotes ?? []);
      if (prodRes.status === 'fulfilled') setProducts(prodRes.value.products ?? []);
      if (courseRes.status === 'fulfilled') setCourses(courseRes.value.courses ?? []);
    } catch {}
    setLoading(false);
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
        <View style={styles.loadingState}><ActivityIndicator size="large" color={C.spice} /></View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
          {tab === 'invoices' && (
            <InvoicesTab invoices={invoices} router={router} C={C} styles={styles} />
          )}
          {tab === 'quotes' && (
            <QuotesTab quotes={quotes} router={router} C={C} styles={styles} />
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
        </ScrollView>
      )}

      {/* FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => {
          const routes: Record<Tab, string> = {
            invoices:      '/invoice/create',
            quotes:        '/quote/create',
            products:      '/product/create',
            courses:       '/course/create',
            subscriptions: '/subscription/tiers',
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
        <EmptyState icon="receipt-outline" title="No invoices yet" body="Create your first invoice to start getting paid." C={C} styles={styles} />
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

function QuotesTab({ quotes, router, C, styles }: any) {
  return (
    <View style={{ gap: Spacing.md }}>
      {!quotes.length ? (
        <EmptyState icon="document-text-outline" title="No quotations yet" body="Create a quote to send to a potential client." C={C} styles={styles} />
      ) : (
        quotes.map((q: Quotation) => (
          <TouchableOpacity
            key={q.id}
            style={styles.listCard}
            onPress={() => router.push({ pathname: '/quote/[id]', params: { id: q.id } } as any)}
          >
            <View style={styles.listCardLeft}>
              <Text style={styles.listCardTitle}>{q.quote_number}</Text>
              <Text style={styles.listCardSub}>{q.title ?? q.customer_name} · {relativeTime(q.created_at)}</Text>
            </View>
            <View style={styles.listCardRight}>
              <Text style={styles.listCardAmount}>{fmtCurrency(q.total, 'NGN')}</Text>
              <View style={[styles.statusDot, { backgroundColor: INVOICE_STATUS_COLORS[q.status] ?? C.bodySoft }]}>
                <Text style={styles.statusDotText}>{q.status}</Text>
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
        <EmptyState icon="book-outline" title="No digital products yet" body="Create recipe books, meal plans and more to sell to your audience." C={C} styles={styles} />
      ) : (
        products.map((p: DigitalProduct) => (
          <TouchableOpacity
            key={p.id}
            style={styles.listCard}
            onPress={() => router.push({ pathname: '/product/[id]', params: { id: p.id } } as any)}
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
  return (
    <View style={{ gap: Spacing.md }}>
      <EmptyState icon="star-outline" title="Membership Tiers" body="Set up membership tiers to offer exclusive content and benefits to your biggest fans." C={C} styles={styles} />
    </View>
  );
}

function EmptyState({ icon, title, body, C, styles }: any) {
  return (
    <View style={styles.emptyState}>
      <Ionicons name={icon} size={40} color={C.stone} />
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyBody}>{body}</Text>
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
    backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
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
    fab: {
      position: 'absolute', bottom: 24, right: 24,
      width: 56, height: 56, borderRadius: 28,
      backgroundColor: C.spice, alignItems: 'center', justifyContent: 'center',
      elevation: 8, shadowColor: C.spice, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8,
    },
  });
}
