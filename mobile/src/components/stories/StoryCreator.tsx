import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, TextInput,
  Modal, ScrollView, ActivityIndicator, KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { storiesApi, type StoryType, STORY_TYPE_LABELS } from '../../api/stories';
import { pickImage, uploadImage, type PickResult } from '../../utils/imageUpload';
import { useColors } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useFeedback } from '../feedback';
import { Fonts, Spacing, Radius } from '../../constants/theme';

const BASE_URL =
  (process.env.EXPO_PUBLIC_API_URL ?? 'https://foodsbyme-api-production.up.railway.app') + '/api';

interface Props {
  visible: boolean;
  onClose: () => void;
  onCreated?: () => void;
}

interface VideoAsset {
  uri: string;
  mimeType: string;
}

const STORY_TYPES: StoryType[] = ['cooking_now', 'available_today', 'sold_out', 'flash_sale'];

const TYPE_ICONS: Record<StoryType, string> = {
  cooking_now:     'flame',
  available_today: 'checkmark-circle',
  sold_out:        'close-circle',
  flash_sale:      'pricetag',
  live:            'radio',
};

const TYPE_DESCRIPTIONS: Record<StoryType, string> = {
  cooking_now:     "You're actively cooking right now",
  available_today: "You have availability today",
  sold_out:        "Today's slots are full",
  flash_sale:      "Special limited-time offer",
  live:            "You're live",
};

