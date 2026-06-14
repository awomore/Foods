import React, { useState, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useColors, type AppColors } from '../../src/context/ThemeContext';
import { Fonts, Spacing, Radius } from '../../src/constants/theme';
import { useFeedback } from '../../src/components/feedback';
import { coursesApi } from '../../src/api/courses';

const LEVELS = [
  { key: 'beginner',     label: 'Beginner' },
  { key: 'intermediate', label: 'Intermediate' },
  { key: 'advanced',     label: 'Advanced' },
] as const;

type Level = typeof LEVELS[number]['key'];

export default function CourseCreateScreen() {
  const router = useRouter();
  const C = useColors();
  const styles = useMemo(() => makeStyles(C), [C]);
  const feedback = useFeedback();

  const [title, setTitle]         = useState('');
  const [description, setDesc]    = useState('');
  const [level, setLevel]         = useState<Level>('beginner');
  const [price, setPrice]         = useState('');
  const [isFree, setIsFree]       = useState(false);
  const [saving, setSaving]       = useState(false);

  async function handleSave(publish = false) {
    if (!title.trim()) return feedback.warn('Title required');
    if (!description.trim()) return feedback.warn('Description required', 'Tell learners what they\'ll get from this course.');
    const priceNum = isFree ? 0 : (parseFloat(price) || 0);

    setSaving(true);
    try {
      const { course } = await coursesApi.create({
        title: title.trim(),
        description: description.trim(),
        level,
        price: priceNum,
        is_free: isFree,
        is_published: publish,
      });
      feedback.success(publish ? 'Course published!' : 'Draft saved', 'Now add lessons to your course.');
      router.replace({ pathname: '/course/[id]', params: { id: course.id } } as any);
    } catch (e: any) {
      feedback.error('Error', e.error ?? 'Could not save course');
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
        <Text style={styles.title}>New Course</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

        <Text style={styles.label}>Title</Text>
        <TextInput
          style={styles.input}
          value={title}
          onChangeText={setTitle}
          placeholder="e.g. Mastering Nigerian Soups"
          placeholderTextColor={C.bodySoft}
          maxLength={100}
        />

        <Text style={styles.label}>Description</Text>
        <TextInput
          style={[styles.input, { minHeight: 100, textAlignVertical: 'top' }]}
          value={description}
          onChangeText={setDesc}
          placeholder="What will students learn? What's covered?"
          placeholderTextColor={C.bodySoft}
          multiline
          maxLength={800}
        />

        <Text style={styles.label}>Level</Text>
        <View style={styles.levelRow}>
          {LEVELS.map(l => (
            <TouchableOpacity
              key={l.key}
              style={[styles.levelPill, level === l.key && styles.levelPillActive]}
              onPress={() => setLevel(l.key)}
            >
              <Text style={[styles.levelText, level === l.key && styles.levelTextActive]}>{l.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity style={styles.freeToggle} onPress={() => setIsFree(v => !v)}>
          <Ionicons name={isFree ? 'checkbox' : 'square-outline'} size={20} color={isFree ? C.spice : C.bodySoft} />
          <Text style={[styles.freeLabel, isFree && { color: C.spice }]}>Free course</Text>
        </TouchableOpacity>

        {!isFree && (
          <>
            <Text style={styles.label}>Price (NGN)</Text>
            <TextInput
              style={styles.input}
              value={price}
              onChangeText={setPrice}
              placeholder="e.g. 5000"
              placeholderTextColor={C.bodySoft}
              keyboardType="numeric"
            />
          </>
        )}

        <View style={styles.actionRow}>
          <TouchableOpacity style={[styles.draftBtn, saving && { opacity: 0.6 }]} onPress={() => handleSave(false)} disabled={saving}>
            <Text style={styles.draftBtnText}>Save draft</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.publishBtn, saving && { opacity: 0.6 }]} onPress={() => handleSave(true)} disabled={saving}>
            {saving
              ? <ActivityIndicator size="small" color={C.canvas} />
              : <Text style={styles.publishBtnText}>Publish</Text>
            }
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function makeStyles(C: AppColors) {
  return StyleSheet.create({
    root:            { flex: 1, backgroundColor: C.bg },
    header:          { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.lg, paddingTop: 16, paddingBottom: 12, gap: 8, borderBottomWidth: 0.5, borderBottomColor: C.borderWarm },
    backBtn:         { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
    title:           { flex: 1, fontFamily: Fonts.serif, fontSize: 20, color: C.textInk, textAlign: 'center' },
    content:         { padding: Spacing.lg, gap: 4, paddingBottom: 50 },
    label:           { fontFamily: Fonts.sansMedium, fontSize: 13, color: C.textInk, marginTop: 16, marginBottom: 6 },
    input:           { backgroundColor: C.bgCard, borderRadius: Radius.md, borderWidth: 1, borderColor: C.borderWarm, paddingHorizontal: 14, paddingVertical: 12, fontFamily: Fonts.sans, fontSize: 15, color: C.textInk },
    levelRow:        { flexDirection: 'row', gap: 8 },
    levelPill:       { flex: 1, paddingVertical: 10, borderRadius: Radius.md, borderWidth: 1, borderColor: C.borderWarm, backgroundColor: C.bgCard, alignItems: 'center' },
    levelPillActive: { backgroundColor: C.spice, borderColor: C.spice },
    levelText:       { fontFamily: Fonts.sansMedium, fontSize: 13, color: C.bodySoft },
    levelTextActive: { color: C.canvas },
    freeToggle:      { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 16, paddingVertical: 4 },
    freeLabel:       { fontFamily: Fonts.sansMedium, fontSize: 14, color: C.bodySoft },
    actionRow:       { flexDirection: 'row', gap: 10, marginTop: 28 },
    draftBtn:        { flex: 1, borderWidth: 1.5, borderColor: C.spice, borderRadius: Radius.md, paddingVertical: 14, alignItems: 'center' },
    draftBtnText:    { fontFamily: Fonts.sansMedium, fontSize: 15, color: C.spice },
    publishBtn:      { flex: 1, backgroundColor: C.spice, borderRadius: Radius.md, paddingVertical: 14, alignItems: 'center' },
    publishBtnText:  { fontFamily: Fonts.sansMedium, fontSize: 15, color: C.canvas },
  });
}
