import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { giftingApi } from '../../src/api/gifting';
import { Colors, Fonts, Spacing, Radius, Shadow } from '../../src/constants/theme';

type Tab = 'buy' | 'redeem';

const AMOUNTS = [1000, 2500, 5000, 10000, 20000, 50000];

function fmtCurrency(n: number) {
  return '₦' + n.toLocaleString('en-NG', { maximumFractionDigits: 0 });
}

export default function Gifting() {
  const [tab, setTab] = useState<Tab>('buy');

  return (
    <View style={styles.root}>
      <SafeAreaView>
        <View style={styles.topBar}>
          <Text style={styles.pageTitle}>Gift cards</Text>
        </View>
      </SafeAreaView>

      {/* Tab toggle */}
      <View style={styles.tabRow}>
        {(['buy', 'redeem'] as Tab[]).map(t => (
          <TouchableOpacity
            key={t}
            onPress={() => setTab(t)}
            style={[styles.tab, tab === t && styles.tabActive]}
          >
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
              {t === 'buy' ? 'Buy a gift card' : 'Redeem a code'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {tab === 'buy' ? <BuyTab /> : <RedeemTab />}
    </View>
  );
}

function BuyTab() {
  const [amount, setAmount] = useState<number | null>(null);
  const [customAmount, setCustomAmount] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [recipientPhone, setRecipientPhone] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState<{ code: string; amount: number } | null>(null);

  const selectedAmount = amount ?? (customAmount ? parseInt(customAmount.replace(/\D/g, ''), 10) : null);

  async function handlePurchase() {
    if (!selectedAmount || selectedAmount < 500) {
      return Alert.alert('Amount required', 'Minimum gift card value is ₦500.');
    }
    setLoading(true);
    try {
      const { gift_card } = await giftingApi.purchaseGiftCard({
        amount: selectedAmount,
        currency_code: 'NGN',
        recipient_name: recipientName || undefined,
        recipient_phone: recipientPhone || undefined,
        message: message || undefined,
      });
      setDone({ code: gift_card.code, amount: gift_card.amount });
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'Could not purchase gift card');
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <View style={styles.successWrap}>
        <View style={styles.successCard}>
          <View style={styles.successIcon}>
            <Ionicons name="gift-outline" size={32} color={Colors.spice} />
          </View>
          <Text style={styles.successTitle}>Gift card created!</Text>
          <Text style={styles.successSub}>Share this code with {recipientName || 'the recipient'}</Text>
          <View style={styles.codeBox}>
            <Text style={styles.codeText}>{done.code}</Text>
          </View>
          <Text style={styles.codeValue}>{fmtCurrency(done.amount)} value</Text>
          <TouchableOpacity style={styles.doneBtn} onPress={() => { setDone(null); setAmount(null); setCustomAmount(''); setRecipientName(''); setRecipientPhone(''); setMessage(''); }}>
            <Text style={styles.doneBtnText}>Create another</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <Text style={styles.sectionLabel}>Select amount</Text>
        <View style={styles.amountGrid}>
          {AMOUNTS.map(a => (
            <TouchableOpacity
              key={a}
              onPress={() => { setAmount(a); setCustomAmount(''); }}
              style={[styles.amountPill, amount === a && styles.amountPillActive]}
            >
              <Text style={[styles.amountText, amount === a && styles.amountTextActive]}>
                {fmtCurrency(a)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <TextInput
          style={styles.input}
          placeholder="Or enter a custom amount (₦)"
          placeholderTextColor={Colors.caps}
          keyboardType="numeric"
          value={customAmount}
          onChangeText={v => { setCustomAmount(v); setAmount(null); }}
        />

        <Text style={[styles.sectionLabel, { marginTop: 20 }]}>Recipient (optional)</Text>
        <TextInput
          style={styles.input}
          placeholder="Recipient name"
          placeholderTextColor={Colors.caps}
          value={recipientName}
          onChangeText={setRecipientName}
        />
        <TextInput
          style={styles.input}
          placeholder="Recipient phone (e.g. 2348012345678)"
          placeholderTextColor={Colors.caps}
          keyboardType="phone-pad"
          value={recipientPhone}
          onChangeText={setRecipientPhone}
        />
        <TextInput
          style={[styles.input, styles.messageInput]}
          placeholder="Add a personal message…"
          placeholderTextColor={Colors.caps}
          multiline
          numberOfLines={3}
          value={message}
          onChangeText={setMessage}
        />

        <TouchableOpacity
          style={[styles.buyBtn, (!selectedAmount || selectedAmount < 500) && { opacity: 0.45 }]}
          onPress={handlePurchase}
          disabled={loading || !selectedAmount || selectedAmount < 500}
          activeOpacity={0.85}
        >
          {loading ? (
            <ActivityIndicator color={Colors.canvas} />
          ) : (
            <>
              <Ionicons name="gift-outline" size={18} color={Colors.canvas} />
              <Text style={styles.buyBtnText}>
                {selectedAmount ? `Buy ${fmtCurrency(selectedAmount)} gift card` : 'Buy gift card'}
              </Text>
            </>
          )}
        </TouchableOpacity>

        <Text style={styles.note}>
          Gift cards never expire and can be redeemed on any order. Payment is collected at checkout.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function RedeemTab() {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [redeemed, setRedeemed] = useState<{ amount: number } | null>(null);

  async function handleRedeem() {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) return Alert.alert('Enter a code', 'Paste or type your gift card code.');
    setLoading(true);
    try {
      const { credits_added } = await giftingApi.redeemGiftCard(trimmed);
      setRedeemed({ amount: credits_added });
    } catch (e: any) {
      Alert.alert('Invalid code', e.message ?? 'This code could not be redeemed.');
    } finally {
      setLoading(false);
    }
  }

  if (redeemed) {
    return (
      <View style={styles.successWrap}>
        <View style={styles.successCard}>
          <View style={styles.successIcon}>
            <Ionicons name="checkmark-circle-outline" size={32} color={Colors.successFg} />
          </View>
          <Text style={styles.successTitle}>Redeemed!</Text>
          <Text style={styles.successSub}>{fmtCurrency(redeemed.amount)} added to your account</Text>
          <TouchableOpacity style={styles.doneBtn} onPress={() => { setRedeemed(null); setCode(''); }}>
            <Text style={styles.doneBtnText}>Redeem another</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <Text style={styles.sectionLabel}>Enter your code</Text>
        <TextInput
          style={[styles.input, styles.codeInput]}
          placeholder="e.g. GC-XXXX-XXXX-XXXX"
          placeholderTextColor={Colors.caps}
          value={code}
          onChangeText={t => setCode(t.toUpperCase())}
          autoCapitalize="characters"
          autoCorrect={false}
        />

        <TouchableOpacity
          style={[styles.buyBtn, !code.trim() && { opacity: 0.45 }]}
          onPress={handleRedeem}
          disabled={loading || !code.trim()}
          activeOpacity={0.85}
        >
          {loading ? (
            <ActivityIndicator color={Colors.canvas} />
          ) : (
            <>
              <Ionicons name="checkmark-circle-outline" size={18} color={Colors.canvas} />
              <Text style={styles.buyBtnText}>Redeem code</Text>
            </>
          )}
        </TouchableOpacity>

        <Text style={styles.note}>
          Redeemed credits are added instantly to your account and applied to your next order.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },
  topBar: { paddingHorizontal: Spacing.lg, paddingTop: 16, paddingBottom: 12 },
  pageTitle: { fontFamily: Fonts.serif, fontSize: 26, color: Colors.textInk },

  tabRow: { flexDirection: 'row', marginHorizontal: Spacing.lg, marginBottom: 16, backgroundColor: Colors.bgCard, borderRadius: Radius.md, borderWidth: 0.5, borderColor: Colors.borderWarm, overflow: 'hidden' },
  tab: { flex: 1, paddingVertical: 11, alignItems: 'center' },
  tabActive: { backgroundColor: Colors.ink },
  tabText: { fontFamily: Fonts.sansMedium, fontSize: 13, color: Colors.body },
  tabTextActive: { color: Colors.canvas },

  scroll: { padding: Spacing.lg, paddingTop: 4, gap: 10 },

  sectionLabel: { fontFamily: Fonts.sansMedium, fontSize: 12, color: Colors.caps, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },

  amountGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  amountPill: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 40, backgroundColor: Colors.bgCard, borderWidth: 0.5, borderColor: Colors.borderWarm },
  amountPillActive: { backgroundColor: Colors.ink, borderColor: 'transparent' },
  amountText: { fontFamily: Fonts.sansMedium, fontSize: 14, color: Colors.body },
  amountTextActive: { color: Colors.canvas },

  input: { backgroundColor: Colors.bgCard, borderWidth: 0.5, borderColor: Colors.borderWarm, borderRadius: Radius.md, paddingHorizontal: 14, paddingVertical: 12, fontFamily: Fonts.sans, fontSize: 15, color: Colors.textInk },
  messageInput: { minHeight: 80, textAlignVertical: 'top' },
  codeInput: { fontFamily: Fonts.sansMedium, fontSize: 18, letterSpacing: 2, textAlign: 'center' },

  buyBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Colors.spice, borderRadius: Radius.lg, paddingVertical: 16, marginTop: 8 },
  buyBtnText: { fontFamily: Fonts.sansMedium, fontSize: 15, color: Colors.canvas },

  note: { fontFamily: Fonts.sans, fontSize: 12, color: Colors.bodySoft, textAlign: 'center', lineHeight: 17, marginTop: 4 },

  successWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.lg },
  successCard: { width: '100%', backgroundColor: Colors.bgCard, borderRadius: Radius.lg, padding: 28, alignItems: 'center', gap: 10, borderWidth: 0.5, borderColor: Colors.borderWarm, ...Shadow.lift },
  successIcon: { width: 64, height: 64, borderRadius: 32, backgroundColor: Colors.bgCook, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  successTitle: { fontFamily: Fonts.serif, fontSize: 22, color: Colors.textInk },
  successSub: { fontFamily: Fonts.sans, fontSize: 14, color: Colors.bodySoft, textAlign: 'center' },
  codeBox: { backgroundColor: Colors.bgCook, borderRadius: Radius.md, paddingHorizontal: 20, paddingVertical: 12, marginVertical: 4 },
  codeText: { fontFamily: Fonts.sansMedium, fontSize: 20, color: Colors.textInk, letterSpacing: 3 },
  codeValue: { fontFamily: Fonts.serif, fontSize: 16, color: Colors.spice },
  doneBtn: { marginTop: 8, paddingVertical: 12, paddingHorizontal: 28, backgroundColor: Colors.ink, borderRadius: Radius.lg },
  doneBtnText: { fontFamily: Fonts.sansMedium, fontSize: 14, color: Colors.canvas },
});
