import React, { useState, useMemo, useCallback } from 'react';
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
import { useColors, type AppColors } from '../../src/context/ThemeContext';
import { Fonts, Spacing, Radius, Shadow } from '../../src/constants/theme';
import { useFeedback } from '../../src/components/feedback';
import { fmtCurrency } from '../../src/utils/format';

interface CustomerResult { id: string; name: string; phone: string }

export default function InvoiceCreateScreen() {
  const router = useRouter();
  const C = useColors();
  const styles = useMemo(() => makeStyles(C), [C]);
  const feedback = useFeedback();

  const [phone, setPhone]           = useState('');
  const [customer, setCustomer]     = useState<CustomerResult | null>(null);
  const [looking, setLooking]       = useState(false);

  const [items, setItems]           = useState<LineItem[]>([
    { description: '', quantity: 1, unit_price: 0, amount: 0 },
  ]);
  const [discount, setDiscount]     = useState('0');
  const [tax, setTax]               = useState('0');
  const [dueDate, setDueDate]       = useState('');
  const [notes, setNotes]           = useState('');
  const [saving, setSaving]         = useState(false);

  const [showContactPicker, setShowContactPicker]   = useState(false);
  const [contactQuery, setContactQuery]             = useState('');
  const [contactResults, setContactResults]         = useState<Contacts.Contact[]>([]);
  const [searchingContacts, setSearchingContacts]   = useState(false);

  const subtotal = items.reduce((s, i) => s + i.amount, 0);
  const total    = Math.max(0, subtotal - parseFloat(discount || '0') + parseFloat(tax || '0'));

  async function lookupCustomerWithPhone(phoneNumber: string) {
    const cleaned = phoneNumber.trim();
    if (!cleaned) return;
    setLooking(true);
    try {
      const data = await api.get<{ user: CustomerResult }>(`/cooks/customer-lookup?phone=${encodeURIComponent(cleaned)}`);
      setCustomer(data.user);
    } catch {
      feedback.error('Not found', 'No FOODSbyme account with that number.');
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
    if (!customer) return feedback.warn('Customer required', 'Look up a customer first.');
    const hasItems = items.some(i => i.description.trim() && i.amount > 0);
    if (!hasItems) return feedback.warn('Add items', 'Add at least one line item with a description and price.');

    setSaving(true);
    try {
      const validItems = items.filter(i => i.description.trim());
      const { invoice } = await invoicesApi.create({
        customer_id:     customer.id,
        line_items:      validItems,
        subtotal,
        discount_amount: parseFloat(discount) || 0,
        tax_amount:      parseFloat(tax) || 0,
        total,
        due_date:        parseInputDate(dueDate),
        notes:           notes || undefined,
      });

      if (!asDraft) {
        await invoicesApi.send(invoice.id).catch(() => {});
      }

      feedback.success(asDraft ? 'Draft saved' : 'Invoice sent', `Invoice ${invoice.invoice_number} created.`);
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

        {/* Customer */}
        <Text style={styles.sectionLabel}>Customer</Text>
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
          <TouchableOpacity style={styles.lookupBtn} onPress={openContactPicker} disabled={looking}>
            {looking
              ? <ActivityIndicator size="small" color={C.canvas} />
              : <Ionicons name="people-outline" size={20} color={C.canvas} />
            }
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
              placeholder="Description"
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
            <Text style={styles.totalLabel}>Tax (NGN)</Text>
            <TextInput
              style={styles.totalInput}
              value={tax}
              onChangeText={setTax}
              keyboardType="numeric"
              placeholderTextColor={C.bodySoft}
            />
          </View>
          <View style={[styles.totalRow, { borderTopWidth: 0.5, borderTopColor: C.borderWarm, marginTop: 4, paddingTop: 8 }]}>
            <Text style={[styles.totalLabel, { fontFamily: Fonts.sansMedium, color: C.textInk }]}>Total</Text>
            <Text style={[styles.totalValue, { color: C.spice, fontFamily: Fonts.serif, fontSize: 18 }]}>{fmtCurrency(total, 'NGN')}</Text>
          </View>
        </View>

        {/* Due date & notes */}
        <Text style={styles.sectionLabel}>Due date (DD-MM-YYYY)</Text>
        <TextInput
          style={styles.input}
          value={dueDate}
          onChangeText={setDueDate}
          placeholder="e.g. 01-07-2026"
          placeholderTextColor={C.bodySoft}
          keyboardType="numbers-and-punctuation"
        />

        <Text style={styles.sectionLabel}>Notes (optional)</Text>
        <TextInput
          style={[styles.input, { minHeight: 80, textAlignVertical: 'top' }]}
          value={notes}
          onChangeText={setNotes}
          placeholder="Any additional notes for the customer…"
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
              <Text style={styles.sendBtnText}>Send invoice</Text>
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
    content:       { padding: Spacing.lg, gap: 4, paddingBottom: 50 },
    sectionLabel:  { fontFamily: Fonts.sansMedium, fontSize: 13, color: C.textInk, marginTop: 16, marginBottom: 6 },
    input:         { backgroundColor: C.bgCard, borderRadius: Radius.md, borderWidth: 1, borderColor: C.borderWarm, paddingHorizontal: 14, paddingVertical: 12, fontFamily: Fonts.sans, fontSize: 15, color: C.textInk, marginBottom: 4 },
    lookupRow:     { flexDirection: 'row', gap: 8, alignItems: 'center' },
    lookupBtn:     { backgroundColor: C.spice, paddingHorizontal: 18, paddingVertical: 13, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
    customerCard:  { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.bgCard, borderRadius: Radius.md, padding: 12, borderWidth: 1, borderColor: C.spice, marginTop: 6 },
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
    totalsCard:    { backgroundColor: C.bgCard, borderRadius: Radius.md, padding: 14, borderWidth: 0.5, borderColor: C.borderWarm, gap: 8, marginTop: 8 },
    totalRow:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    totalLabel:    { fontFamily: Fonts.sans, fontSize: 14, color: C.body },
    totalValue:    { fontFamily: Fonts.sansMedium, fontSize: 14, color: C.textInk },
    totalInput:    { fontFamily: Fonts.sans, fontSize: 14, color: C.textInk, textAlign: 'right', minWidth: 80, borderBottomWidth: 0.5, borderBottomColor: C.borderWarm, paddingVertical: 2 },
    actionRow:     { flexDirection: 'row', gap: 10, marginTop: 24 },
    draftBtn:      { flex: 1, borderWidth: 1.5, borderColor: C.spice, borderRadius: Radius.md, paddingVertical: 14, alignItems: 'center' },
    draftBtnText:  { fontFamily: Fonts.sansMedium, fontSize: 15, color: C.spice },
    sendBtn:       { flex: 1, backgroundColor: C.spice, borderRadius: Radius.md, paddingVertical: 14, alignItems: 'center' },
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
