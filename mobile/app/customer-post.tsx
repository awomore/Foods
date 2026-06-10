import React, { useState, useMemo, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Image, ActivityIndicator, KeyboardAvoidingView,
  Platform, FlatList, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { customerPostsApi } from '../src/api/customerPosts';
import { cooksApi, type CookCard } from '../src/api/cooks';
import { uploadApi } from '../src/api/upload';
import { useFeedback } from '../src/components/feedback';
import { useAuth } from '../src/context/AuthContext';
import { Fonts, Spacing, Radius, Shadow, FontSize } from '../src/constants/theme';
import { useColors, type AppColors } from '../src/context/ThemeContext';
import Avatar from '../src/components/ui/Avatar';

type MediaItem = { uri: string; type: 'photo' | 'video' };

export default function CustomerPostScreen() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuth();
  const C = useColors();
  const styles = useMemo(() => makeStyles(C), [C]);
  const feedback = useFeedback();

  const [body, setBody] = useState('');
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [taggedCooks, setTaggedCooks] = useState<CookCard[]>([]);
  const [uploading, setUploading] = useState(false);
  const [posting, setPosting] = useState(false);
  const [showTagModal, setShowTagModal] = useState(false);
  const [cookSearch, setCookSearch] = useState('');
  const [cookResults, setCookResults] = useState<CookCard[]>([]);
  const [searchingCooks, setSearchingCooks] = useState(false);

  const canPost = body.trim().length > 0 || media.length > 0;

  const pickMedia = async (mediaTypes: ImagePicker.ImagePickerOptions['mediaTypes']) => {
    const isVideoOnly = Array.isArray(mediaTypes) && mediaTypes.length === 1 && mediaTypes[0] === 'videos';
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes,
      allowsMultipleSelection: !isVideoOnly,
      quality: 0.85,
      videoMaxDuration: 60,
    });
    if (!result.canceled) {
      const items: MediaItem[] = result.assets.map(a => ({
        uri: a.uri,
        type: (a.type === 'video' ? 'video' : 'photo') as 'photo' | 'video',
      }));
      setMedia(prev => [...prev, ...items].slice(0, 8));
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const openCamera = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      feedback.warn('Permission needed', 'Allow camera access in your device settings.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images', 'videos'],
      quality: 0.85,
    });
    if (!result.canceled && result.assets[0]) {
      const a = result.assets[0];
      setMedia(prev => [...prev, { uri: a.uri, type: a.type === 'video' ? 'video' : 'photo' }].slice(0, 8));
    }
  };

  const searchCooks = useCallback(async (q: string) => {
    setCookSearch(q);
    if (q.trim().length < 2) { setCookResults([]); return; }
    setSearchingCooks(true);
    try {
      const res = await (cooksApi as any).list({ search: q, limit: 10 });
      setCookResults(res.data?.cooks ?? []);
    } catch {
    } finally {
      setSearchingCooks(false);
    }
  }, []);

  const handlePost = async () => {
    if (!isAuthenticated) { router.push('/(auth)/phone' as any); return; }
    if (!canPost) return;
    setPosting(true);
    try {
      const photoUrls: string[] = [];
      let videoUrl: string | undefined;

      if (media.length > 0) {
        setUploading(true);
        for (const m of media) {
          const form = new FormData();
          if (m.type === 'video') {
            form.append('video', { uri: m.uri, type: 'video/mp4', name: 'video.mp4' } as any);
            form.append('folder', 'posts');
            const { url } = await uploadApi.uploadVideo(form);
            videoUrl = url;
          } else {
            form.append('file', { uri: m.uri, type: 'image/jpeg', name: 'photo.jpg' } as any);
            form.append('folder', 'posts');
            const { url } = await uploadApi.upload(form);
            photoUrls.push(url);
          }
        }
        setUploading(false);
      }

      await customerPostsApi.create({
        body: body.trim() || undefined,
        photo_urls: photoUrls,
        video_url: videoUrl,
        tagged_cook_ids: taggedCooks.map(c => c.id),
      });

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      feedback.success('Posted!', 'Your food story is live.');
      router.back();
    } catch (e: any) {
      setUploading(false);
      feedback.error('Error', e.error ?? 'Could not create post');
    } finally {
      setPosting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.cancel}>Cancel</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Share Food Story</Text>
        <TouchableOpacity
          style={[styles.postBtn, (!canPost || posting) && styles.postBtnOff]}
          onPress={handlePost}
          disabled={!canPost || posting}
        >
          {posting ? <ActivityIndicator size="small" color={C.canvas} /> : (
            <Text style={styles.postBtnText}>Post</Text>
          )}
        </TouchableOpacity>
      </View>

      {uploading && (
        <View style={styles.uploadBanner}>
          <ActivityIndicator size="small" color={C.canvas} />
          <Text style={styles.uploadText}>Uploading…</Text>
        </View>
      )}

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
          {/* Author */}
          <View style={styles.authorRow}>
            <Avatar name={user?.full_name ?? 'You'} uri={user?.avatar_url} size={42} />
            <View>
              <Text style={styles.authorName}>{user?.full_name ?? 'Food Lover'}</Text>
              <Text style={styles.authorSub}>Sharing a food experience</Text>
            </View>
          </View>

          {/* Caption */}
          <TextInput
            style={styles.captionInput}
            value={body}
            onChangeText={setBody}
            placeholder="What did you eat? How was it? Tag the creator!"
            placeholderTextColor={C.stone}
            multiline
            maxLength={500}
            autoFocus
          />
          {body.length > 400 && (
            <Text style={styles.charCount}>{500 - body.length} characters left</Text>
          )}

          {/* Media thumbnails */}
          {media.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: Spacing.lg, gap: 10, paddingVertical: 8 }}>
              {media.map((m, i) => (
                <View key={i} style={styles.thumb}>
                  <Image source={{ uri: m.uri }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                  {m.type === 'video' && (
                    <View style={styles.playOverlay}>
                      <Ionicons name="play-circle" size={28} color="rgba(255,255,255,0.9)" />
                    </View>
                  )}
                  <TouchableOpacity style={styles.removeBtn} onPress={() => setMedia(p => p.filter((_, j) => j !== i))}>
                    <Ionicons name="close-circle" size={22} color="#fff" />
                  </TouchableOpacity>
                </View>
              ))}
              {media.length < 8 && (
                <TouchableOpacity style={styles.addThumb} onPress={() => pickMedia(['images', 'videos'])}>
                  <Ionicons name="add" size={30} color={C.spice} />
                </TouchableOpacity>
              )}
            </ScrollView>
          )}

          {/* Tagged creators */}
          {taggedCooks.length > 0 && (
            <View style={styles.tagSection}>
              <Text style={styles.tagSectionLabel}>Tagged creators</Text>
              <View style={styles.tagRow}>
                {taggedCooks.map(c => (
                  <TouchableOpacity key={c.id} style={styles.tagChip} onPress={() => setTaggedCooks(p => p.filter(x => x.id !== c.id))}>
                    <Avatar name={c.display_name} uri={c.avatar_url} size={18} />
                    <Text style={styles.tagChipText}>{c.display_name}</Text>
                    <Ionicons name="close" size={12} color={C.bodySoft} />
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* Action toolbar */}
          <View style={styles.toolbar}>
            <TouchableOpacity style={styles.toolItem} onPress={openCamera}>
              <View style={styles.toolIcon}><Ionicons name="camera-outline" size={22} color={C.spice} /></View>
              <Text style={styles.toolLabel}>Camera</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.toolItem} onPress={() => pickMedia(['images'])}>
              <View style={styles.toolIcon}><Ionicons name="images-outline" size={22} color={C.spice} /></View>
              <Text style={styles.toolLabel}>Photos</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.toolItem} onPress={() => pickMedia(['videos'])}>
              <View style={styles.toolIcon}><Ionicons name="videocam-outline" size={22} color={C.spice} /></View>
              <Text style={styles.toolLabel}>Video</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.toolItem} onPress={() => setShowTagModal(true)}>
              <View style={styles.toolIcon}><Ionicons name="person-add-outline" size={22} color={C.spice} /></View>
              <Text style={styles.toolLabel}>Tag</Text>
            </TouchableOpacity>
          </View>

          {/* Guidelines */}
          <View style={styles.guideline}>
            <Ionicons name="heart-outline" size={14} color={C.spice} />
            <Text style={styles.guidelineText}>
              Share your honest food experience. Tag the creator so they can celebrate your post!
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Tag Modal */}
      <Modal visible={showTagModal} animationType="slide" transparent onRequestClose={() => setShowTagModal(false)}>
        <View style={styles.modalBg}>
          <View style={styles.modalSheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Tag a Creator</Text>

            <View style={styles.searchBar}>
              <Ionicons name="search-outline" size={16} color={C.bodySoft} />
              <TextInput
                style={styles.searchInput}
                value={cookSearch}
                onChangeText={searchCooks}
                placeholder="Search creators by name…"
                placeholderTextColor={C.stone}
                autoFocus
              />
              {searchingCooks && <ActivityIndicator size="small" color={C.spice} />}
            </View>

            <FlatList
              data={cookResults}
              keyExtractor={c => c.id}
              style={{ maxHeight: 320 }}
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => {
                const isTagged = taggedCooks.some(c => c.id === item.id);
                return (
                  <TouchableOpacity
                    style={styles.cookRow}
                    onPress={() => {
                      if (isTagged) {
                        setTaggedCooks(p => p.filter(c => c.id !== item.id));
                      } else {
                        setTaggedCooks(p => [...p, item]);
                      }
                    }}
                  >
                    <Avatar name={item.display_name} uri={item.avatar_url} size={38} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.cookRowName}>{item.display_name}</Text>
                      {item.location && <Text style={styles.cookRowLocation}>{item.location}</Text>}
                    </View>
                    {isTagged
                      ? <Ionicons name="checkmark-circle" size={20} color={C.successFg} />
                      : <Ionicons name="add-circle-outline" size={20} color={C.spice} />
                    }
                  </TouchableOpacity>
                );
              }}
              ListEmptyComponent={
                cookSearch.length >= 2 && !searchingCooks
                  ? <Text style={styles.emptySearch}>No creators found for "{cookSearch}"</Text>
                  : cookSearch.length < 2
                  ? <Text style={styles.emptySearch}>Type at least 2 characters to search</Text>
                  : null
              }
            />

            <TouchableOpacity style={styles.doneBtn} onPress={() => setShowTagModal(false)}>
              <Text style={styles.doneBtnText}>Done ({taggedCooks.length} tagged)</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function makeStyles(C: AppColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: C.bg },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.lg, paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: C.borderWarm },
    cancel: { fontFamily: Fonts.sans, fontSize: FontSize.body, color: C.bodySoft },
    title: { fontFamily: Fonts.sansMedium, fontSize: FontSize.body, color: C.ink },
    postBtn: { backgroundColor: C.spice, borderRadius: Radius.full, paddingHorizontal: 18, paddingVertical: 8 },
    postBtnOff: { opacity: 0.4 },
    postBtnText: { fontFamily: Fonts.sansMedium, fontSize: FontSize.body, color: C.canvas },
    uploadBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.ink, paddingHorizontal: Spacing.lg, paddingVertical: 8 },
    uploadText: { fontFamily: Fonts.sans, fontSize: FontSize.sm, color: C.canvas },
    authorRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: Spacing.lg, paddingVertical: 14 },
    authorName: { fontFamily: Fonts.sansMedium, fontSize: FontSize.body, color: C.ink },
    authorSub: { fontFamily: Fonts.sans, fontSize: FontSize.xs, color: C.bodySoft, marginTop: 1 },
    captionInput: { fontFamily: Fonts.sans, fontSize: 16, color: C.ink, paddingHorizontal: Spacing.lg, minHeight: 120, textAlignVertical: 'top', lineHeight: 24 },
    charCount: { fontFamily: Fonts.sans, fontSize: FontSize.xs, color: C.bodySoft, paddingHorizontal: Spacing.lg, textAlign: 'right', marginBottom: 4 },
    thumb: { width: 120, height: 120, borderRadius: Radius.md, overflow: 'hidden', position: 'relative', backgroundColor: C.bgCook },
    playOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.3)', alignItems: 'center', justifyContent: 'center' },
    removeBtn: { position: 'absolute', top: 4, right: 4 },
    addThumb: { width: 120, height: 120, borderRadius: Radius.md, borderWidth: 2, borderColor: C.spice, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' },
    tagSection: { paddingHorizontal: Spacing.lg, paddingTop: 12, gap: 8 },
    tagSectionLabel: { fontFamily: Fonts.sansMedium, fontSize: FontSize.sm, color: C.ink },
    tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    tagChip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.bgCard, borderRadius: Radius.full, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 0.5, borderColor: C.borderWarm },
    tagChipText: { fontFamily: Fonts.sansMedium, fontSize: FontSize.sm, color: C.ink },
    toolbar: { flexDirection: 'row', paddingHorizontal: Spacing.lg, paddingVertical: 14, borderTopWidth: 0.5, borderTopColor: C.borderWarm, gap: 20, marginTop: 8 },
    toolItem: { alignItems: 'center', gap: 4 },
    toolIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: C.honey, alignItems: 'center', justifyContent: 'center' },
    toolLabel: { fontFamily: Fonts.sans, fontSize: FontSize.xs, color: C.bodySoft },
    guideline: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginHorizontal: Spacing.lg, padding: 12, backgroundColor: C.bgCook, borderRadius: Radius.md },
    guidelineText: { fontFamily: Fonts.sans, fontSize: FontSize.xs, color: C.bodySoft, flex: 1, lineHeight: 17 },
    modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
    modalSheet: { backgroundColor: C.bgCard, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: Spacing.lg, paddingBottom: 36 },
    sheetHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: C.borderWarm, alignSelf: 'center', marginBottom: 14 },
    sheetTitle: { fontFamily: Fonts.serif, fontSize: 20, color: C.ink, marginBottom: 14 },
    searchBar: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.bg, borderRadius: Radius.md, borderWidth: 0.5, borderColor: C.borderWarm, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 12 },
    searchInput: { flex: 1, fontFamily: Fonts.sans, fontSize: FontSize.body, color: C.ink },
    cookRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: C.borderWarm },
    cookRowName: { fontFamily: Fonts.sansMedium, fontSize: FontSize.body, color: C.ink },
    cookRowLocation: { fontFamily: Fonts.sans, fontSize: FontSize.xs, color: C.bodySoft },
    emptySearch: { fontFamily: Fonts.sans, fontSize: FontSize.body, color: C.bodySoft, textAlign: 'center', paddingVertical: 24 },
    doneBtn: { marginTop: 16, backgroundColor: C.ink, borderRadius: Radius.full, paddingVertical: 14, alignItems: 'center' },
    doneBtnText: { fontFamily: Fonts.sansMedium, fontSize: FontSize.body, color: C.canvas },
  });
}
