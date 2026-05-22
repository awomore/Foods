import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, SafeAreaView,
  ActivityIndicator, Alert, Image, KeyboardAvoidingView, Platform, ScrollView,
  ActionSheetIOS,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../src/api/client';
import { pickImage, takePhoto, uploadImage } from '../src/utils/imageUpload';
import { Colors, Fonts, Spacing, Radius, Shadow } from '../src/constants/theme';

export default function DiaryPostScreen() {
  const router = useRouter();
  const [body, setBody] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [photoBase64, setPhotoBase64] = useState<string | null>(null);
  const [photoMime, setPhotoMime] = useState('image/jpeg');
  const [uploading, setUploading] = useState(false);
  const [posting, setPosting] = useState(false);

  function promptPhoto() {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: ['Cancel', 'Take photo', 'Choose from library'], cancelButtonIndex: 0 },
        async (idx) => {
          if (idx === 1) await doCamera();
          if (idx === 2) await doLibrary();
        }
      );
    } else {
      Alert.alert('Add photo', undefined, [
        { text: 'Take photo', onPress: doCamera },
        { text: 'Choose from library', onPress: doLibrary },
        { text: 'Cancel', style: 'cancel' },
      ]);
    }
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
    if (!body.trim()) { Alert.alert('Write something first'); return; }
    setPosting(true);
    try {
      let photo_url: string | undefined;

      if (photoUri && photoBase64) {
        setUploading(true);
        try {
          photo_url = await uploadImage({ uri: photoUri, base64: photoBase64, mimeType: photoMime }, 'diary');
        } catch {
          // Upload failed — post without photo rather than blocking the user
          Alert.alert('Photo upload failed', 'Your post will be shared without the photo.');
        } finally {
          setUploading(false);
        }
      }

      await api.post('/diary', { body: body.trim(), photo_url });
      router.back();
    } catch (e: any) {
      Alert.alert('Error', e.error ?? 'Could not publish post');
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
                ? <ActivityIndicator color={Colors.canvas} size="small" />
                : <Text style={styles.postBtnText}>{uploading ? 'Uploading…' : 'Post'}</Text>}
            </TouchableOpacity>
          </View>
        </SafeAreaView>

        <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
          <TextInput
            style={styles.bodyInput}
            placeholder={"Share a kitchen update, behind-the-scenes moment, or today's specials…"}
            placeholderTextColor={Colors.stone}
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
                <Ionicons name="close-circle" size={24} color={Colors.canvas} />
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>

        <SafeAreaView>
          <View style={styles.toolbar}>
            <TouchableOpacity style={styles.toolBtn} onPress={promptPhoto} disabled={busy}>
              <Ionicons name="image-outline" size={22} color={Colors.spice} />
              <Text style={styles.toolBtnText}>Photo</Text>
            </TouchableOpacity>
            <Text style={styles.charCount}>{body.length}/1000</Text>
          </View>
        </SafeAreaView>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },

  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.md, paddingTop: 8, paddingBottom: 12,
    borderBottomWidth: 0.5, borderBottomColor: Colors.borderWarm,
  },
  cancelBtn: { paddingVertical: 6, paddingHorizontal: 2 },
  cancelText: { fontFamily: Fonts.sans, fontSize: 15, color: Colors.bodySoft },
  title: { fontFamily: Fonts.serif, fontSize: 17, color: Colors.textInk },
  postBtn: {
    backgroundColor: Colors.spice, borderRadius: 40,
    paddingVertical: 7, paddingHorizontal: 18, minWidth: 60, alignItems: 'center',
  },
  postBtnDisabled: { backgroundColor: Colors.stone },
  postBtnText: { fontFamily: Fonts.sansMedium, fontSize: 14, color: Colors.canvas, fontWeight: '600' },

  bodyInput: {
    fontFamily: Fonts.sans, fontSize: 16, color: Colors.textInk,
    padding: Spacing.lg, lineHeight: 24, minHeight: 200,
    textAlignVertical: 'top',
  },

  photoPreviewWrap: { marginHorizontal: Spacing.md, borderRadius: Radius.lg, overflow: 'hidden', marginBottom: 16 },
  photoPreview: { width: '100%', aspectRatio: 4 / 3 },
  removePhoto: { position: 'absolute', top: 8, right: 8 },

  toolbar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.md, paddingVertical: 10,
    borderTopWidth: 0.5, borderTopColor: Colors.borderWarm,
  },
  toolBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6, paddingHorizontal: 4 },
  toolBtnText: { fontFamily: Fonts.sansMedium, fontSize: 13, color: Colors.spice },
  charCount: { fontFamily: Fonts.sans, fontSize: 12, color: Colors.stone },
});
