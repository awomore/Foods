import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator,
  Image, KeyboardAvoidingView, Platform, ScrollView, Modal, FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useColors, type AppColors } from '../src/context/ThemeContext';
import { useAuth } from '../src/context/AuthContext';
import { useFeedback } from '../src/components/feedback';
import { pickImage, takePhoto, uploadImage, type PickResult } from '../src/utils/imageUpload';
import { postsApi } from '../src/api/posts';
import { api } from '../src/api/client';
import { trackEvent } from '../src/utils/analytics';
import { Fonts, Spacing, Radius } from '../src/constants/theme';
import type { PostType } from '../src/api/feed';

const MAX_PHOTOS = 4;

interface PostTypeConfig {
  key: PostType;
  label: string;
  icon: string;
  color: string;
  hasTitle: boolean;
}

const POST_TYPES: PostTypeConfig[] = [
  { key: 'dish_reveal',         label: 'Dish Reveal',         icon: 'sparkles',       color: '#FF8A5C', hasTitle: true  },
  { key: 'kitchen_story',       label: 'Kitchen Story',       icon: 'restaurant',     color: '#FF6B35', hasTitle: false },
  { key: 'behind_the_scenes',   label: 'Behind The Scenes',   icon: 'videocam',       color: '#2A5FBF', hasTitle: false },
  { key: 'flash_sale',          label: 'Flash Sale',          icon: 'pricetag',       color: '#DC2626', hasTitle: true  },
  { key: 'weekly_menu',         label: 'Weekly Menu',         icon: 'calendar',       color: '#2E8B3F', hasTitle: true  },
];

interface MenuItem {
  id: string;
  title: string;
  unit_price: number;
  photos: string[];
}

