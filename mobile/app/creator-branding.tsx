import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, ActivityIndicator, Share, Alert, Clipboard,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useAuth } from '../src/context/AuthContext';
import { creatorBrandingApi, type BrandingProfile } from '../src/api/creatorBranding';
import { useFeedback } from '../src/components/feedback';
import Avatar from '../src/components/ui/Avatar';
import { pickImage, uploadImage } from '../src/utils/imageUpload';
import { Fonts, Spacing, Radius, Shadow } from '../src/constants/theme';
import { useColors, type AppColors } from '../src/context/ThemeContext';
import {
  type CreatorType, CREATOR_TYPE_LABELS, CREATOR_TYPE_ICONS,
} from '../src/types';

const CREATOR_TYPES: CreatorType[] = [
  'home_cook','chef','pastry_chef','baker',
  'mixologist','caterer','culinary_instructor','food_brand',
];

const TYPOGRAPHY_THEMES = [
  { key: 'default', label: 'Classic',  desc: 'DM Serif · DM Sans' },
  { key: 'modern',  label: 'Modern',   desc: 'Bold headers, clean body' },
  { key: 'classic', label: 'Heritage', desc: 'Serif throughout' },
  { key: 'bold',    label: 'Bold',     desc: 'Strong contrast' },
];

const PRESET_COLORS = [
  { primary: '#C97A35', secondary: '#1A1009', accent: '#FAF6F0', label: 'FOODS Default' },
  { primary: '#2D6A4F', secondary: '#1B3A2A', accent: '#F5FDF8', label: 'Forest' },
  { primary: '#9C1C1C', secondary: '#1A0000', accent: '#FFF5F5', label: 'Deep Red' },
  { primary: '#1A3A6C', secondary: '#0C1F3D', accent: '#F0F5FF', label: 'Navy' },
  { primary: '#5E3A9C', secondary: '#2A1060', accent: '#F8F0FF', label: 'Purple' },
  { primary: '#8B5E3C', secondary: '#3B2010', accent: '#FFF8F0', label: 'Mocha' },
];

const BASE_URL = 'https://foodsbyme-production.up.railway.app';

