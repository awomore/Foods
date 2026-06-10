import React, { useState, useMemo } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Image, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../src/api/client';
import { pickImage, takePhoto, uploadImage } from '../src/utils/imageUpload';
import { Fonts, Spacing, Radius } from '../src/constants/theme';
import { useColors, type AppColors } from '../src/context/ThemeContext';
import { useFeedback } from '../src/components/feedback';

export default function DiaryPostScreen() {
  const router = useRouter();
  const C = useColors();
  const styles = useMemo(() => makeStyles(C), [C]);
  const [body, setBody] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [photoBase64, setPhotoBase64] = useState<string | null>(null);
  const [photoMime, setPhotoMime] = useState('image/jpeg');
  const feedback = useFeedback();
  const [uploading, setUploading] = useState(false);
  const [posting, setPosting] = useState(false);

  function promptPhoto() {
    feedback.actionSheet({
      title: 'Add photo',
      actions: [
        { label: 'Take photo', icon: 'camera-outline', onPress: doCamera },
        { label: 'Choose from library', icon: 'image-outline', onPress: doLibrary },
      ],
    });
  }

  async function doCamera() {
    const r = await takePhoto();
    if (r) { setPhotoUri(r.uri); setPhotoBase64(r.base64); setPhotoMime(r.mimeType); }
  }

  async function doLibrary() {
    const r = await pickImage();
    if (r) { setPhotoUri(r.uri); setPhotoBase64(r.base64); setPhotoMime(r.mimeType); }
  }

  async function submit() {
    if (!body.trim()) { feedback.warn('Write something first'); return; }
    setPosting(true);
    try {
      let photo_url: string | undefined;

      if (photoUri && photoBase64) {
        setUploading(true);
        try {
          ({ url: photo_url } = await uploadImage({ uri: photoUri, base64: photoBase64, mimeType: photoMime }, 'diary'));
        } catch {
          feedback.warn('Photo upload failed', 'Your post will be shared without the photo.');
        } finally {
          setUploading(false);
        }
      }

      await api.post('/diary', { body: body.trim(), photo_url });
      router.back();
    } catch (e: any) {
      feedback.error('Error', e.error ?? 'Could not publish post');
    } finally {
      setPosting(false);
    }
  }

  const busy = uploading || posting;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.root}>
        <SafeAreaView>
          <View style={styles.topBar}>
            <TouchableOpacity onPress={() => router.back()} style={styles.cancelBtn} disabled={busy}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.title}>New update</Text>
            <TouchableOpacity
              style={[styles.postBtn, (!body.trim() || busy) && styles.postBtnDisabled]}
              onPress={submit}
              disabled={!body.trim() || busy}
            >
              {busy
                ? <ActivityIndicator color={C.canvas} size="small" />
                : <Text style={styles.postBtnText}>{uploading ? 'Uploading…' : 'Post'}</Text>}
            </TouchableOpacity>
          </View>
        </SafeAreaView>

        <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
          <TextInput
            style={styles.bodyInput}
            placeholder={"Share a kitchen update, behind-the-scenes moment, or today's specials…"}
            placeholderTextColor={C.stone}
            multiline
            autoFocus
            value={body}
            onChangeText={setBody}
            maxLength={1000}
            editable={!busy}
          />

          {photoUri && (
            <View style={styles.photoPreviewWrap}>
              <Image source={{ uri: photoUri }} style={styles.photoPreview} resizeMode="cover" />
              <TouchableOpacity style={styles.removePhoto} onPress={() => { setPhotoUri(null); setPhotoBase64(null); }}>
                <Ionicons name="close-circle" size={24} color={C.canvas} />
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>

        <SafeAreaView>
          <View style={styles.toolbar}>
            <TouchableOpacity style={styles.toolBtn} onPress={promptPhoto} disabled={busy}>
              <Ionicons name="image-outline" size={22} color={C.spice} />
              <Text style={styles.toolBtnText}>Photo</Text>
            </TouchableOpacity>
            <Text style={styles.charCount}>{body.length}/1000</Text>
          </View>
        </SafeAreaView>
      </View>
    </KeyboardAvoidingView>
  );
}

function makeStyles(C: AppColors) { return StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },

  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.md, paddingTop: 8, paddingBottom: 12,
    borderBottomWidth: 0.5, borderBottomColor: C.borderWarm,
  },
  cancelBtn: { paddingVertical: 6, paddingHorizontal: 2 },
  cancelText: { fontFamily: Fonts.sans, fontSize: 15, color: C.bodySoft },
  title: { fontFamily: Fonts.serif, fontSize: 17, color: C.textInk },
  postBtn: {
    backgroundColor: C.spice, borderRadius: 40,
    paddingVertical: 7, paddingHorizontal: 18, minWidth: 60, alignItems: 'center',
  },
  postBtnDisabled: { backgroundColor: C.stone },
  postBtnText: { fontFamily: Fonts.sansMedium, fontSize: 14, color: C.canvas },

  bodyInput: {
    fontFamily: Fonts.sans, fontSize: 16, color: C.textInk,
    padding: Spacing.lg, lineHeight: 24, minHeight: 200,
    textAlignVertical: 'top',
  },

  photoPreviewWrap: { marginHorizontal: Spacing.md, borderRadius: Radius.lg, overflow: 'hidden', marginBottom: 16 },
  photoPreview: { width: '100%', aspectRatio: 4 / 3 },
  removePhoto: { position: 'absolute', top: 8, right: 8 },

  toolbar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.md, paddingVertical: 10,
    borderTopWidth: 0.5, borderTopColor: C.borderWarm,
  },
  toolBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6, paddingHorizontal: 4 },
  toolBtnText: { fontFamily: Fonts.sansMedium, fontSize: 13, color: C.spice },
  charCount: { fontFamily: Fonts.sans, fontSize: 12, color: C.stone },
}); }
