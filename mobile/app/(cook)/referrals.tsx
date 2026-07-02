import React, { useState, useEffect, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, Share, Clipboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { referralsApi, type MyReferrals } from '../../src/api/referrals';
import { useColors, type AppColors } from '../../src/context/ThemeContext';
import { Fonts, Spacing, Radius, Shadow } from '../../src/constants/theme';
import { fmtCurrency } from '../../src/utils/format';
import { useFeedback } from '../../src/components/feedback';
import { useCurrency } from '../../src/hooks/useCurrency';
import { useTranslation } from 'react-i18next';

export default function ReferralsScreen() {
  const router = useRouter();
  const C = useColors();
  const S = useMemo(() => makeStyles(C), [C]);
  const feedback = useFeedback();
  const { fmt } = useCurrency();
  const { t } = useTranslation();

  const [data, setData] = useState<MyReferrals | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    referralsApi.my()
      .then(setData)
      .catch(() => feedback.error(t('common.error'), t('cook_referrals.load_error')))
      .finally(() => setLoading(false));
  }, []);

  async function handleCopyCode() {
    if (!data) return;
    Clipboard.setString(data.referral_code);
    setCopied(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setTimeout(() => setCopied(false), 2500);
  }

  async function handleShare() {
    if (!data) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await Share.share({
      message: t('cook_referrals.share_message', { url: data.share_url }),
      url: data.share_url,
    });
  }

  return (
    <SafeAreaView style={S.root} edges={['top']}>
      <View style={S.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={8} style={S.backBtn}>
          <Ionicons name="chevron-back" size={22} color={C.textInk} />
        </TouchableOpacity>
        <Text style={S.headerTitle}>{t('cook_referrals.title')}</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: Spacing.lg, gap: 16, paddingBottom: 60 }}>
        {/* Hero */}
        <View style={[S.card, { alignItems: 'center', paddingVertical: 28 }]}>
          <View style={S.rewardIcon}>
            <Ionicons name="gift" size={30} color={C.canvas} />
          </View>
          <Text style={S.heroTitle}>{t('cook_referrals.hero_title', { amount: fmt(data?.reward_per_referral ?? 2000) })}</Text>
          <Text style={S.heroSub}>
            {t('cook_referrals.hero_sub')}
          </Text>
        </View>

        {loading ? (
          <View style={{ alignItems: 'center', paddingVertical: 32 }}>
            <ActivityIndicator color={C.spice} />
          </View>
        ) : data ? (
          <>
            {/* Referral code */}
            <View style={S.card}>
              <Text style={S.sectionLabel}>{t('cook_referrals.your_code')}</Text>
              <View style={S.codeRow}>
                <Text style={S.code}>{data.referral_code}</Text>
                <TouchableOpacity onPress={handleCopyCode} style={[S.copyBtn, copied && { backgroundColor: C.healthBg }]}>
                  <Ionicons name={copied ? 'checkmark' : 'copy-outline'} size={16} color={copied ? C.leaf : C.spice} />
                  <Text style={[S.copyText, copied && { color: C.leaf }]}>{copied ? t('cook_referrals.copied') : t('cook_referrals.copy')}</Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity style={S.shareBtn} onPress={handleShare} activeOpacity={0.85}>
                <Ionicons name="share-social-outline" size={18} color={C.canvas} />
                <Text style={S.shareBtnText}>{t('cook_referrals.share_link')}</Text>
              </TouchableOpacity>
            </View>

            {/* Stats */}
            <View style={S.card}>
              <Text style={S.sectionLabel}>{t('cook_referrals.your_impact')}</Text>
              <View style={S.statsRow}>
                <View style={S.statBox}>
                  <Text style={S.statNum}>{data.stats.total_signups}</Text>
                  <Text style={S.statLabel}>{t('cook_referrals.signed_up')}</Text>
                </View>
                <View style={[S.statBox, { borderLeftWidth: 0.5, borderRightWidth: 0.5, borderColor: C.borderWarm }]}>
                  <Text style={S.statNum}>{data.stats.qualified}</Text>
                  <Text style={S.statLabel}>{t('cook_referrals.qualified')}</Text>
                </View>
                <View style={S.statBox}>
                  <Text style={[S.statNum, { color: C.leaf }]}>{fmtCurrency(data.stats.total_earned, data.currency)}</Text>
                  <Text style={S.statLabel}>{t('cook_profile.earned')}</Text>
                </View>
              </View>
            </View>

            {/* How it works */}
            <View style={S.card}>
              <Text style={S.sectionLabel}>{t('cook_referrals.how_it_works')}</Text>
              {[
                { icon: 'share-social-outline', text: t('cook_referrals.step_share') },
                { icon: 'person-add-outline',   text: t('cook_referrals.step_signup') },
                { icon: 'bag-add-outline',      text: t('cook_referrals.step_order') },
                { icon: 'wallet-outline',        text: t('cook_referrals.step_earn', { amount: fmt(data.reward_per_referral ?? 2000) }) },
              ].map((step, i) => (
                <View key={i} style={S.howRow}>
                  <View style={S.howIcon}>
                    <Ionicons name={step.icon as any} size={16} color={C.spice} />
                  </View>
                  <Text style={S.howText}>{step.text}</Text>
                </View>
              ))}
            </View>

            {/* Recent referrals */}
            {data.referrals.length > 0 && (
              <View style={S.card}>
                <Text style={S.sectionLabel}>{t('cook_referrals.recent_referrals')}</Text>
                {data.referrals.map(ref => (
                  <View key={ref.id} style={S.refRow}>
                    <View style={[S.refStatusDot, { backgroundColor: ref.status === 'rewarded' ? C.leaf : ref.status === 'qualified' ? C.spice : C.stone }]} />
                    <Text style={S.refStatus}>{ref.status.charAt(0).toUpperCase() + ref.status.slice(1)}</Text>
                    {ref.signed_up_at && (
                      <Text style={S.refDate}>{new Date(ref.signed_up_at).toLocaleDateString('en-NG')}</Text>
                    )}
                  </View>
                ))}
              </View>
            )}
          </>
        ) : (
          <View style={{ alignItems: 'center', paddingVertical: 32 }}>
            <Text style={{ fontFamily: Fonts.sans, fontSize: 14, color: C.bodySoft }}>{t('cook_referrals.load_error_body')}</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function makeStyles(C: AppColors) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: C.bg },
    header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.borderWarm },
    backBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
    headerTitle: { flex: 1, textAlign: 'center', fontFamily: Fonts.sansMedium, fontSize: 16, color: C.textInk },
    card: { backgroundColor: C.bgCard, borderRadius: Radius.lg, padding: 16, borderWidth: 0.5, borderColor: C.borderWarm, ...Shadow.card, gap: 12 },
    rewardIcon: { width: 64, height: 64, borderRadius: 32, backgroundColor: C.spice, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
    heroTitle: { fontFamily: Fonts.serif, fontSize: 22, color: C.textInk, textAlign: 'center' },
    heroSub: { fontFamily: Fonts.sans, fontSize: 14, color: C.bodySoft, textAlign: 'center', lineHeight: 20 },
    sectionLabel: { fontFamily: Fonts.sansMedium, fontSize: 13, color: C.caps, textTransform: 'uppercase', letterSpacing: 0.5 },
    codeRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    code: { fontFamily: Fonts.sansMedium, fontSize: 22, color: C.textInk, letterSpacing: 2, flex: 1 },
    copyBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: C.bgCook, borderRadius: Radius.full, paddingHorizontal: 12, paddingVertical: 8 },
    copyText: { fontFamily: Fonts.sansMedium, fontSize: 13, color: C.spice },
    shareBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: C.ink, borderRadius: Radius.full, paddingVertical: 14 },
    shareBtnText: { fontFamily: Fonts.sansMedium, fontSize: 15, color: C.canvas },
    statsRow: { flexDirection: 'row' },
    statBox: { flex: 1, alignItems: 'center', paddingVertical: 8 },
    statNum: { fontFamily: Fonts.serif, fontSize: 22, color: C.spice },
    statLabel: { fontFamily: Fonts.sans, fontSize: 11, color: C.bodySoft, marginTop: 2 },
    howRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
    howIcon: { width: 32, height: 32, borderRadius: 16, backgroundColor: C.bgCook, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
    howText: { fontFamily: Fonts.sans, fontSize: 13, color: C.body, lineHeight: 20, flex: 1, paddingTop: 6 },
    refRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.borderWarm },
    refStatusDot: { width: 8, height: 8, borderRadius: 4 },
    refStatus: { fontFamily: Fonts.sansMedium, fontSize: 13, color: C.textInk, flex: 1 },
    refDate: { fontFamily: Fonts.sans, fontSize: 12, color: C.bodySoft },
  });
}
