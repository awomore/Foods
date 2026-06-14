import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, ActivityIndicator, Modal, FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Contacts from 'expo-contacts';
import { invoicesApi, type LineItem } from '../../src/api/invoices';
import { api } from '../../src/api/client';
import { cooksApi, type CookCard } from '../../src/api/cooks';
import { useColors, type AppColors } from '../../src/context/ThemeContext';
import { Fonts, Spacing, Radius, Shadow } from '../../src/constants/theme';
import { useFeedback } from '../../src/components/feedback';
import { fmtCurrency } from '../../src/utils/format';
import { useAuth } from '../../src/context/AuthContext';
import Avatar from '../../src/components/ui/Avatar';

interface CustomerResult { id: string; name: string; phone: string }

function todayDisplay(): string {
  const d = new Date();
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
}

export default function InvoiceCreateScreen() {
  const router = useRouter();
  const C = useColors();
  const styles = useMemo(() => makeStyles(C), [C]);
  const feedback = useFeedback();
  const { user } = useAuth();
  const [cookProfile, setCookProfile] = useState<CookCard | null>(null);

  useEffect(() => {
    if (user?.cook_id) {
      cooksApi.get(user.cook_id)
        .then(r => setCookProfile(r.cook))
        .catch(() => {});
    }
  }, [user?.cook_id]);

  const creatorName = cookProfile?.display_name ?? user?.full_name ?? '';
  const creatorAvatar = cookProfile?.avatar_url ?? user?.avatar_url ?? null;
  const creatorUsername = cookProfile?.username ?? user?.username ?? null;
  const profileUrl = creatorUsername
    ? `https://foodsbyme.app/cook/${creatorUsername}`
    : null;

  // Recipient mode
  const [recipientMode, setRecipientMode] = useState<'lookup' | 'manual'>('lookup');
  const [phone, setPhone]                 = useState('');
  const [customer, setCustomer]           = useState<CustomerResult | null>(null);
  const [looking, setLooking]             = useState(false);
  const [recipientName, setRecipientName] = useState('');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [recipientPhone, setRecipientPhone] = useState('');

  // Line items
  const [items, setItems] = useState<LineItem[]>([
    { description: '', quantity: 1, unit_price: 0, amount: 0 },
  ]);
  const [discount, setDiscount] = useState('0');
  const [tax, setTax]           = useState('0');
  const [dueDate, setDueDate]   = useState('');
  const [notes, setNotes]       = useState('');

  // Bank details
  const [bankName, setBankName]         = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountName, setAccountName]   = useState('');

  const [saving, setSaving] = useState(false);

  // Contact picker
  const [showContactPicker, setShowContactPicker] = useState(false);
  const [contactQuery, setContactQuery]           = useState('');
  const [contactResults, setContactResults]       = useState<Contacts.Contact[]>([]);
  const [searchingContacts, setSearchingContacts] = useState(false);

  const subtotal = items.reduce((s, i) => s + i.amount, 0);
  const total    = Math.max(0, subtotal - parseFloat(discount || '0') + parseFloat(tax || '0'));
  const createdDate = todayDisplay();

  async function lookupCustomerWithPhone(phoneNumber: string) {
    const cleaned = phoneNumber.trim();
    if (!cleaned) return;
    setLooking(true);
    try {
      const data = await api.get<{ user: CustomerResult }>(`/cooks/customer-lookup?phone=${encodeURIComponent(cleaned)}`);
      setCustomer(data.user);
    } catch {
      feedback.warn('Not on platform', 'No FOODSbyme account found. Switch to Manual entry to proceed.');
      setCustomer(null);
    } finally {
      setLooking(false);
    }
  }

  async function lookupCustomer() {
    const cleaned = phone.trim();
    if (!cleaned) return feedback.warn('Phone required', 'Enter the customer phone number.');
    await lookupCustomerWithPhone(cleaned);
  }

  async function openContactPicker() {
    const { status } = await Contacts.requestPermissionsAsync();
    if (status !== 'granted') {
      feedback.warn('Permission denied', 'Allow contacts access in Settings to use this feature.');
      return;
    }
    setContactQuery('');
    setContactResults([]);
    setShowContactPicker(true);
  }

  const searchContacts = useCallback(async (q: string) => {
    setContactQuery(q);
    if (!q.trim()) { setContactResults([]); return; }
    setSearchingContacts(true);
    try {
      const { data } = await Contacts.getContactsAsync({
        fields: [Contacts.Fields.Name, Contacts.Fields.PhoneNumbers],
        name: q,
      });
      setContactResults(data.filter(c => c.phoneNumbers?.length));
    } catch {
      setContactResults([]);
    } finally {
      setSearchingContacts(false);
    }
  }, []);

  function selectContact(phoneNumber: string) {
    const cleaned = phoneNumber.replace(/[\s\-()]/g, '');
    setShowContactPicker(false);
    setPhone(cleaned);
    lookupCustomerWithPhone(cleaned);
  }

  function updateItem(idx: number, field: keyof LineItem, value: string) {
    setItems(prev => prev.map((item, i) => {
      if (i !== idx) return item;
      const updated = { ...item, [field]: field === 'description' ? value : parseFloat(value) || 0 };
      updated.amount = updated.quantity * updated.unit_price;
      return updated;
    }));
  }

  function addItem() {
    setItems(prev => [...prev, { description: '', quantity: 1, unit_price: 0, amount: 0 }]);
  }

  function removeItem(idx: number) {
    if (items.length === 1) return;
    setItems(prev => prev.filter((_, i) => i !== idx));
  }

  function parseInputDate(input: string): string | undefined {
    if (!input.trim()) return undefined;
    const ddmmyyyy = input.match(/^(\d{2})-(\d{2})-(\d{4})$/);
    if (ddmmyyyy) return `${ddmmyyyy[3]}-${ddmmyyyy[2]}-${ddmmyyyy[1]}`;
    return input;
  }

  async function handleSave(asDraft = true) {
    const hasRecipient = recipientMode === 'lookup' ? !!customer : !!recipientName.trim();
    if (!hasRecipient) {
      return feedback.warn(
        'Recipient required',
        recipientMode === 'lookup'
          ? 'Look up a customer or switch to manual entry.'
          : 'Enter the recipient name.'
      );
    }
    const hasItems = items.some(i => i.description.trim() && i.amount > 0);
    if (!hasItems) return feedback.warn('Add items', 'Add at least one line item with a description and price.');

    // Append bank details to notes if provided
    let fullNotes = notes;
    if (bankName || accountNumber || accountName) {
      const bankBlock = `\n\n--- Payment Details ---\nBank: ${bankName || 'N/A'}\nAccount No: ${accountNumber || 'N/A'}\nAccount Name: ${accountName || 'N/A'}`;
      fullNotes = (notes || '') + bankBlock;
    }
    if (recipientMode === 'manual' && (recipientEmail || recipientPhone)) {
      const contactBlock = `\n\n--- Recipient Contact ---${recipientEmail ? `\nEmail: ${recipientEmail}` : ''}${recipientPhone ? `\nPhone: ${recipientPhone}` : ''}`;
      fullNotes = fullNotes + contactBlock;
    }

    setSaving(true);
    try {
      const validItems = items.filter(i => i.description.trim());
      const payload: any = {
        line_items:      validItems,
        subtotal,
        discount_amount: parseFloat(discount) || 0,
        tax_amount:      parseFloat(tax) || 0,
        total,
        due_date:        parseInputDate(dueDate),
        notes:           fullNotes.trim() || undefined,
      };

      if (recipientMode === 'lookup' && customer) {
        payload.customer_id = customer.id;
      } else {
        payload.recipient_name = recipientName.trim();
        payload.recipient_email = recipientEmail.trim() || undefined;
      }

      const { invoice } = await invoicesApi.create(payload);

      if (!asDraft) {
        await invoicesApi.send(invoice.id).catch(() => {});
      }

      feedback.success(
        asDraft ? 'Draft saved' : 'Invoice sent',
        `Invoice ${invoice.invoice_number} created.`
      );
      router.replace({ pathname: '/invoice/[id]', params: { id: invoice.id } } as any);
    } catch (e: any) {
      feedback.error('Error', e.error ?? 'Could not create invoice');
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={C.ink} />
        </TouchableOpacity>
        <Text style={styles.title}>New Invoice</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

        {/* Invoice meta */}
        <View style={styles.metaCard}>
          {/* Creator identity row */}
          <View style={styles.creatorRow}>
            <Avatar
              name={creatorName}
              avatarUrl={creatorAvatar}
              size={44}
            />
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={styles.creatorName}>{creatorName || 'Your kitchen'}</Text>
              {profileUrl ? (
                <View style={styles.profileLinkRow}>
                  <Ionicons name="link-outline" size={11} color={C.spice} />
                  <Text style={styles.profileLink}>{profileUrl}</Text>
                </View>
              ) : null}
            </View>
          </View>

          <View style={styles.metaDivider} />
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Invoice #</Text>
            <Text style={styles.metaValue}>Auto-assigned on save</Text>
          </View>
          <View style={styles.metaDivider} />
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Date created</Text>
            <Text style={styles.metaValue}>{createdDate}</Text>
          </View>
        </View>

        {/* External access info */}
        <View style={styles.infoBanner}>
          <Ionicons name="globe-outline" size={14} color={C.spice} />
          <Text style={styles.infoBannerText}>
            Sent invoices can be viewed externally — recipients do not need a FOODSbyme account.
          </Text>
        </View>

        {/* Recipient section */}
        <Text style={styles.sectionLabel}>Recipient</Text>
        <View style={styles.modeToggle}>
          <TouchableOpacity
            style={[styles.modeBtn, recipientMode === 'lookup' && styles.modeBtnActive]}
            onPress={() => setRecipientMode('lookup')}
          >
            <Ionicons name="search-outline" size={13} color={recipientMode === 'lookup' ? C.canvas : C.bodySoft} />
            <Text style={[styles.modeBtnText, recipientMode === 'lookup' && styles.modeBtnTextActive]}>Look up</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.modeBtn, recipientMode === 'manual' && styles.modeBtnActive]}
            onPress={() => setRecipientMode('manual')}
          >
            <Ionicons name="create-outline" size={13} color={recipientMode === 'manual' ? C.canvas : C.bodySoft} />
            <Text style={[styles.modeBtnText, recipientMode === 'manual' && styles.modeBtnTextActive]}>Manual entry</Text>
          </TouchableOpacity>
        </View>

        {recipientMode === 'lookup' ? (
          <View style={{ gap: 8 }}>
            <View style={styles.lookupRow}>
              <TextInput
                style={[styles.input, { flex: 1, marginBottom: 0 }]}
                value={phone}
                onChangeText={setPhone}
                placeholder="Customer phone number"
                placeholderTextColor={C.bodySoft}
                keyboardType="phone-pad"
                onSubmitEditing={lookupCustomer}
                returnKeyType="search"
              />
              <TouchableOpacity style={styles.searchBtn} onPress={lookupCustomer} disabled={looking}>
                {looking
                  ? <ActivityIndicator size="small" color={C.canvas} />
                  : <Ionicons name="search-outline" size={18} color={C.canvas} />
                }
              </TouchableOpacity>
              <TouchableOpacity style={styles.contactsBtn} onPress={openContactPicker} disabled={looking}>
                <Ionicons name="person-add-outline" size={18} color={C.spice} />
              </TouchableOpacity>
            </View>
            {customer && (
              <View style={styles.customerCard}>
                <Ionicons name="person-circle-outline" size={20} color={C.spice} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.customerName}>{customer.name}</Text>
                  <Text style={styles.customerPhone}>{customer.phone}</Text>
                </View>
                <TouchableOpacity onPress={() => { setCustomer(null); setPhone(''); }}>
                  <Ionicons name="close-circle" size={18} color={C.bodySoft} />
                </TouchableOpacity>
              </View>
            )}
            <Text style={styles.hint}>Enter a phone number to find a FOODSbyme user, or switch to Manual entry for external clients.</Text>
          </View>
        ) : (
          <View style={{ gap: 8 }}>
            <TextInput
              style={styles.input}
              value={recipientName}
              onChangeText={setRecipientName}
              placeholder="Recipient full name *"
              placeholderTextColor={C.bodySoft}
            />
            <TextInput
              style={styles.input}
              value={recipientEmail}
              onChangeText={setRecipientEmail}
              placeholder="Email address (optional)"
              placeholderTextColor={C.bodySoft}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <TextInput
              style={styles.input}
              value={recipientPhone}
              onChangeText={setRecipientPhone}
              placeholder="Phone number (optional)"
              placeholderTextColor={C.bodySoft}
              keyboardType="phone-pad"
            />
          </View>
        )}

        {/* Line items */}
        <Text style={styles.sectionLabel}>Line Items</Text>
        {items.map((item, idx) => (
          <View key={idx} style={styles.itemCard}>
            <View style={styles.itemCardTop}>
              <Text style={styles.itemNum}>Item {idx + 1}</Text>
              {items.length > 1 && (
                <TouchableOpacity onPress={() => removeItem(idx)}>
                  <Ionicons name="trash-outline" size={15} color={C.errorFg} />
                </TouchableOpacity>
              )}
            </View>
            <TextInput
              style={styles.input}
              value={item.description}
              onChangeText={v => updateItem(idx, 'description', v)}
              placeholder="Description of goods/service"
              placeholderTextColor={C.bodySoft}
            />
            <View style={styles.itemNumRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.miniLabel}>Qty</Text>
                <TextInput
                  style={styles.input}
                  value={String(item.quantity)}
                  onChangeText={v => updateItem(idx, 'quantity', v)}
                  keyboardType="numeric"
                  placeholderTextColor={C.bodySoft}
                />
              </View>
              <View style={{ flex: 2 }}>
                <Text style={styles.miniLabel}>Unit price (NGN)</Text>
                <TextInput
                  style={styles.input}
                  value={item.unit_price > 0 ? String(item.unit_price) : ''}
                  onChangeText={v => updateItem(idx, 'unit_price', v)}
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor={C.bodySoft}
                />
              </View>
              <View style={{ alignItems: 'flex-end', paddingTop: 20 }}>
                <Text style={styles.itemAmount}>{fmtCurrency(item.amount, 'NGN')}</Text>
              </View>
            </View>
          </View>
        ))}
        <TouchableOpacity style={styles.addItemBtn} onPress={addItem}>
          <Ionicons name="add-circle-outline" size={16} color={C.spice} />
          <Text style={styles.addItemText}>Add item</Text>
        </TouchableOpacity>

        {/* Totals */}
        <View style={styles.totalsCard}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Subtotal</Text>
            <Text style={styles.totalValue}>{fmtCurrency(subtotal, 'NGN')}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Discount (NGN)</Text>
            <TextInput
              style={styles.totalInput}
              value={discount}
              onChangeText={setDiscount}
              keyboardType="numeric"
              placeholderTextColor={C.bodySoft}
            />
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Tax / VAT (NGN)</Text>
            <TextInput
              style={styles.totalInput}
              value={tax}
              onChangeText={setTax}
              keyboardType="numeric"
              placeholderTextColor={C.bodySoft}
            />
          </View>
          <View style={[styles.totalRow, styles.totalFinalRow]}>
            <Text style={styles.totalFinalLabel}>Total</Text>
            <Text style={styles.totalFinalValue}>{fmtCurrency(total, 'NGN')}</Text>
          </View>
        </View>

        {/* Payment details */}
        <Text style={styles.sectionLabel}>Payment Details</Text>
        <View style={styles.bankCard}>
          <TextInput
            style={styles.input}
            value={bankName}
            onChangeText={setBankName}
            placeholder="Bank name (e.g. GTBank)"
            placeholderTextColor={C.bodySoft}
          />
          <TextInput
            style={styles.input}
            value={accountNumber}
            onChangeText={setAccountNumber}
            placeholder="Account number"
            placeholderTextColor={C.bodySoft}
            keyboardType="numeric"
            maxLength={10}
          />
          <TextInput
            style={styles.input}
            value={accountName}
            onChangeText={setAccountName}
            placeholder="Account name"
            placeholderTextColor={C.bodySoft}
          />
        </View>
        <View style={styles.bankAdvice}>
          <Ionicons name="business-outline" size={14} color={C.successFg} />
          <Text style={styles.bankAdviceText}>
            We recommend using a business / corporate bank account for professional invoicing and easier reconciliation.
          </Text>
        </View>

        {/* Due date & notes */}
        <Text style={styles.sectionLabel}>Due date (DD-MM-YYYY)</Text>
        <TextInput
          style={styles.input}
          value={dueDate}
          onChangeText={setDueDate}
          placeholder="e.g. 30-06-2026"
          placeholderTextColor={C.bodySoft}
          keyboardType="numbers-and-punctuation"
        />

        <Text style={styles.sectionLabel}>Notes (optional)</Text>
        <TextInput
          style={[styles.input, { minHeight: 80, textAlignVertical: 'top' }]}
          value={notes}
          onChangeText={setNotes}
          placeholder="Additional notes, payment terms, or instructions…"
          placeholderTextColor={C.bodySoft}
          multiline
        />

        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.draftBtn, saving && { opacity: 0.6 }]}
            onPress={() => handleSave(true)}
            disabled={saving}
          >
            <Text style={styles.draftBtnText}>Save draft</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.sendBtn, saving && { opacity: 0.6 }]}
            onPress={() => handleSave(false)}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator size="small" color={C.canvas} />
            ) : (
              <>
                <Ionicons name="send-outline" size={15} color={C.canvas} />
                <Text style={styles.sendBtnText}>Send invoice</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Contact Picker Modal */}
      <Modal
        visible={showContactPicker}
        animationType="slide"
        transparent
        onRequestClose={() => setShowContactPicker(false)}
      >
        <View style={styles.contactOverlay}>
          <View style={styles.contactSheet}>
            <View style={styles.contactHandle} />
            <View style={styles.contactHeader}>
              <Text style={styles.contactTitle}>Choose contact</Text>
              <TouchableOpacity onPress={() => setShowContactPicker(false)}>
                <Ionicons name="close" size={22} color={C.textInk} />
              </TouchableOpacity>
            </View>
            <View style={styles.contactSearchRow}>
              <Ionicons name="search-outline" size={16} color={C.bodySoft} style={{ marginLeft: 10 }} />
              <TextInput
                style={styles.contactSearchInput}
                placeholder="Search by name…"
                placeholderTextColor={C.bodySoft}
                value={contactQuery}
                onChangeText={searchContacts}
                autoFocus
              />
              {searchingContacts && <ActivityIndicator size="small" color={C.spice} style={{ marginRight: 10 }} />}
            </View>
            {contactResults.length === 0 && contactQuery.trim().length > 0 && !searchingContacts ? (
              <Text style={styles.contactEmpty}>No contacts found.</Text>
            ) : (
              <FlatList
                data={contactResults}
                keyExtractor={c => c.id ?? c.name ?? Math.random().toString()}
                contentContainerStyle={{ paddingHorizontal: Spacing.md, paddingBottom: 30 }}
                renderItem={({ item }) => (
                  <View style={styles.contactItem}>
                    <Text style={styles.contactName}>{item.name}</Text>
                    {item.phoneNumbers?.map((pn, i) => (
                      <TouchableOpacity
                        key={i}
                        style={styles.contactPhone}
                        onPress={() => selectContact(pn.number ?? '')}
                      >
                        <Ionicons name="call-outline" size={14} color={C.spice} />
                        <Text style={styles.contactPhoneText}>{pn.number}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              />
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function makeStyles(C: AppColors) {
  return StyleSheet.create({
    root:          { flex: 1, backgroundColor: C.bg },
    header:        { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.lg, paddingTop: 16, paddingBottom: 12, gap: 8 },
    backBtn:       { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
    title:         { flex: 1, fontFamily: Fonts.serif, fontSize: 22, color: C.textInk, textAlign: 'center' },
    content:       { padding: Spacing.lg, gap: 4, paddingBottom: 60 },
    sectionLabel:  { fontFamily: Fonts.sansMedium, fontSize: 13, color: C.textInk, marginTop: 16, marginBottom: 6 },
    hint:          { fontFamily: Fonts.sans, fontSize: 11, color: C.bodySoft, lineHeight: 16 },
    input:         { backgroundColor: C.bgCard, borderRadius: Radius.md, borderWidth: 1, borderColor: C.borderWarm, paddingHorizontal: 14, paddingVertical: 12, fontFamily: Fonts.sans, fontSize: 15, color: C.textInk, marginBottom: 4 },

    // Invoice meta card
    metaCard:       { backgroundColor: C.bgCard, borderRadius: Radius.lg, borderWidth: 0.5, borderColor: C.borderWarm, padding: 14, gap: 0, marginBottom: 8 },
    metaRow:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 },
    metaDivider:    { height: 0.5, backgroundColor: C.borderWarm, marginVertical: 2 },
    metaLabel:      { fontFamily: Fonts.sans, fontSize: 12, color: C.bodySoft },
    metaValue:      { fontFamily: Fonts.sansMedium, fontSize: 12, color: C.ink },
    creatorRow:     { flexDirection: 'row', alignItems: 'center', gap: 12, paddingBottom: 12 },
    creatorName:    { fontFamily: Fonts.sansMedium, fontSize: 15, color: C.ink },
    profileLinkRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    profileLink:    { fontFamily: Fonts.sans, fontSize: 11, color: C.spice },

    // Info banner
    infoBanner:     { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: C.honey, borderRadius: Radius.md, padding: 10, marginBottom: 4 },
    infoBannerText: { fontFamily: Fonts.sans, fontSize: 12, color: C.body, flex: 1, lineHeight: 17 },

    // Recipient mode
    modeToggle:       { flexDirection: 'row', gap: 0, backgroundColor: C.bgCook, borderRadius: Radius.md, padding: 3, marginBottom: 10 },
    modeBtn:          { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 9, borderRadius: Radius.sm },
    modeBtnActive:    { backgroundColor: C.ink },
    modeBtnText:      { fontFamily: Fonts.sansMedium, fontSize: 12, color: C.bodySoft },
    modeBtnTextActive:{ color: C.canvas },

    lookupRow:     { flexDirection: 'row', gap: 8, alignItems: 'center' },
    searchBtn:     { backgroundColor: C.spice, paddingHorizontal: 14, paddingVertical: 13, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
    contactsBtn:   { backgroundColor: C.bgCard, borderWidth: 1, borderColor: C.spice, paddingHorizontal: 14, paddingVertical: 13, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
    customerCard:  { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.bgCard, borderRadius: Radius.md, padding: 12, borderWidth: 1, borderColor: C.spice },
    customerName:  { fontFamily: Fonts.sansMedium, fontSize: 14, color: C.textInk },
    customerPhone: { fontFamily: Fonts.sans, fontSize: 12, color: C.bodySoft },

    itemCard:      { backgroundColor: C.bgCard, borderRadius: Radius.md, padding: 12, borderWidth: 0.5, borderColor: C.borderWarm, gap: 4, ...Shadow.card, marginBottom: 8 },
    itemCardTop:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
    itemNum:       { fontFamily: Fonts.sansMedium, fontSize: 12, color: C.bodySoft },
    itemNumRow:    { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
    miniLabel:     { fontFamily: Fonts.sans, fontSize: 11, color: C.bodySoft, marginBottom: 4 },
    itemAmount:    { fontFamily: Fonts.sansMedium, fontSize: 14, color: C.spice, marginTop: 8 },
    addItemBtn:    { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 10, justifyContent: 'center' },
    addItemText:   { fontFamily: Fonts.sansMedium, fontSize: 14, color: C.spice },

    totalsCard:       { backgroundColor: C.bgCard, borderRadius: Radius.md, padding: 14, borderWidth: 0.5, borderColor: C.borderWarm, gap: 8, marginTop: 8 },
    totalRow:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    totalLabel:       { fontFamily: Fonts.sans, fontSize: 14, color: C.body },
    totalValue:       { fontFamily: Fonts.sansMedium, fontSize: 14, color: C.textInk },
    totalInput:       { fontFamily: Fonts.sans, fontSize: 14, color: C.textInk, textAlign: 'right', minWidth: 80, borderBottomWidth: 0.5, borderBottomColor: C.borderWarm, paddingVertical: 2 },
    totalFinalRow:    { borderTopWidth: 0.5, borderTopColor: C.borderWarm, marginTop: 4, paddingTop: 8 },
    totalFinalLabel:  { fontFamily: Fonts.sansMedium, fontSize: 15, color: C.textInk },
    totalFinalValue:  { fontFamily: Fonts.serif, fontSize: 18, color: C.spice },

    bankCard:     { backgroundColor: C.bgCard, borderRadius: Radius.md, borderWidth: 0.5, borderColor: C.borderWarm, padding: 12, gap: 0 },
    bankAdvice:   { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: C.successBg, borderRadius: Radius.md, padding: 10, marginTop: 8 },
    bankAdviceText: { fontFamily: Fonts.sans, fontSize: 12, color: C.successFg, flex: 1, lineHeight: 17 },

    actionRow:     { flexDirection: 'row', gap: 10, marginTop: 24 },
    draftBtn:      { flex: 1, borderWidth: 1.5, borderColor: C.spice, borderRadius: Radius.md, paddingVertical: 14, alignItems: 'center' },
    draftBtnText:  { fontFamily: Fonts.sansMedium, fontSize: 15, color: C.spice },
    sendBtn:       { flex: 1, backgroundColor: C.spice, borderRadius: Radius.md, paddingVertical: 14, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8 },
    sendBtnText:   { fontFamily: Fonts.sansMedium, fontSize: 15, color: C.canvas },

    contactOverlay:     { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
    contactSheet:       { backgroundColor: C.bg, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '80%', paddingBottom: 20 },
    contactHandle:      { width: 36, height: 4, borderRadius: 2, backgroundColor: C.stone, alignSelf: 'center', marginTop: 10, marginBottom: 4 },
    contactHeader:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.md, paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: C.borderWarm },
    contactTitle:       { fontFamily: Fonts.sansMedium, fontSize: 16, color: C.textInk },
    contactSearchRow:   { flexDirection: 'row', alignItems: 'center', backgroundColor: C.bgCard, borderRadius: Radius.md, borderWidth: 1, borderColor: C.borderWarm, margin: Spacing.md, marginBottom: 8 },
    contactSearchInput: { flex: 1, fontFamily: Fonts.sans, fontSize: 15, color: C.textInk, paddingHorizontal: 8, paddingVertical: 10 },
    contactEmpty:       { fontFamily: Fonts.sans, fontSize: 13, color: C.bodySoft, textAlign: 'center', padding: 24 },
    contactItem:        { paddingVertical: 10, borderBottomWidth: 0.5, borderBottomColor: C.borderWarm },
    contactName:        { fontFamily: Fonts.sansMedium, fontSize: 14, color: C.textInk, marginBottom: 4 },
    contactPhone:       { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 4, paddingHorizontal: 8, backgroundColor: C.bgCard, borderRadius: Radius.sm, marginBottom: 4, alignSelf: 'flex-start' },
    contactPhoneText:   { fontFamily: Fonts.sans, fontSize: 13, color: C.spice },
  });
}