export default function CreatorBrandingScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const C = useColors();
  const styles = useMemo(() => makeStyles(C), [C]);
  const feedback = useFeedback();

  const [profile, setProfile] = useState<BrandingProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeSection, setActiveSection] = useState<'identity' | 'branding' | 'url' | 'share'>('identity');

  // Form state
  const [selectedTypes, setSelectedTypes] = useState<CreatorType[]>(['home_cook']);
  const [coverImage, setCoverImage] = useState<string | null>(null);
  const [brandLogo, setBrandLogo] = useState<string | null>(null);
  const [selectedColors, setSelectedColors] = useState(PRESET_COLORS[0]);
  const [typographyTheme, setTypographyTheme] = useState('default');
  const [profileSlug, setProfileSlug] = useState('');
  const [slugAvailable, setSlugAvailable] = useState<boolean | null>(null);
  const [checkingSlug, setCheckingSlug] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  const load = useCallback(async () => {
    if (!user?.cook_id) return;
    try {
      const res = await creatorBrandingApi.get(user.cook_id);
      setProfile(res.branding);
      setSelectedTypes(res.branding.creator_types ?? ['home_cook']);
      setCoverImage(res.branding.cover_image ?? null);
      setBrandLogo(res.branding.brand_logo ?? null);
      setTypographyTheme(res.branding.typography_theme ?? 'default');
      setProfileSlug(res.branding.profile_slug ?? '');
      if (res.branding.brand_colors) {
        const match = PRESET_COLORS.find(p => p.primary === res.branding.brand_colors?.primary);
        if (match) setSelectedColors(match);
      }
    } catch {
      feedback.toast({ type: 'error', message: 'Failed to load branding' });
    } finally {
      setLoading(false);
    }
  }, [user?.cook_id]);

  useEffect(() => { load(); }, [load]);

  const profileUrl = profileSlug
    ? `${BASE_URL}/creator/${profileSlug}`
    : profile?.id ? `${BASE_URL}/cook/${profile.id}` : '';

  const handlePickCover = async () => {
    const uri = await pickImage({ aspect: [16, 9], quality: 0.85 });
    if (!uri) return;
    setUploadingCover(true);
    try {
      const url = await uploadImage(uri, 'cover');
      setCoverImage(url);
    } catch {
      feedback.toast({ type: 'error', message: 'Upload failed' });
    } finally {
      setUploadingCover(false);
    }
  };

  const handlePickLogo = async () => {
    const uri = await pickImage({ aspect: [1, 1], quality: 0.85 });
    if (!uri) return;
    setUploadingLogo(true);
    try {
      const url = await uploadImage(uri, 'logo');
      setBrandLogo(url);
    } catch {
      feedback.toast({ type: 'error', message: 'Upload failed' });
    } finally {
      setUploadingLogo(false);
    }
  };

  let slugTimer: ReturnType<typeof setTimeout> | null = null;
  const checkSlug = (val: string) => {
    setProfileSlug(val);
    setSlugAvailable(null);
    if (slugTimer) clearTimeout(slugTimer);
    if (val.length < 3) return;
    slugTimer = setTimeout(async () => {
      setCheckingSlug(true);
      try {
        const res = await creatorBrandingApi.checkSlug(val);
        setSlugAvailable(res.available);
      } catch {
        setSlugAvailable(null);
      } finally {
        setCheckingSlug(false);
      }
    }, 600);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const updates: any = {
        creator_types: selectedTypes,
        brand_colors: { primary: selectedColors.primary, secondary: selectedColors.secondary, accent: selectedColors.accent },
        typography_theme: typographyTheme,
      };
      if (coverImage !== profile?.cover_image) updates.cover_image = coverImage;
      if (brandLogo !== profile?.brand_logo)   updates.brand_logo = brandLogo;
      if (profileSlug && slugAvailable !== false) updates.profile_slug = profileSlug;

      const res = await creatorBrandingApi.update(updates);
      setProfile(prev => prev ? { ...prev, ...res.branding } : res.branding);
      feedback.success('Saved', 'Your branding has been updated');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: any) {
      feedback.error('Error', e.error ?? 'Could not save branding');
    } finally {
      setSaving(false);
    }
  };

  const handleShare = async () => {
    await Share.share({
      message: `Check out my profile on FOODSbyme: ${profileUrl}`,
      url: profileUrl,
    });
  };

  const handleCopyUrl = () => {
    Clipboard.setString(profileUrl);
    feedback.success('Copied', 'Profile URL copied to clipboard');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleShareTo = async (platform: string) => {
    let url = '';
    const encodedUrl = encodeURIComponent(profileUrl);
    const encodedMsg = encodeURIComponent(`Check out my profile on FOODSbyme: ${profileUrl}`);
    switch (platform) {
      case 'whatsapp':
        url = `whatsapp://send?text=${encodedMsg}`;
        break;
      case 'twitter':
        url = `twitter://post?message=${encodedMsg}`;
        break;
      case 'facebook':
        url = `fb://share?href=${encodedUrl}`;
        break;
      case 'instagram':
        url = `instagram://library?AssetPath=${encodedUrl}`;
        break;
    }
    if (url) {
      const { Linking } = require('react-native');
      const canOpen = await Linking.canOpenURL(url).catch(() => false);
      if (canOpen) {
        await Linking.openURL(url);
      } else {
        handleShare();
      }
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingCenter}>
          <ActivityIndicator color={C.spice} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
          <Ionicons name="arrow-back" size={22} color={C.ink} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Creator Profile</Text>
        <TouchableOpacity onPress={handleSave} style={[styles.saveBtn, saving && { opacity: 0.6 }]} disabled={saving}>
          {saving ? <ActivityIndicator size="small" color={C.canvas} /> : <Text style={styles.saveBtnText}>Save</Text>}
        </TouchableOpacity>
      </View>

      {/* Section tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.sectionTabs} contentContainerStyle={{ paddingHorizontal: Spacing.lg, gap: 6, paddingVertical: 8 }}>
        {[
          { key: 'identity', label: 'Identity', icon: 'person-outline' },
          { key: 'branding', label: 'Branding', icon: 'color-palette-outline' },
          { key: 'url',      label: 'Profile URL', icon: 'link-outline' },
          { key: 'share',    label: 'Share', icon: 'share-outline' },
        ].map(s => (
          <TouchableOpacity
            key={s.key}
            style={[styles.sectionTab, activeSection === s.key && styles.sectionTabActive]}
            onPress={() => setActiveSection(s.key as any)}
          >
            <Ionicons name={s.icon as any} size={14} color={activeSection === s.key ? C.canvas : C.bodySoft} />
            <Text style={[styles.sectionTabText, activeSection === s.key && styles.sectionTabTextActive]}>{s.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: Spacing.lg, paddingBottom: 100 }}>

        {/* ── IDENTITY ─────────────────────────────────────────── */}
        {activeSection === 'identity' && (
          <View style={{ gap: 20 }}>
            <View>
              <Text style={styles.sectionTitle}>Creator Types</Text>
              <Text style={styles.sectionSub}>Select all that apply. These shape your storefront tabs and discovery filters.</Text>
            </View>

            <View style={styles.typeGrid}>
              {CREATOR_TYPES.map(t => {
                const active = selectedTypes.includes(t);
                return (
                  <TouchableOpacity
                    key={t}
                    style={[styles.typeCard, active && styles.typeCardActive]}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setSelectedTypes(prev =>
                        prev.includes(t)
                          ? prev.length > 1 ? prev.filter(x => x !== t) : prev
                          : [...prev, t]
                      );
                    }}
                  >
                    <Ionicons name={CREATOR_TYPE_ICONS[t] as any} size={20} color={active ? C.canvas : C.spice} />
                    <Text style={[styles.typeLabel, active && styles.typeLabelActive]}>{CREATOR_TYPE_LABELS[t]}</Text>
                    {active && <Ionicons name="checkmark-circle" size={14} color={C.canvas} style={{ position: 'absolute', top: 8, right: 8 }} />}
                  </TouchableOpacity>
                );
              })}
            </View>

            {selectedTypes.length > 0 && (
              <View style={styles.infoPill}>
                <Ionicons name="information-circle-outline" size={16} color={C.spice} />
                <Text style={styles.infoPillText}>
                  Your storefront will show tabs relevant to: {selectedTypes.map(t => CREATOR_TYPE_LABELS[t]).join(', ')}
                </Text>
              </View>
            )}
          </View>
        )}

        {/* ── BRANDING ─────────────────────────────────────────── */}
        {activeSection === 'branding' && (
          <View style={{ gap: 24 }}>
            {/* Cover image */}
            <View style={{ gap: 10 }}>
              <Text style={styles.sectionTitle}>Cover Image</Text>
              <Text style={styles.sectionSub}>Shown at the top of your storefront and shared links. Recommended: 1200×630</Text>
              <TouchableOpacity style={styles.coverPicker} onPress={handlePickCover} disabled={uploadingCover}>
                {uploadingCover ? (
                  <ActivityIndicator color={C.spice} />
                ) : coverImage ? (
                  <>
                    <View style={styles.coverPreviewBg} />
                    <Ionicons name="image-outline" size={28} color={C.spice} />
                    <Text style={styles.coverPickerText}>Tap to change cover</Text>
                  </>
                ) : (
                  <>
                    <Ionicons name="image-outline" size={32} color={C.bodySoft} />
                    <Text style={styles.coverPickerText}>Add cover image</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>

            {/* Brand logo */}
            <View style={{ gap: 10 }}>
              <Text style={styles.sectionTitle}>Brand Logo</Text>
              <Text style={styles.sectionSub}>Square logo shown on your storefront alongside FOODS branding</Text>
              <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
                <TouchableOpacity style={styles.logoPicker} onPress={handlePickLogo} disabled={uploadingLogo}>
                  {uploadingLogo ? (
                    <ActivityIndicator color={C.spice} />
                  ) : brandLogo ? (
                    <Ionicons name="checkmark-circle" size={24} color={C.successFg} />
                  ) : (
                    <Ionicons name="storefront-outline" size={28} color={C.bodySoft} />
                  )}
                </TouchableOpacity>
                <View style={{ flex: 1 }}>
                  <Text style={styles.logoPickerLabel}>{brandLogo ? 'Logo uploaded ✓' : 'No logo yet'}</Text>
                  <Text style={styles.logoPickerSub}>Tap to {brandLogo ? 'change' : 'upload'}</Text>
                </View>
              </View>
              <View style={styles.warningBanner}>
                <Ionicons name="shield-checkmark-outline" size={14} color={C.warnFg} />
                <Text style={styles.warningText}>FOODSbyme branding always remains visible. Full white-labeling is not allowed.</Text>
              </View>
            </View>

            {/* Brand colors */}
            <View style={{ gap: 10 }}>
              <Text style={styles.sectionTitle}>Brand Colours</Text>
              <Text style={styles.sectionSub}>Accent colour used on your storefront, stories, and shared links</Text>
              <View style={styles.colorGrid}>
                {PRESET_COLORS.map(p => (
                  <TouchableOpacity
                    key={p.primary}
                    style={[styles.colorSwatch, selectedColors.primary === p.primary && styles.colorSwatchActive]}
                    onPress={() => { setSelectedColors(p); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
                  >
                    <View style={[styles.colorDot, { backgroundColor: p.primary }]} />
                    <Text style={styles.colorLabel}>{p.label}</Text>
                    {selectedColors.primary === p.primary && (
                      <Ionicons name="checkmark-circle" size={14} color={C.successFg} />
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Typography */}
            <View style={{ gap: 10 }}>
              <Text style={styles.sectionTitle}>Typography Theme</Text>
              <View style={{ gap: 8 }}>
                {TYPOGRAPHY_THEMES.map(t => (
                  <TouchableOpacity
                    key={t.key}
                    style={[styles.themeRow, typographyTheme === t.key && styles.themeRowActive]}
                    onPress={() => setTypographyTheme(t.key)}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.themeLabel, typographyTheme === t.key && styles.themeLabelActive]}>{t.label}</Text>
                      <Text style={styles.themeDesc}>{t.desc}</Text>
                    </View>
                    {typographyTheme === t.key && <Ionicons name="checkmark-circle" size={18} color={C.spice} />}
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>
        )}

        {/* ── PROFILE URL ──────────────────────────────────────── */}
        {activeSection === 'url' && (
          <View style={{ gap: 20 }}>
            <View>
              <Text style={styles.sectionTitle}>Your Profile URL</Text>
              <Text style={styles.sectionSub}>Claim a custom URL that links directly to your storefront. Once set, it becomes your permanent public identity on FOODS.</Text>
            </View>

            <View style={{ gap: 8 }}>
              <Text style={styles.fieldLabel}>Custom slug</Text>
              <View style={styles.slugRow}>
                <Text style={styles.slugPrefix}>foodsbyme.com/creator/</Text>
                <TextInput
                  style={styles.slugInput}
                  value={profileSlug}
                  onChangeText={checkSlug}
                  placeholder="your-name"
                  placeholderTextColor={C.stone}
                  autoCapitalize="none"
                  autoCorrect={false}
                  maxLength={50}
                />
                {checkingSlug && <ActivityIndicator size="small" color={C.spice} style={{ marginRight: 8 }} />}
                {!checkingSlug && slugAvailable === true && (
                  <Ionicons name="checkmark-circle" size={20} color={C.successFg} style={{ marginRight: 8 }} />
                )}
                {!checkingSlug && slugAvailable === false && (
                  <Ionicons name="close-circle" size={20} color={C.errorFg} style={{ marginRight: 8 }} />
                )}
              </View>
              <Text style={styles.fieldHint}>3–50 characters: lowercase letters, numbers, hyphens only</Text>
              {slugAvailable === false && (
                <View style={styles.errorPill}>
                  <Ionicons name="alert-circle-outline" size={14} color={C.errorFg} />
                  <Text style={styles.errorPillText}>This URL is already taken. Try another.</Text>
                </View>
              )}
            </View>

            {profileUrl ? (
              <View style={styles.currentUrlCard}>
                <Text style={styles.currentUrlLabel}>Current URL</Text>
                <Text style={styles.currentUrlValue} numberOfLines={2}>{profileUrl}</Text>
                <TouchableOpacity style={styles.copyBtn} onPress={handleCopyUrl}>
                  <Ionicons name="copy-outline" size={16} color={C.spice} />
                  <Text style={styles.copyBtnText}>Copy</Text>
                </TouchableOpacity>
              </View>
            ) : null}
          </View>
        )}

        {/* ── SHARE ────────────────────────────────────────────── */}
        {activeSection === 'share' && (
          <View style={{ gap: 20 }}>
            <View>
              <Text style={styles.sectionTitle}>Share Your Profile</Text>
              <Text style={styles.sectionSub}>Send your storefront link to existing customers and followers</Text>
            </View>

            {profileUrl ? (
              <View style={styles.currentUrlCard}>
                <Text style={styles.currentUrlValue} numberOfLines={2}>{profileUrl}</Text>
              </View>
            ) : (
              <View style={styles.infoPill}>
                <Ionicons name="information-circle-outline" size={16} color={C.spice} />
                <Text style={styles.infoPillText}>Set a custom URL first to get a cleaner shareable link.</Text>
              </View>
            )}

            <View style={styles.shareGrid}>
              {[
                { platform: 'whatsapp',  label: 'WhatsApp',  icon: 'logo-whatsapp', color: '#25D366' },
                { platform: 'twitter',   label: 'X',         icon: 'logo-twitter',  color: '#000000' },
                { platform: 'facebook',  label: 'Facebook',  icon: 'logo-facebook', color: '#1877F2' },
                { platform: 'instagram', label: 'Instagram', icon: 'logo-instagram', color: '#E1306C' },
              ].map(s => (
                <TouchableOpacity
                  key={s.platform}
                  style={styles.shareBtn}
                  onPress={() => handleShareTo(s.platform)}
                >
                  <View style={[styles.shareIconWrap, { backgroundColor: s.color }]}>
                    <Ionicons name={s.icon as any} size={22} color="#fff" />
                  </View>
                  <Text style={styles.shareBtnLabel}>{s.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity style={styles.copyLinkBtn} onPress={handleCopyUrl}>
              <Ionicons name="copy-outline" size={18} color={C.spice} />
              <Text style={styles.copyLinkText}>Copy profile link</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.nativeShareBtn} onPress={handleShare}>
              <Ionicons name="share-outline" size={18} color={C.canvas} />
              <Text style={styles.nativeShareText}>Share via…</Text>
            </TouchableOpacity>

            {/* QR code placeholder — integrate react-native-qrcode-svg when available */}
            <View style={styles.qrPlaceholder}>
              <Ionicons name="qr-code-outline" size={48} color={C.bodySoft} />
              <Text style={styles.qrLabel}>QR code</Text>
              <Text style={styles.qrSub}>Install react-native-qrcode-svg to enable QR sharing</Text>
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function makeStyles(C: AppColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: C.bg },
    loadingCenter: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    header: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm,
      borderBottomWidth: 0.5, borderBottomColor: C.borderWarm,
    },
    headerBtn: {
      width: 38, height: 38, borderRadius: 19,
      backgroundColor: C.bgCard, alignItems: 'center', justifyContent: 'center',
    },
    headerTitle: { fontFamily: Fonts.serif, fontSize: 18, color: C.ink },
    saveBtn: {
      backgroundColor: C.spice, borderRadius: Radius.full,
      paddingHorizontal: 18, paddingVertical: 9,
    },
    saveBtnText: { fontFamily: Fonts.sansMedium, fontSize: 14, color: C.canvas },
    sectionTabs: { borderBottomWidth: 0.5, borderBottomColor: C.borderWarm },
    sectionTab: {
      flexDirection: 'row', alignItems: 'center', gap: 6,
      paddingHorizontal: 14, paddingVertical: 8,
      borderRadius: Radius.full,
    },
    sectionTabActive: { backgroundColor: C.ink },
    sectionTabText: { fontFamily: Fonts.sansMedium, fontSize: 12, color: C.bodySoft },
    sectionTabTextActive: { color: C.canvas },
    sectionTitle: { fontFamily: Fonts.sansMedium, fontSize: 16, color: C.ink },
    sectionSub: { fontFamily: Fonts.sans, fontSize: 13, color: C.bodySoft, lineHeight: 19, marginTop: 2 },
    fieldLabel: { fontFamily: Fonts.sansMedium, fontSize: 13, color: C.textInk },
    fieldHint: { fontFamily: Fonts.sans, fontSize: 11, color: C.bodySoft },
    // Types
    typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    typeCard: {
      width: '47%', flexDirection: 'row', alignItems: 'center', gap: 10,
      backgroundColor: C.bgCard, borderRadius: Radius.md,
      borderWidth: 1, borderColor: C.borderWarm,
      padding: 12, position: 'relative',
    },
    typeCardActive: { backgroundColor: C.ink, borderColor: C.ink },
    typeLabel: { fontFamily: Fonts.sansMedium, fontSize: 12, color: C.ink, flex: 1 },
    typeLabelActive: { color: C.canvas },
    infoPill: {
      flexDirection: 'row', alignItems: 'flex-start', gap: 8,
      backgroundColor: C.honey, borderRadius: Radius.md, padding: 12,
    },
    infoPillText: { fontFamily: Fonts.sans, fontSize: 12, color: C.body, flex: 1, lineHeight: 18 },
    // Cover
    coverPicker: {
      height: 140, backgroundColor: C.bgCard,
      borderRadius: Radius.lg, borderWidth: 1.5, borderColor: C.borderWarm,
      borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', gap: 8,
    },
    coverPreviewBg: { ...StyleSheet.absoluteFillObject, backgroundColor: C.honey, borderRadius: Radius.lg },
    coverPickerText: { fontFamily: Fonts.sansMedium, fontSize: 13, color: C.spice },
    logoPicker: {
      width: 80, height: 80, borderRadius: Radius.lg,
      backgroundColor: C.bgCard, borderWidth: 1, borderColor: C.borderWarm,
      alignItems: 'center', justifyContent: 'center',
    },
    logoPickerLabel: { fontFamily: Fonts.sansMedium, fontSize: 14, color: C.ink },
    logoPickerSub: { fontFamily: Fonts.sans, fontSize: 12, color: C.bodySoft, marginTop: 2 },
    warningBanner: {
      flexDirection: 'row', alignItems: 'flex-start', gap: 8,
      backgroundColor: C.warnBg, borderRadius: Radius.md, padding: 12,
    },
    warningText: { fontFamily: Fonts.sans, fontSize: 12, color: C.warnFg, flex: 1, lineHeight: 17 },
    // Colors
    colorGrid: { gap: 8 },
    colorSwatch: {
      flexDirection: 'row', alignItems: 'center', gap: 10,
      backgroundColor: C.bgCard, borderRadius: Radius.md,
      borderWidth: 1, borderColor: C.borderWarm,
      padding: 12,
    },
    colorSwatchActive: { borderColor: C.spice },
    colorDot: { width: 28, height: 28, borderRadius: 14 },
    colorLabel: { fontFamily: Fonts.sansMedium, fontSize: 13, color: C.ink, flex: 1 },
    // Typography
    themeRow: {
      flexDirection: 'row', alignItems: 'center', gap: 12,
      backgroundColor: C.bgCard, borderRadius: Radius.md,
      borderWidth: 1, borderColor: C.borderWarm, padding: 14,
    },
    themeRowActive: { borderColor: C.spice },
    themeLabel: { fontFamily: Fonts.sansMedium, fontSize: 14, color: C.ink },
    themeLabelActive: { color: C.spice },
    themeDesc: { fontFamily: Fonts.sans, fontSize: 12, color: C.bodySoft, marginTop: 2 },
    // Slug
    slugRow: {
      flexDirection: 'row', alignItems: 'center',
      backgroundColor: C.bgCard, borderRadius: Radius.md,
      borderWidth: 0.5, borderColor: C.borderWarm,
      overflow: 'hidden',
    },
    slugPrefix: {
      fontFamily: Fonts.sans, fontSize: 13, color: C.bodySoft,
      paddingHorizontal: 12, paddingVertical: 12,
      backgroundColor: C.bgCook, borderRightWidth: 0.5, borderRightColor: C.borderWarm,
    },
    slugInput: {
      flex: 1, fontFamily: Fonts.sansMedium, fontSize: 14, color: C.ink,
      paddingHorizontal: 12, paddingVertical: 12,
    },
    currentUrlCard: {
      backgroundColor: C.bgCard, borderRadius: Radius.lg,
      borderWidth: 0.5, borderColor: C.borderWarm,
      padding: Spacing.md, gap: 10,
    },
    currentUrlLabel: { fontFamily: Fonts.sans, fontSize: 11, color: C.caps, textTransform: 'uppercase', letterSpacing: 0.8 },
    currentUrlValue: { fontFamily: Fonts.sansMedium, fontSize: 14, color: C.spice },
    copyBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start' },
    copyBtnText: { fontFamily: Fonts.sansMedium, fontSize: 13, color: C.spice },
    errorPill: {
      flexDirection: 'row', alignItems: 'center', gap: 6,
      backgroundColor: C.errorBg, borderRadius: Radius.md, padding: 10,
    },
    errorPillText: { fontFamily: Fonts.sans, fontSize: 12, color: C.errorFg, flex: 1 },
    // Share
    shareGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
    shareBtn: { width: '22%', alignItems: 'center', gap: 6 },
    shareIconWrap: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
    shareBtnLabel: { fontFamily: Fonts.sans, fontSize: 11, color: C.body },
    copyLinkBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
      borderWidth: 1.5, borderColor: C.spice, borderRadius: Radius.full,
      paddingVertical: 14,
    },
    copyLinkText: { fontFamily: Fonts.sansMedium, fontSize: 15, color: C.spice },
    nativeShareBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
      backgroundColor: C.ink, borderRadius: Radius.full, paddingVertical: 14,
    },
    nativeShareText: { fontFamily: Fonts.sansMedium, fontSize: 15, color: C.canvas },
    qrPlaceholder: {
      alignItems: 'center', gap: 8, padding: 32,
      backgroundColor: C.bgCard, borderRadius: Radius.lg,
      borderWidth: 1, borderColor: C.borderWarm,
    },
    qrLabel: { fontFamily: Fonts.sansMedium, fontSize: 15, color: C.ink },
    qrSub: { fontFamily: Fonts.sans, fontSize: 12, color: C.bodySoft, textAlign: 'center', lineHeight: 17 },
  });
}