export default function CreatePostScreen() {
  const router = useRouter();
  const C = useColors();
  const { user } = useAuth();
  const feedback = useFeedback();
  const styles = useMemo(() => makeStyles(C), [C]);

  const [postType, setPostType] = useState<PostType>('kitchen_story');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [photos, setPhotos] = useState<PickResult[]>([]);
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [linkedItemId, setLinkedItemId] = useState<string | null>(null);
  const [linkedItemTitle, setLinkedItemTitle] = useState<string | null>(null);
  const [isScheduled, setIsScheduled] = useState(false);
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('');

  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [showItemPicker, setShowItemPicker] = useState(false);
  const [loadingItems, setLoadingItems] = useState(false);

  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);

  const typeConfig = POST_TYPES.find(t => t.key === postType)!;
  const showTitle = typeConfig.hasTitle;

  const loadMenuItems = useCallback(async () => {
    if (!user?.cook_id) return;
    setLoadingItems(true);
    try {
      const { items } = await api.get<{ items: MenuItem[] }>(`/menu/cook/${user.cook_id}`);
      setMenuItems(items ?? []);
    } catch {
      setMenuItems([]);
    } finally {
      setLoadingItems(false);
    }
  }, [user?.cook_id]);

  useEffect(() => {
    if (showItemPicker) loadMenuItems();
  }, [showItemPicker, loadMenuItems]);

  function promptAddPhoto() {
    if (photos.length >= MAX_PHOTOS) {
      feedback.warn(`Max ${MAX_PHOTOS} photos per post`);
      return;
    }
    feedback.actionSheet({
      title: 'Add photo',
      actions: [
        { label: 'Take photo',           icon: 'camera-outline', onPress: doCamera },
        { label: 'Choose from library',  icon: 'image-outline',  onPress: doLibrary },
      ],
    });
  }

  async function doCamera() {
    const r = await takePhoto();
    if (r) setPhotos(prev => [...prev, r]);
  }

  async function doLibrary() {
    const r = await pickImage();
    if (r) setPhotos(prev => [...prev, r]);
  }

  function removePhoto(index: number) {
    setPhotos(prev => prev.filter((_, i) => i !== index));
  }

  function selectItem(item: MenuItem) {
    setLinkedItemId(item.id);
    setLinkedItemTitle(item.title);
    setShowItemPicker(false);
  }

  function clearLinkedItem() {
    setLinkedItemId(null);
    setLinkedItemTitle(null);
  }

  function buildScheduledAt(): string | undefined {
    if (!isScheduled || !scheduleDate || !scheduleTime) return undefined;
    const iso = `${scheduleDate}T${scheduleTime}:00`;
    if (isNaN(new Date(iso).getTime())) return undefined;
    return new Date(iso).toISOString();
  }

  async function uploadAllPhotos(): Promise<string[]> {
    const urls: string[] = [];
    for (const photo of photos) {
      const { url } = await uploadImage(photo, 'diary');
      urls.push(url);
    }
    return urls;
  }

  async function handleSubmit(status: 'published' | 'draft' | 'scheduled') {
    if (!body.trim()) { feedback.warn('Write something first'); return; }

    if (status === 'scheduled') {
      const at = buildScheduledAt();
      if (!at) { feedback.warn('Enter a valid date and time for scheduling'); return; }
    }

    setBusy(true);
    try {
      let uploadedUrls: string[] = [];
      if (photos.length > 0) {
        setUploading(true);
        try {
          uploadedUrls = await uploadAllPhotos();
        } catch {
          feedback.warn('Some photos failed to upload');
        } finally {
          setUploading(false);
        }
      }

      const data: Parameters<typeof postsApi.create>[0] = {
        body: body.trim(),
        post_type: postType,
        status,
        title: showTitle && title.trim() ? title.trim() : undefined,
        photo_urls: uploadedUrls,
        linked_item_id: linkedItemId ?? undefined,
        scheduled_at: status === 'scheduled' ? buildScheduledAt() : undefined,
      };

      const result = await postsApi.create(data);

      const eventName = status === 'draft'
        ? 'post_draft_saved'
        : status === 'scheduled'
        ? 'post_scheduled'
        : 'post_published';
      trackEvent(eventName, {
        post_type:       postType,
        has_photo:       uploadedUrls.length > 0,
        has_linked_item: !!linkedItemId,
        is_scheduled:    status === 'scheduled',
      }, { post_id: (result as any)?.post?.id });

      const msg = status === 'draft' ? 'Draft saved' : status === 'scheduled' ? 'Post scheduled' : 'Post published!';
      feedback.success(msg);
      router.back();
    } catch (e: any) {
      feedback.error('Error', e.error ?? 'Could not save post');
    } finally {
      setBusy(false);
    }
  }

  const publishLabel = isScheduled ? 'Schedule' : 'Publish';
  const canPublish = (!!body.trim() || (showTitle && !!title.trim())) && !busy;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.root}>

        {/* ── Header ── */}
        <SafeAreaView>
          <View style={styles.topBar}>
            <TouchableOpacity onPress={() => router.back()} disabled={busy} style={styles.cancelBtn}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.pageTitle}>New Post</Text>
            <View style={styles.headerActions}>
              <TouchableOpacity
                style={styles.draftBtn}
                onPress={() => handleSubmit('draft')}
                disabled={!canPublish}
              >
                <Text style={[styles.draftText, !canPublish && { opacity: 0.4 }]}>Draft</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.publishBtn, !canPublish && styles.publishBtnDisabled]}
                onPress={() => handleSubmit(isScheduled ? 'scheduled' : 'published')}
                disabled={!canPublish}
              >
                {busy
                  ? <ActivityIndicator size="small" color={C.canvas} />
                  : <Text style={styles.publishBtnText}>{uploading ? 'Uploading…' : publishLabel}</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        </SafeAreaView>

        <ScrollView
          contentContainerStyle={{ paddingBottom: 80 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ── Post Type Selector ── */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.typeRow}
          >
            {POST_TYPES.map(t => (
              <TouchableOpacity
                key={t.key}
                style={[
                  styles.typePill,
                  postType === t.key && { backgroundColor: t.color + '22', borderColor: t.color },
                ]}
                onPress={() => setPostType(t.key)}
              >
                <Ionicons
                  name={t.icon as any}
                  size={14}
                  color={postType === t.key ? t.color : C.bodySoft}
                />
                <Text style={[
                  styles.typePillText,
                  postType === t.key && { color: t.color },
                ]}>
                  {t.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* ── Title (conditional) ── */}
          {showTitle && (
            <View style={styles.inputBlock}>
              <TextInput
                style={styles.titleInput}
                placeholder={
                  postType === 'dish_reveal' ? 'Name this dish…' :
                  postType === 'flash_sale'  ? 'Flash sale headline…' :
                  'Weekly menu title…'
                }
                placeholderTextColor={C.bodySoft}
                value={title}
                onChangeText={setTitle}
                maxLength={80}
                editable={!busy}
              />
            </View>
          )}

          {/* ── Body ── */}
          <TextInput
            style={styles.bodyInput}
            placeholder={
              postType === 'dish_reveal'       ? "Tell the story behind this dish…" :
              postType === 'kitchen_story'     ? "Share what's happening in the kitchen…" :
              postType === 'behind_the_scenes' ? "Take your followers behind the scenes…" :
              postType === 'flash_sale'        ? "Describe the sale — quantities, prices, duration…" :
              "What's on the menu this week?"
            }
            placeholderTextColor={C.bodySoft}
            multiline
            value={body}
            onChangeText={setBody}
            maxLength={1000}
            editable={!busy}
          />

          {/* ── Photo Previews ── */}
          {photos.length > 0 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.photoRow}
            >
              {photos.map((p, i) => (
                <View key={i} style={styles.photoThumb}>
                  <Image source={{ uri: p.uri }} style={styles.photoThumbImg} resizeMode="cover" />
                  <TouchableOpacity style={styles.photoRemove} onPress={() => removePhoto(i)}>
                    <Ionicons name="close-circle" size={20} color={C.canvas} />
                  </TouchableOpacity>
                </View>
              ))}
              {photos.length < MAX_PHOTOS && (
                <TouchableOpacity style={styles.photoAddBtn} onPress={promptAddPhoto} disabled={busy}>
                  <Ionicons name="add" size={24} color={C.spice} />
                </TouchableOpacity>
              )}
            </ScrollView>
          )}

          {/* ── Linked Item (Order This CTA) ── */}
          <View style={styles.sectionRow}>
            {linkedItemId ? (
              <View style={styles.linkedItem}>
                <Ionicons name="cart" size={16} color={C.spice} />
                <Text style={styles.linkedItemText} numberOfLines={1}>{linkedItemTitle}</Text>
                <TouchableOpacity onPress={clearLinkedItem}>
                  <Ionicons name="close-circle-outline" size={18} color={C.bodySoft} />
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity style={styles.linkItemBtn} onPress={() => setShowItemPicker(true)} disabled={busy}>
                <Ionicons name="cart-outline" size={16} color={C.spice} />
                <Text style={styles.linkItemText}>Tag a dish — "Order This" CTA</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* ── Schedule ── */}
          <View style={styles.sectionRow}>
            <TouchableOpacity
              style={styles.scheduleToggle}
              onPress={() => setIsScheduled(v => !v)}
              disabled={busy}
            >
              <Ionicons
                name={isScheduled ? 'time' : 'time-outline'}
                size={16}
                color={isScheduled ? C.spice : C.bodySoft}
              />
              <Text style={[styles.scheduleLabel, isScheduled && { color: C.spice }]}>
                Schedule for later
              </Text>
              <View style={[styles.toggleDot, isScheduled && styles.toggleDotActive]} />
            </TouchableOpacity>
          </View>

          {isScheduled && (
            <View style={styles.scheduleInputRow}>
              <TextInput
                style={[styles.scheduleInput, { flex: 1 }]}
                placeholder="Date (YYYY-MM-DD)"
                placeholderTextColor={C.bodySoft}
                value={scheduleDate}
                onChangeText={setScheduleDate}
                keyboardType="numbers-and-punctuation"
                editable={!busy}
              />
              <TextInput
                style={[styles.scheduleInput, { width: 90 }]}
                placeholder="Time (HH:MM)"
                placeholderTextColor={C.bodySoft}
                value={scheduleTime}
                onChangeText={setScheduleTime}
                keyboardType="numbers-and-punctuation"
                editable={!busy}
              />
            </View>
          )}
        </ScrollView>

        {/* ── Bottom Toolbar ── */}
        <SafeAreaView edges={['bottom']}>
          <View style={styles.toolbar}>
            <TouchableOpacity
              style={styles.toolBtn}
              onPress={promptAddPhoto}
              disabled={busy || photos.length >= MAX_PHOTOS}
            >
              <Ionicons name="image-outline" size={22} color={photos.length >= MAX_PHOTOS ? C.stone : C.spice} />
              <Text style={[styles.toolBtnText, photos.length >= MAX_PHOTOS && { color: C.stone }]}>
                Photo {photos.length > 0 ? `(${photos.length}/${MAX_PHOTOS})` : ''}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.toolBtn}
              onPress={() => feedback.warn('Video upload coming soon')}
              disabled={busy}
            >
              <Ionicons name="videocam-outline" size={22} color={C.stone} />
              <Text style={[styles.toolBtnText, { color: C.stone }]}>Video</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.toolBtn}
              onPress={() => setShowItemPicker(true)}
              disabled={busy}
            >
              <Ionicons name="cart-outline" size={22} color={linkedItemId ? C.spice : C.bodySoft} />
              <Text style={[styles.toolBtnText, linkedItemId && { color: C.spice }]}>Tag Dish</Text>
            </TouchableOpacity>
            <Text style={styles.charCount}>{body.length}/1000</Text>
          </View>
        </SafeAreaView>
      </View>

      {/* ── Item Picker Modal ── */}
      <Modal
        visible={showItemPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowItemPicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Tag a dish</Text>
              <TouchableOpacity onPress={() => setShowItemPicker(false)}>
                <Ionicons name="close" size={22} color={C.textInk} />
              </TouchableOpacity>
            </View>
            {loadingItems ? (
              <ActivityIndicator color={C.spice} style={{ margin: 24 }} />
            ) : menuItems.length === 0 ? (
              <Text style={styles.modalEmpty}>No active menu items found.</Text>
            ) : (
              <FlatList
                data={menuItems}
                keyExtractor={item => item.id}
                contentContainerStyle={{ padding: Spacing.md, gap: 8 }}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={[styles.itemRow, item.id === linkedItemId && styles.itemRowSelected]}
                    onPress={() => selectItem(item)}
                  >
                    <Ionicons name="restaurant-outline" size={18} color={C.spice} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.itemRowTitle}>{item.title}</Text>
                      <Text style={styles.itemRowPrice}>
                        ₦{item.unit_price.toLocaleString()}
                      </Text>
                    </View>
                    {item.id === linkedItemId && (
                      <Ionicons name="checkmark-circle" size={18} color={C.spice} />
                    )}
                  </TouchableOpacity>
                )}
              />
            )}
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