export default function StoryCreator({ visible, onClose, onCreated }: Props) {
  const C = useColors();
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const feedback = useFeedback();

  const [selectedType, setSelectedType] = useState<StoryType>('cooking_now');
  const [caption, setCaption] = useState('');
  const [pickedMedia, setPickedMedia] = useState<PickResult | null>(null);
  const [pickedVideo, setPickedVideo] = useState<VideoAsset | null>(null);
  const [mediaKind, setMediaKind] = useState<'photo' | 'video'>('photo');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [posting, setPosting] = useState(false);

  async function handlePickPhoto() {
    const picked = await pickImage();
    if (!picked) return;
    setPickedMedia(picked);
    setPickedVideo(null);
    setMediaKind('photo');
  }

  async function handlePickVideo() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['videos'],
      allowsEditing: false,
      quality: 0.8,
    });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    setPickedVideo({ uri: asset.uri, mimeType: asset.mimeType ?? 'video/mp4' });
    setPickedMedia(null);
    setMediaKind('video');
  }

  function clearMedia() {
    setPickedMedia(null);
    setPickedVideo(null);
    setUploadProgress(0);
  }

  // XHR-based video upload with progress reporting
  function uploadVideoXHR(asset: VideoAsset, folder: string): Promise<{ url: string; public_id: string }> {
    return new Promise((resolve, reject) => {
      const form = new FormData();
      form.append('video', { uri: asset.uri, type: asset.mimeType, name: 'story.mp4' } as any);
      form.append('folder', folder);

      const xhr = new XMLHttpRequest();
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) setUploadProgress(Math.round((e.loaded / e.total) * 100));
      };
      xhr.onload = () => {
        try {
          const data = JSON.parse(xhr.responseText);
          if (xhr.status >= 200 && xhr.status < 300) resolve(data);
          else reject(new Error(data.error ?? 'Video upload failed'));
        } catch {
          reject(new Error('Video upload failed'));
        }
      };
      xhr.onerror = () => reject(new Error('Network error during video upload'));
      xhr.ontimeout = () => reject(new Error('Video upload timed out'));
      xhr.timeout = 120_000; // 2 minutes
      xhr.open('POST', `${BASE_URL}/upload/video`);
      if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      xhr.send(form);
    });
  }

  async function handlePost() {
    setPosting(true);
    try {
      let media_url: string | undefined;
      let media_cloudinary_id: string | undefined;
      let resolved_media_type: 'photo' | 'video' | undefined;

      if (pickedMedia) {
        setUploading(true);
        try {
          const result = await uploadImage(pickedMedia, 'stories');
          media_url = result.url;
          media_cloudinary_id = result.public_id;
          resolved_media_type = 'photo';
        } finally {
          setUploading(false);
        }
      } else if (pickedVideo) {
        setUploading(true);
        setUploadProgress(0);
        try {
          const result = await uploadVideoXHR(pickedVideo, 'stories');
          media_url = result.url;
          media_cloudinary_id = result.public_id;
          resolved_media_type = 'video';
        } finally {
          setUploading(false);
          setUploadProgress(0);
        }
      }

      await storiesApi.create({
        type: selectedType,
        ...(media_url ? { media_url, media_type: resolved_media_type } : {}),
        ...(media_cloudinary_id ? { media_cloudinary_id } : {}),
        ...(caption.trim() ? { caption: caption.trim() } : {}),
      });

      setCaption('');
      setPickedMedia(null);
      setPickedVideo(null);
      onCreated?.();
      onClose();
    } catch (e: any) {
      feedback.error(e?.error ?? e?.message ?? 'Failed to post story. Please try again.');
    } finally {
      setPosting(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <KeyboardAvoidingView
        style={[styles.container, { backgroundColor: C.bg }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header */}
        <View style={[styles.header, { paddingTop: insets.top + Spacing.sm, borderBottomColor: C.borderWarm }]}>
          <TouchableOpacity onPress={onClose} hitSlop={12}>
            <Ionicons name="close" size={24} color={C.ink} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: C.ink }]}>New Story</Text>
          <TouchableOpacity
            onPress={handlePost}
            disabled={posting}
            style={[styles.postBtn, { backgroundColor: C.spice, opacity: posting ? 0.6 : 1 }]}
          >
            {posting ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.postBtnText}>Share</Text>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>

          {/* Type selector */}
          <Text style={[styles.sectionLabel, { color: C.bodySoft }]}>STORY TYPE</Text>
          <View style={styles.typeGrid}>
            {STORY_TYPES.map(type => {
              const active = selectedType === type;
              return (
                <TouchableOpacity
                  key={type}
                  style={[
                    styles.typeCard,
                    { borderColor: active ? C.spice : C.borderWarm, backgroundColor: active ? C.spice + '18' : C.bgCard },
                  ]}
                  onPress={() => setSelectedType(type)}
                  activeOpacity={0.8}
                >
                  <Ionicons
                    name={TYPE_ICONS[type] as any}
                    size={22}
                    color={active ? C.spice : C.bodySoft}
                  />
                  <Text style={[styles.typeCardLabel, { color: active ? C.spice : C.ink }]}>
                    {STORY_TYPE_LABELS[type]}
                  </Text>
                  <Text style={[styles.typeCardDesc, { color: C.bodySoft }]}>
                    {TYPE_DESCRIPTIONS[type]}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Media picker */}
          <Text style={[styles.sectionLabel, { color: C.bodySoft, marginTop: Spacing.lg }]}>MEDIA (optional)</Text>
          <View style={[styles.mediaPicker, { borderColor: C.borderWarm, backgroundColor: C.bgCard }]}>
            {pickedMedia ? (
              <>
                <Image source={{ uri: pickedMedia.uri }} style={styles.mediaPreview} contentFit="cover" />
                <TouchableOpacity style={styles.removeMedia} onPress={clearMedia} hitSlop={8}>
                  <Ionicons name="close-circle" size={22} color="#fff" />
                </TouchableOpacity>
              </>
            ) : pickedVideo ? (
              <View style={styles.mediaEmpty}>
                <Ionicons name="videocam" size={36} color={C.spice} />
                {uploading && uploadProgress > 0 ? (
                  <>
                    <Text style={[styles.mediaEmptyText, { color: C.ink }]}>Uploading… {uploadProgress}%</Text>
                    <View style={[styles.progressTrack, { backgroundColor: C.borderWarm }]}>
                      <View style={[styles.progressBar, { width: `${uploadProgress}%` as any, backgroundColor: C.spice }]} />
                    </View>
                  </>
                ) : (
                  <Text style={[styles.mediaEmptyText, { color: C.ink }]}>Video selected</Text>
                )}
                {!uploading && (
                  <TouchableOpacity onPress={clearMedia} hitSlop={8} style={{ marginTop: 4 }}>
                    <Text style={{ fontFamily: Fonts.sans, fontSize: 12, color: C.errorFg }}>Remove</Text>
                  </TouchableOpacity>
                )}
              </View>
            ) : (
              <View style={styles.mediaButtons}>
                <TouchableOpacity style={[styles.mediaBtn, { borderColor: C.borderWarm }]} onPress={handlePickPhoto} activeOpacity={0.8}>
                  <Ionicons name="camera-outline" size={22} color={C.bodySoft} />
                  <Text style={[styles.mediaEmptyText, { color: C.bodySoft }]}>Photo</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.mediaBtn, { borderColor: C.borderWarm }]} onPress={handlePickVideo} activeOpacity={0.8}>
                  <Ionicons name="videocam-outline" size={22} color={C.bodySoft} />
                  <Text style={[styles.mediaEmptyText, { color: C.bodySoft }]}>Video</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Caption */}
          <Text style={[styles.sectionLabel, { color: C.bodySoft, marginTop: Spacing.lg }]}>CAPTION (optional)</Text>
          <TextInput
            style={[styles.captionInput, { color: C.ink, borderColor: C.borderWarm, backgroundColor: C.bgCard }]}
            placeholder="What do you want followers to know?"
            placeholderTextColor={C.bodySoft}
            value={caption}
            onChangeText={setCaption}
            maxLength={200}
            multiline
          />
          <Text style={[styles.charCount, { color: C.bodySoft }]}>{caption.length}/200</Text>

          <View style={{ height: insets.bottom + Spacing.xl }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: {
    flex: 1,
    textAlign: 'center',
    fontFamily: Fonts.sansMedium,
    fontSize: 16,
  },
  postBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: Radius.full,
    minWidth: 64,
    alignItems: 'center',
  },
  postBtnText: {
    color: '#fff',
    fontFamily: Fonts.sansMedium,
    fontSize: 14,
  },
  body: {
    padding: Spacing.md,
  },
  sectionLabel: {
    fontFamily: Fonts.sansMedium,
    fontSize: 11,
    letterSpacing: 0.8,
    marginBottom: Spacing.sm,
  },
  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  typeCard: {
    width: '47%',
    padding: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    gap: 4,
  },
  typeCardLabel: {
    fontFamily: Fonts.sansMedium,
    fontSize: 13,
  },
  typeCardDesc: {
    fontFamily: Fonts.sans,
    fontSize: 11,
    lineHeight: 15,
  },
  mediaPicker: {
    height: 180,
    borderRadius: Radius.md,
    borderWidth: 1,
    overflow: 'hidden',
  },
  mediaPreview: {
    width: '100%',
    height: '100%',
  },
  removeMedia: {
    position: 'absolute',
    top: 8,
    right: 8,
  },
  mediaButtons: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
  },
  mediaBtn: {
    flex: 1,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRightWidth: StyleSheet.hairlineWidth,
  },
  mediaEmpty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: Spacing.md,
  },
  mediaEmptyText: {
    fontFamily: Fonts.sans,
    fontSize: 13,
  },
  progressTrack: {
    width: '80%',
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    borderRadius: 2,
  },
  captionInput: {
    borderWidth: 1,
    borderRadius: Radius.md,
    padding: Spacing.md,
    fontFamily: Fonts.sans,
    fontSize: 14,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  charCount: {
    fontFamily: Fonts.sans,
    fontSize: 11,
    textAlign: 'right',
    marginTop: 4,
  },
});
