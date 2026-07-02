import React, { useState, useCallback, useRef, useMemo } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Image, ActivityIndicator, FlatList,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { useColors, type AppColors } from '../../src/context/ThemeContext';
import { Fonts, Spacing, Radius, Shadow } from '../../src/constants/theme';
import { customerPostsApi } from '../../src/api/customerPosts';
import { uploadApi } from '../../src/api/upload';
import { discoverApi } from '../../src/api/discover';
import type { CookCard } from '../../src/api/cooks';
import { useFeedback } from '../../src/components/feedback';
import { useTranslation } from 'react-i18next';

const MAX_PHOTOS = 4;
const MAX_BODY = 500;

export default function CreateFoodPostScreen() {
  const router = useRouter();
  const C = useColors();
  const styles = useMemo(() => makeStyles(C), [C]);
  const feedback = useFeedback();
  const { t } = useTranslation();
  const inputRef = useRef<TextInput>(null);

  const [body, setBody] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // @ mention state
  const [mentionQuery, setMentionQuery] = useState<string | null>(null); // null = not searching
  const [mentionResults, setMentionResults] = useState<CookCard[]>([]);
  const [searchingMentions, setSearchingMentions] = useState(false);
  const [taggedCooks, setTaggedCooks] = useState<{ id: string; display_name: string; username: string | null }[]>([]);
  const mentionDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Parse the current @ query from text cursor position
  function detectMention(text: string): string | null {
    const atIdx = text.lastIndexOf('@');
    if (atIdx === -1) return null;
    const after = text.slice(atIdx + 1);
    // Stop if there's a space after the @ — user has moved on
    if (after.includes(' ') || after.includes('\n')) return null;
    return after; // could be empty string = just typed @
  }

  const handleBodyChange = useCallback((text: string) => {
    setBody(text.slice(0, MAX_BODY));
    const query = detectMention(text);

    if (query === null) {
      setMentionQuery(null);
      setMentionResults([]);
      return;
    }

    setMentionQuery(query);

    // Debounce the search
    if (mentionDebounce.current) clearTimeout(mentionDebounce.current);
    mentionDebounce.current = setTimeout(async () => {
      setSearchingMentions(true);
      try {
        const res = await discoverApi.search({ q: query.length > 0 ? query : undefined, limit: 8 });
        setMentionResults(res.cooks ?? []);
      } catch { setMentionResults([]); }
      finally { setSearchingMentions(false); }
    }, 300);
  }, []);

  function insertMention(cook: CookCard) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const handle = cook.username ?? cook.display_name.replace(/\s+/g, '').toLowerCase();
    const atIdx = body.lastIndexOf('@');
    const newBody = body.slice(0, atIdx) + `@${handle} `;
    setBody(newBody);
    setMentionQuery(null);
    setMentionResults([]);

    // Track this cook as tagged (avoid duplicates)
    setTaggedCooks(prev => {
      if (prev.some(t => t.id === cook.id)) return prev;
      return [...prev, { id: cook.id, display_name: cook.display_name, username: cook.username ?? null }];
    });
    inputRef.current?.focus();
  }

  const pickPhotos = useCallback(async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      feedback.warn(t('create_post.permission_title'), t('create_post.permission_body'));
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      quality: 0.85,
      selectionLimit: MAX_PHOTOS - photos.length,
    });
    if (result.canceled) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setUploading(true);
    try {
      const uploaded: string[] = [];
      for (const asset of result.assets) {
        const formData = new FormData();
        formData.append('file', { uri: asset.uri, type: asset.mimeType ?? 'image/jpeg', name: `food-post-${Date.now()}.jpg` } as any);
        const res = await uploadApi.upload(formData);
        if (res.url) uploaded.push(res.url);
      }
      setPhotos(prev => [...prev, ...uploaded].slice(0, MAX_PHOTOS));
    } catch { feedback.error(t('create_post.upload_failed'), t('create_post.upload_failed_body')); }
    finally { setUploading(false); }
  }, [photos.length]);

  const removePhoto = useCallback((index: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setPhotos(prev => prev.filter((_, i) => i !== index));
  }, []);

  const canSubmit = body.trim().length > 0 || photos.length > 0;

  const handleSubmit = useCallback(async () => {
    if (!canSubmit || submitting) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSubmitting(true);
    try {
      await customerPostsApi.create({
        body: body.trim() || undefined,
        photo_urls: photos.length > 0 ? photos : undefined,
        tagged_cook_ids: taggedCooks.length > 0 ? taggedCooks.map(t => t.id) : undefined,
      });
      router.back();
    } catch { feedback.error(t('create_post.post_failed'), t('create_post.post_failed_body')); }
    finally { setSubmitting(false); }
  }, [body, photos, taggedCooks, canSubmit, submitting, router]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
            <Ionicons name="close" size={24} color={C.ink} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('create_post.header_title')}</Text>
          <TouchableOpacity
            onPress={handleSubmit}
            disabled={!canSubmit || submitting || uploading}
            style={[styles.postBtn, (!canSubmit || submitting || uploading) && styles.postBtnDisabled]}
          >
            {submitting ? <ActivityIndicator size="small" color={C.white} /> : <Text style={styles.postBtnText}>{t('create_post.post')}</Text>}
          </TouchableOpacity>
        </View>

        {/* @ mention suggestions dropdown */}
        {mentionQuery !== null && (
          <View style={styles.mentionDropdown}>
            {searchingMentions ? (
              <View style={{ padding: 12, alignItems: 'center' }}>
                <ActivityIndicator size="small" color={C.spice} />
              </View>
            ) : mentionResults.length === 0 ? (
              <View style={{ padding: 12 }}>
                <Text style={{ fontFamily: Fonts.sans, fontSize: 13, color: C.bodySoft }}>
                  {mentionQuery.length === 0 ? t('create_post.mention_start') : t('create_post.mention_none', { query: mentionQuery })}
                </Text>
              </View>
            ) : (
              <FlatList
                data={mentionResults}
                keyExtractor={item => item.id}
                keyboardShouldPersistTaps="handled"
                style={{ maxHeight: 200 }}
                renderItem={({ item }) => (
                  <TouchableOpacity style={styles.mentionRow} onPress={() => insertMention(item)} activeOpacity={0.7}>
                    <View style={styles.mentionAvatar}>
                      <Text style={styles.mentionAvatarText}>{item.display_name.charAt(0).toUpperCase()}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.mentionName}>{item.display_name}</Text>
                      {item.username && <Text style={styles.mentionHandle}>@{item.username}</Text>}
                    </View>
                    {item.is_health_kitchen && (
                      <View style={styles.healthTag}><Ionicons name="leaf" size={10} color={C.healthFg} /></View>
                    )}
                  </TouchableOpacity>
                )}
                ItemSeparatorComponent={() => <View style={{ height: 0.5, backgroundColor: C.borderWarm, marginLeft: 46 }} />}
              />
            )}
          </View>
        )}

        <ScrollView style={styles.flex} contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          {/* Caption */}
          <TextInput
            ref={inputRef}
            style={styles.input}
            placeholder={t('create_post.body_placeholder')}
            placeholderTextColor={C.caps}
            multiline
            value={body}
            onChangeText={handleBodyChange}
            autoFocus
          />
          <Text style={[styles.charCount, body.length > MAX_BODY * 0.9 && styles.charCountWarn]}>
            {body.length}/{MAX_BODY}
          </Text>

          {/* Tag hint */}
          <View style={styles.tagHint}>
            <Ionicons name="at-circle-outline" size={14} color={C.spice} />
            <Text style={styles.tagHintText}>{t('create_post.tag_hint_pre')}<Text style={{ color: C.spice }}>{t('create_post.tag_hint_mid')}</Text>{t('create_post.tag_hint_post')}</Text>
          </View>

          {/* Tagged cooks chips */}
          {taggedCooks.length > 0 && (
            <View style={styles.taggedRow}>
              {taggedCooks.map(cook => (
                <TouchableOpacity
                  key={cook.id}
                  style={styles.taggedChip}
                  onPress={() => {
                    // Untag
                    setTaggedCooks(prev => prev.filter(t => t.id !== cook.id));
                    const handle = cook.username ?? cook.display_name.replace(/\s+/g, '').toLowerCase();
                    setBody(b => b.replace(`@${handle} `, '').replace(`@${handle}`, ''));
                  }}
                >
                  <Ionicons name="person-outline" size={11} color={C.spice} />
                  <Text style={styles.taggedChipText}>@{cook.username ?? cook.display_name}</Text>
                  <Ionicons name="close" size={11} color={C.bodySoft} />
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Photo Grid */}
          {photos.length > 0 && (
            <View style={styles.photoGrid}>
              {photos.map((uri, i) => (
                <View key={uri} style={styles.photoWrap}>
                  <Image source={{ uri }} style={styles.photo} resizeMode="cover" />
                  <TouchableOpacity style={styles.removePhoto} onPress={() => removePhoto(i)} hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}>
                    <Ionicons name="close-circle" size={22} color={C.white} />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}

          {/* Add Photo Button */}
          {photos.length < MAX_PHOTOS && (
            <TouchableOpacity style={[styles.addPhotoBtn, uploading && styles.addPhotoBtnDisabled]} onPress={pickPhotos} disabled={uploading}>
              {uploading ? (
                <ActivityIndicator size="small" color={C.spice} />
              ) : (
                <>
                  <Ionicons name="camera-outline" size={22} color={C.spice} />
                  <Text style={styles.addPhotoText}>{photos.length === 0 ? t('create_post.add_photos') : t('create_post.add_more', { count: MAX_PHOTOS - photos.length })}</Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function makeStyles(C: AppColors) {
  return StyleSheet.create({
    flex: { flex: 1 },
    safe: { flex: 1, backgroundColor: C.canvas },
    header: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: Spacing.md, paddingVertical: 12,
      borderBottomWidth: 0.5, borderBottomColor: C.borderWarm,
    },
    headerBtn: { padding: 4 },
    headerTitle: { fontFamily: Fonts.sansMedium, fontSize: 16, color: C.ink },
    postBtn: { backgroundColor: C.spice, paddingHorizontal: 18, paddingVertical: 8, borderRadius: Radius.full, minWidth: 60, alignItems: 'center' },
    postBtnDisabled: { backgroundColor: C.borderWarm },
    postBtnText: { fontFamily: Fonts.sansMedium, fontSize: 14, color: C.white },
    body: { padding: Spacing.md, paddingBottom: 60, gap: 12 },
    input: { fontFamily: Fonts.sans, fontSize: 15, color: C.ink, minHeight: 100, textAlignVertical: 'top', lineHeight: 22 },
    charCount: { fontFamily: Fonts.sans, fontSize: 11, color: C.caps, textAlign: 'right' },
    charCountWarn: { color: C.ember },
    tagHint: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 2 },
    tagHintText: { fontFamily: Fonts.sans, fontSize: 12, color: C.bodySoft, flex: 1, lineHeight: 17 },
    taggedRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    taggedChip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: C.bgCook, borderRadius: 40, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 0.5, borderColor: C.spice },
    taggedChipText: { fontFamily: Fonts.sansMedium, fontSize: 12, color: C.spice },
    photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
    photoWrap: { width: '47%', aspectRatio: 1, borderRadius: Radius.md, overflow: 'hidden', position: 'relative' },
    photo: { width: '100%', height: '100%' },
    removePhoto: { position: 'absolute', top: 4, right: 4, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 12 },
    addPhotoBtn: {
      flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
      borderWidth: 1.5, borderColor: C.spice, borderStyle: 'dashed',
      borderRadius: Radius.md, paddingVertical: 14, paddingHorizontal: Spacing.md, justifyContent: 'center',
    },
    addPhotoBtnDisabled: { borderColor: C.borderWarm },
    addPhotoText: { fontFamily: Fonts.sansMedium, fontSize: 14, color: C.spice },
    // @ mention dropdown
    mentionDropdown: {
      backgroundColor: C.bgCard, borderBottomWidth: 0.5, borderBottomColor: C.borderWarm,
      ...Shadow.card,
    },
    mentionRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: Spacing.md, paddingVertical: 10 },
    mentionAvatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: C.ember, alignItems: 'center', justifyContent: 'center' },
    mentionAvatarText: { fontFamily: Fonts.sansMedium, fontSize: 14, color: C.canvas },
    mentionName: { fontFamily: Fonts.sansMedium, fontSize: 13, color: C.textInk },
    mentionHandle: { fontFamily: Fonts.sans, fontSize: 11, color: C.bodySoft },
    healthTag: { width: 22, height: 22, borderRadius: 11, backgroundColor: C.healthBg, alignItems: 'center', justifyContent: 'center' },
  });
}