function makeStyles(C: AppColors) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: C.bg },

    topBar: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: Spacing.md, paddingTop: 8, paddingBottom: 12,
      borderBottomWidth: 0.5, borderBottomColor: C.borderWarm,
    },
    cancelBtn: { paddingVertical: 6, paddingRight: 4 },
    cancelText: { fontFamily: Fonts.sans, fontSize: 15, color: C.bodySoft },
    pageTitle: { fontFamily: Fonts.serif, fontSize: 17, color: C.textInk },
    headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    draftBtn: { paddingVertical: 7, paddingHorizontal: 12 },
    draftText: { fontFamily: Fonts.sansMedium, fontSize: 14, color: C.bodySoft },
    publishBtn: {
      backgroundColor: C.spice, borderRadius: 40,
      paddingVertical: 7, paddingHorizontal: 16, minWidth: 70, alignItems: 'center',
    },
    publishBtnDisabled: { backgroundColor: C.stone },
    publishBtnText: { fontFamily: Fonts.sansMedium, fontSize: 14, color: C.canvas },

    typeRow: { paddingHorizontal: Spacing.md, paddingVertical: 14, gap: 8 },
    typePill: {
      flexDirection: 'row', alignItems: 'center', gap: 5,
      paddingHorizontal: 12, paddingVertical: 7,
      borderRadius: 40, borderWidth: 1, borderColor: C.borderWarm,
      backgroundColor: C.bgCard,
    },
    typePillText: { fontFamily: Fonts.sansMedium, fontSize: 12, color: C.bodySoft },

    inputBlock: {
      paddingHorizontal: Spacing.md, paddingBottom: 4,
      borderBottomWidth: 0.5, borderBottomColor: C.borderWarm,
    },
    titleInput: {
      fontFamily: Fonts.sansMedium, fontSize: 17, color: C.textInk,
      paddingVertical: 12,
    },

    bodyInput: {
      fontFamily: Fonts.sans, fontSize: 15, color: C.textInk,
      padding: Spacing.md, lineHeight: 23, minHeight: 160,
      textAlignVertical: 'top',
    },

    photoRow: { paddingHorizontal: Spacing.md, paddingBottom: 14, gap: 10 },
    photoThumb: { width: 90, height: 90, borderRadius: Radius.md, overflow: 'hidden' },
    photoThumbImg: { width: '100%', height: '100%' },
    photoRemove: { position: 'absolute', top: 4, right: 4 },
    photoAddBtn: {
      width: 90, height: 90, borderRadius: Radius.md,
      borderWidth: 1.5, borderColor: C.spice, borderStyle: 'dashed',
      alignItems: 'center', justifyContent: 'center',
    },

    sectionRow: {
      paddingHorizontal: Spacing.md, paddingVertical: 12,
      borderTopWidth: 0.5, borderTopColor: C.borderWarm,
    },
    linkItemBtn: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    linkItemText: { fontFamily: Fonts.sansMedium, fontSize: 13, color: C.spice },
    linkedItem: {
      flexDirection: 'row', alignItems: 'center', gap: 8,
      backgroundColor: C.bgCard, borderRadius: Radius.md,
      paddingHorizontal: 12, paddingVertical: 8,
      borderWidth: 0.5, borderColor: C.spice + '60',
    },
    linkedItemText: { fontFamily: Fonts.sansMedium, fontSize: 13, color: C.textInk, flex: 1 },

    scheduleToggle: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    scheduleLabel: { fontFamily: Fonts.sansMedium, fontSize: 13, color: C.bodySoft, flex: 1 },
    toggleDot: {
      width: 20, height: 12, borderRadius: 6,
      backgroundColor: C.stone,
    },
    toggleDotActive: { backgroundColor: C.spice },

    scheduleInputRow: {
      flexDirection: 'row', gap: 10,
      paddingHorizontal: Spacing.md, paddingBottom: 14,
    },
    scheduleInput: {
      backgroundColor: C.bgCard, borderRadius: Radius.md,
      borderWidth: 0.5, borderColor: C.borderWarm,
      paddingHorizontal: 12, paddingVertical: 10,
      fontFamily: Fonts.sans, fontSize: 13, color: C.textInk,
    },

    toolbar: {
      flexDirection: 'row', alignItems: 'center',
      paddingHorizontal: Spacing.md, paddingVertical: 10,
      borderTopWidth: 0.5, borderTopColor: C.borderWarm,
    },
    toolBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 6, paddingRight: 14 },
    toolBtnText: { fontFamily: Fonts.sansMedium, fontSize: 12, color: C.spice },
    charCount: { marginLeft: 'auto', fontFamily: Fonts.sans, fontSize: 12, color: C.stone },

    // Item picker modal
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
    modalSheet: {
      backgroundColor: C.bg, borderTopLeftRadius: 20, borderTopRightRadius: 20,
      maxHeight: '70%', paddingBottom: 20,
    },
    modalHandle: {
      width: 36, height: 4, borderRadius: 2, backgroundColor: C.stone,
      alignSelf: 'center', marginTop: 10, marginBottom: 4,
    },
    modalHeader: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: Spacing.md, paddingVertical: 12,
      borderBottomWidth: 0.5, borderBottomColor: C.borderWarm,
    },
    modalTitle: { fontFamily: Fonts.sansMedium, fontSize: 16, color: C.textInk },
    modalEmpty: {
      fontFamily: Fonts.sans, fontSize: 13, color: C.bodySoft,
      textAlign: 'center', padding: 24,
    },
    itemRow: {
      flexDirection: 'row', alignItems: 'center', gap: 12,
      backgroundColor: C.bgCard, borderRadius: Radius.md,
      padding: 14, borderWidth: 0.5, borderColor: C.borderWarm,
    },
    itemRowSelected: { borderColor: C.spice, backgroundColor: C.spice + '12' },
    itemRowTitle: { fontFamily: Fonts.sansMedium, fontSize: 14, color: C.textInk },
    itemRowPrice: { fontFamily: Fonts.sans, fontSize: 12, color: C.bodySoft, marginTop: 2 },
  });
}
