import React, { useState, useCallback, useMemo } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Image, ActivityIndicator, KeyboardAvoidingView,
  Platform, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { useColors, type AppColors } from '../../src/context/ThemeContext';
import { Fonts, Spacing, Radius, FontSize } from '../../src/constants/theme';
import { customerPostsApi } from '../../src/api/customerPosts';
import { uploadApi } from '../../src/api/upload';

const MAX_PHOTOS = 4;
const MAX_BODY = 500;

export default function CreateFoodPostScreen() {
  const router = useRouter();
  const C = useColors();
  const styles = useMemo(() => makeStyles(C), [C]);

  const [body, setBody] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const pickPhotos = useCallback(async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission needed', 'Please allow photo access to share food photos.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
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
        formData.append('file', {
          uri: asset.uri,
          type: asset.mimeType ?? 'image/jpeg',
          name: `food-post-${Date.now()}.jpg`,
        } as any);
        const res = await uploadApi.upload(formData);
        if (res.url) uploaded.push(res.url);
      }
      setPhotos(prev => [...prev, ...uploaded].slice(0, MAX_PHOTOS));
    } catch {
      Alert.alert('Upload failed', 'Could not upload photos. Please try again.');
    } finally {
      setUploading(false);
    }
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
      });
      router.back();
    } catch {
      Alert.alert('Post failed', 'Could not share your post. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }, [body, photos, canSubmit, submitting, router]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
            <Ionicons name="close" size={24} color={C.ink} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Share a Food Moment</Text>
          <TouchableOpacity
            onPress={handleSubmit}
            disabled={!canSubmit || submitting || uploading}
            style={[styles.postBtn, (!canSubmit || submitting || uploading) && styles.postBtnDisabled]}
          >
            {submitting ? (
              <ActivityIndicator size="small" color={C.white} />
            ) : (
              <Text style={styles.postBtnText}>Post</Text>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.body}
          keyboardShouldPersistTaps="handled"
        >
          {/* Caption */}
          <TextInput
            style={styles.input}
            placeholder="What did you eat? How was it? Tag a cook..."
            placeholderTextColor={C.caps}
            multiline
            value={body}
            onChangeText={t => setBody(t.slice(0, MAX_BODY))}
            autoFocus
          />
          <Text style={[styles.charCount, body.length > MAX_BODY * 0.9 && styles.charCountWarn]}>
            {body.length}/{MAX_BODY}
          </Text>

          {/* Photo Grid */}
          {photos.length > 0 && (
            <View style={styles.photoGrid}>
              {photos.map((uri, i) => (
                <View key={uri} style={styles.photoWrap}>
                  <Image source={{ uri }} style={styles.photo} resizeMode="cover" />
                  <TouchableOpacity
                    style={styles.removePhoto}
                    onPress={() => removePhoto(i)}
                    hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
                  >
                    <Ionicons name="close-circle" size={22} color={C.white} />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}

          {/* Add Photo Button */}
          {photos.length < MAX_PHOTOS && (
            <TouchableOpacity
              style={[styles.addPhotoBtn, uploading && styles.addPhotoBtnDisabled]}
              onPress={pickPhotos}
              disabled={uploading}
            >
              {uploading ? (
                <ActivityIndicator size="small" color={C.spice} />
              ) : (
                <>
                  <Ionicons name="camera-outline" size={22} color={C.spice} />
                  <Text style={styles.addPhotoText}>
                    {photos.length === 0 ? 'Add Photos' : `Add More (${MAX_PHOTOS - photos.length} left)`}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          )}

          {/* Tips */}
          <View style={styles.tips}>
            <Text style={styles.tipsHeader}>Food post tips</Text>
            <View style={styles.tip}>
              <Ionicons name="camera" size={14} color={C.spice} />
              <Text style={styles.tipText}>Share photos of meals you ordered or made</Text>
            </View>
            <View style={styles.tip}>
              <Ionicons name="star" size={14} color={C.spice} />
              <Text style={styles.tipText}>Tag the cook who made it so they can repost</Text>
            </View>
            <View style={styles.tip}>
              <Ionicons name="heart" size={14} color={C.spice} />
              <Text style={styles.tipText}>Other food lovers will see and like your post</Text>
            </View>
          </View>
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
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: Spacing.md,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: C.borderWarm,
    },
    headerBtn: { padding: 4 },
    headerTitle: {
      fontFamily: Fonts.sans.semiBold,
      fontSize: FontSize.md,
      color: C.ink,
    },
    postBtn: {
      backgroundColor: C.spice,
      paddingHorizontal: 18,
      paddingVertical: 8,
      borderRadius: Radius.full,
      minWidth: 60,
      alignItems: 'center',
    },
    postBtnDisabled: { backgroundColor: C.borderWarm },
    postBtnText: {
      fontFamily: Fonts.sans.semiBold,
      fontSize: FontSize.sm,
      color: C.white,
    },
    body: {
      padding: Spacing.md,
      paddingBottom: 60,
    },
    input: {
      fontFamily: Fonts.sans.regular,
      fontSize: FontSize.body,
      color: C.ink,
      minHeight: 120,
      textAlignVertical: 'top',
      lineHeight: 22,
    },
    charCount: {
      fontFamily: Fonts.sans.regular,
      fontSize: FontSize.xs,
      color: C.caps,
      textAlign: 'right',
      marginTop: 4,
      marginBottom: Spacing.md,
    },
    charCountWarn: { color: C.ember },
    photoGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: Spacing.sm,
      marginBottom: Spacing.md,
    },
    photoWrap: {
      width: '47%',
      aspectRatio: 1,
      borderRadius: Radius.md,
      overflow: 'hidden',
      position: 'relative',
    },
    photo: { width: '100%', height: '100%' },
    removePhoto: {
      position: 'absolute',
      top: 4,
      right: 4,
      backgroundColor: 'rgba(0,0,0,0.5)',
      borderRadius: 12,
    },
    addPhotoBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      borderWidth: 1.5,
      borderColor: C.spice,
      borderStyle: 'dashed',
      borderRadius: Radius.md,
      paddingVertical: 14,
      paddingHorizontal: Spacing.md,
      justifyContent: 'center',
      marginBottom: Spacing.lg,
    },
    addPhotoBtnDisabled: { borderColor: C.borderWarm },
    addPhotoText: {
      fontFamily: Fonts.sans.medium,
      fontSize: FontSize.md,
      color: C.spice,
    },
    tips: {
      backgroundColor: C.cream,
      borderRadius: Radius.md,
      padding: Spacing.md,
      gap: Spacing.sm,
    },
    tipsHeader: {
      fontFamily: Fonts.sans.semiBold,
      fontSize: FontSize.sm,
      color: C.body,
      marginBottom: 4,
    },
    tip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
    },
    tipText: {
      fontFamily: Fonts.sans.regular,
      fontSize: FontSize.sm,
      color: C.bodySoft,
      flex: 1,
    },
  });
}
