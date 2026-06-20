import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, ActivityIndicator, Share, Clipboard, Platform,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { captureRef } from 'react-native-view-shot';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useAuth } from '../src/context/AuthContext';
import { creatorBrandingApi, type BrandingProfile } from '../src/api/creatorBranding';
import { useFeedback } from '../src/components/feedback';
import Avatar from '../src/components/ui/Avatar';
import { Bone } from '../src/components/ui/Skeleton';
import { pickImage, uploadImage } from '../src/utils/imageUpload';
import { Fonts, Spacing, Radius, Shadow } from '../src/constants/theme';
import { useColors, useTheme, type AppColors } from '../src/context/ThemeContext';
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
  { primary: '#FF6B35', secondary: '#111827', accent: '#FFFFFF', label: 'FOODS Default' },
  { primary: '#2D6A4F', secondary: '#1B3A2A', accent: '#F5FDF8', label: 'Forest' },
  { primary: '#9C1C1C', secondary: '#1A0000', accent: '#FFF5F5', label: 'Deep Red' },
  { primary: '#1A3A6C', secondary: '#0C1F3D', accent: '#F0F5FF', label: 'Navy' },
  { primary: '#5E3A9C', secondary: '#2A1060', accent: '#F8F0FF', label: 'Purple' },
  { primary: '#8B5E3C', secondary: '#3B2010', accent: '#FFF8F0', label: 'Mocha' },
];

const BASE_URL = 'https://foodsbyme.com';

export default function CreatorBrandingScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const C = useColors();
  const { setBrandColor } = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);
  const feedback = useFeedback();

  const [profile, setProfile] = useState<BrandingProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeSection, setActiveSection] = useState<'identity' | 'branding' | 'url' | 'share'>('identity');
  const qrRef     = useRef<any>(null);
  const qrCardRef = useRef<View>(null);
  const [sharingQr, setSharingQr] = useState(false);

  // Form state
  const [selectedTypes, setSelectedTypes] = useState<CreatorType[]>(['home_cook']);
  const [bio, setBio] = useState('');
  const [coverImage, setCoverImage] = useState<string | null>(null);
  const [brandLogo, setBrandLogo] = useState<string | null>(null);
  const [customPrimary, setCustomPrimary] = useState(PRESET_COLORS[0].primary);
  const [customSecondary, setCustomSecondary] = useState(PRESET_COLORS[0].secondary);
  const [customAccent, setCustomAccent] = useState(PRESET_COLORS[0].accent);
  const [typographyTheme, setTypographyTheme] = useState('default');
  const [customFont, setCustomFont] = useState('');
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
      setBio(res.branding.bio ?? '');
      setCoverImage(res.branding.cover_image ?? null);
      setBrandLogo(res.branding.brand_logo ?? null);
      setTypographyTheme(res.branding.typography_theme ?? 'default');
      setCustomFont(res.branding.custom_font ?? '');
      setProfileSlug(res.branding.profile_slug ?? '');
      if (res.branding.brand_colors) {
        setCustomPrimary(res.branding.brand_colors.primary ?? PRESET_COLORS[0].primary);
        setCustomSecondary(res.branding.brand_colors.secondary ?? PRESET_COLORS[0].secondary);
        setCustomAccent(res.branding.brand_colors.accent ?? PRESET_COLORS[0].accent);
      }
    } catch {
      // 404 = no branding profile yet (normal). Other errors: silently ignore on initial load.
    } finally {
      setLoading(false);
    }
  }, [user?.cook_id]);

  useEffect(() => { load(); }, [load]);

  const profileUrl = profileSlug
    ? `${BASE_URL}/creator/${profileSlug}`
    : profile?.id ? `${BASE_URL}/cook/${profile.id}` : '';

  const handlePickCover = async () => {
    const uri = await pickImage();
    if (!uri) return;
    setUploadingCover(true);
    try {
      const { url } = await uploadImage(uri, 'cover');
      setCoverImage(url);
    } catch {
      feedback.error('Upload failed');
    } finally {
      setUploadingCover(false);
    }
  };

  const handlePickLogo = async () => {
    const uri = await pickImage();
    if (!uri) return;
    setUploadingLogo(true);
    try {
      const { url } = await uploadImage(uri, 'logo');
      setBrandLogo(url);
    } catch {
      feedback.error('Upload failed');
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
        bio: bio.trim() || null,
        brand_colors: { primary: customPrimary, secondary: customSecondary, accent: customAccent },
        typography_theme: typographyTheme,
        custom_font: customFont.trim() || null,
      };
      if (coverImage !== profile?.cover_image) updates.cover_image = coverImage;
      if (brandLogo !== profile?.brand_logo)   updates.brand_logo = brandLogo;
      if (profileSlug && profileSlug !== profile?.profile_slug && slugAvailable !== false) {
        updates.profile_slug = profileSlug;
      }

      const res = await creatorBrandingApi.update(updates);
      setProfile(prev => prev ? { ...prev, ...res.branding } : res.branding);
      if (customPrimary.startsWith('#')) setBrandColor(customPrimary);
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

  const handleShareQR = async () => {
    if (!qrCardRef.current) return;
    setSharingQr(true);
    try {
      const uri = await captureRef(qrCardRef, { format: 'png', quality: 1 });
      if (Platform.OS === 'ios') {
        await Share.share({ url: uri });
      } else {
        await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: 'Share your FOODSbyme QR code' });
      }
    } catch {
      feedback.error('Error', 'Could not share QR code');
    } finally {
      setSharingQr(false);
    }
  };

  const handleCopyUrl = () => {
    Clipboard.setString(profileUrl);
    feedback.success('Copied', 'Profile URL copied to clipboard');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleShareTo = async (platform: string) => {
    const encodedUrl = encodeURIComponent(profileUrl);
    const encodedMsg = encodeURIComponent(`Check out my profile on FOODSbyme: ${profileUrl}`);

    // Instagram and TikTok don't support URL sharing via deep link —
    // open the native share sheet so users can pick those apps themselves.
    if (platform === 'instagram' || platform === 'tiktok') {
      handleShare();
      return;
    }

    let url = '';
    switch (platform) {
      case 'whatsapp':
        url = `whatsapp://send?text=${encodedMsg}`;
        break;
      case 'twitter':
        url = `twitter://post?message=${encodedMsg}`;
        break;
      case 'facebook':
        // fb:// deep link is deprecated; use the web sharer which works in-app
        url = `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`;
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
        <View style={{ flex: 1, padding: Spacing.lg, gap: 14 }}>
          <Bone width="50%" height={22} radius={6} />
          <Bone width="100%" height={100} radius={14} />
          <Bone width="100%" height={48} radius={10} />
          <Bone width="100%" height={48} radius={10} />
          <Bone width="100%" height={48} radius={10} />
          <Bone width="100%" height={48} radius={10} />
          <Bone width="60%" height={44} radius={22} />
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

            {/* Bio */}
            <View style={{ gap: 8 }}>
              <Text style={styles.fieldLabel}>Bio</Text>
              <TextInput
                style={styles.bioInput}
                value={bio}
                onChangeText={setBio}
                placeholder="Tell customers about your cooking style, specialties, and story…"
                placeholderTextColor={C.stone}
                multiline
                scrollEnabled={false}
                maxLength={300}
                textAlignVertical="top"
              />
              <Text style={[styles.fieldHint, { alignSelf: 'flex-end' }]}>{bio.length}/300</Text>
            </View>
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
              <Text style={styles.sectionSub}>Select a preset or enter your own hex codes</Text>
              <View style={styles.colorGrid}>
                {PRESET_COLORS.map(p => {
                  const isActive = customPrimary === p.primary && customSecondary === p.secondary;
                  return (
                    <TouchableOpacity
                      key={p.primary}
                      style={[styles.colorSwatch, isActive && styles.colorSwatchActive]}
                      onPress={() => {
                        setCustomPrimary(p.primary);
                        setCustomSecondary(p.secondary);
                        setCustomAccent(p.accent);
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      }}
                    >
                      <View style={[styles.colorDot, { backgroundColor: p.primary }]} />
                      <Text style={styles.colorLabel}>{p.label}</Text>
                      {isActive && <Ionicons name="checkmark-circle" size={14} color={C.successFg} />}
                    </TouchableOpacity>
                  );
                })}
              </View>
              <View style={{ gap: 8, marginTop: 4 }}>
                <Text style={styles.fieldLabel}>Custom hex codes</Text>
                {[
                  { label: 'Primary', value: customPrimary, set: setCustomPrimary },
                  { label: 'Secondary', value: customSecondary, set: setCustomSecondary },
                  { label: 'Accent', value: customAccent, set: setCustomAccent },
                ].map(({ label, value, set }) => (
                  <View key={label} style={styles.hexRow}>
                    <View style={[styles.hexPreview, { backgroundColor: value.startsWith('#') ? value : '#ccc' }]} />
                    <Text style={styles.hexLabel}>{label}</Text>
                    <TextInput
                      style={styles.hexInput}
                      value={value}
                      onChangeText={set}
                      placeholder="#000000"
                      placeholderTextColor={C.stone}
                      autoCapitalize="none"
                      autoCorrect={false}
                      maxLength={7}
                    />
                  </View>
                ))}
              </View>

              {/* Live preview strip */}
              <View style={{ gap: 6, marginTop: 8 }}>
                <Text style={styles.fieldLabel}>Live preview</Text>
                <View style={{ flexDirection: 'row', borderRadius: Radius.md, overflow: 'hidden', height: 52 }}>
                  <View style={{ flex: 1, backgroundColor: customPrimary.startsWith('#') ? customPrimary : '#FF6B35', alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ fontFamily: Fonts.sansMedium, fontSize: 11, color: customAccent.startsWith('#') ? customAccent : '#fff' }}>Button</Text>
                  </View>
                  <View style={{ flex: 1, backgroundColor: customSecondary.startsWith('#') ? customSecondary : '#111827', alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ fontFamily: Fonts.sansMedium, fontSize: 11, color: customAccent.startsWith('#') ? customAccent : '#fff' }}>Header</Text>
                  </View>
                  <View style={{ flex: 1, backgroundColor: customAccent.startsWith('#') ? customAccent : '#fff', alignItems: 'center', justifyContent: 'center', borderWidth: 0.5, borderColor: C.borderWarm }}>
                    <Text style={{ fontFamily: Fonts.sans, fontSize: 11, color: customPrimary.startsWith('#') ? customPrimary : '#FF6B35' }}>Body</Text>
                  </View>
                </View>
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
              <View style={{ gap: 6, marginTop: 4 }}>
                <Text style={styles.fieldLabel}>Custom font name</Text>
                <TextInput
                  style={styles.hexInput}
                  value={customFont}
                  onChangeText={setCustomFont}
                  placeholder="e.g. Playfair Display"
                  placeholderTextColor={C.stone}
                  autoCorrect={false}
                />
                <Text style={styles.fieldHint}>Must be a Google Font name. Leave blank to use the theme default.</Text>
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
                { platform: 'tiktok',    label: 'TikTok',    icon: 'logo-tiktok',   color: '#010101' },
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

            {/* QR code — Instagram-style branded card */}
            {profileUrl ? (
              <View style={{ gap: 12 }}>
                <View style={styles.qrCardWrapper}>
                  <View style={styles.qrCard} ref={qrCardRef}>
                    {/* Avatar + name banner */}
                    <View style={styles.qrBanner}>
                      <Avatar
                        name={profile?.display_name ?? ''}
                        avatarUrl={profile?.avatar_url ?? null}
                        size={40}
                      />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.qrBannerName} numberOfLines={1}>{profile?.display_name}</Text>
                        {(profile?.username ?? profile?.profile_slug) ? (
                          <Text style={styles.qrBannerHandle}>@{profile?.username ?? profile?.profile_slug}</Text>
                        ) : null}
                      </View>
                    </View>

                    {/* QR with logo */}
                    <View style={styles.qrBody}>
                      <QRCode
                        value={profileUrl}
                        size={196}
                        color="#1A1A1A"
                        backgroundColor="#FFFFFF"
                        logo={require('../assets/images/icon.png')}
                        logoSize={46}
                        logoBackgroundColor="#FFFFFF"
                        logoMargin={5}
                        logoBorderRadius={14}
                        quietZone={6}
                        getRef={(ref) => { qrRef.current = ref; }}
                      />
                    </View>

                    {/* Footer */}
                    <View style={styles.qrFooter}>
                      <Ionicons name="scan-outline" size={13} color={C.spice} />
                      <Text style={styles.qrFooterText}>Scan to visit my kitchen on FOODSbyme</Text>
                    </View>
                  </View>
                </View>

                <TouchableOpacity
                  style={[styles.nativeShareBtn, sharingQr && { opacity: 0.6 }]}
                  onPress={handleShareQR}
                  disabled={sharingQr}
                >
                  {sharingQr
                    ? <ActivityIndicator size="small" color={C.canvas} />
                    : <><Ionicons name="share-outline" size={18} color={C.canvas} /><Text style={styles.nativeShareText}>Share QR image</Text></>
                  }
                </TouchableOpacity>
                <TouchableOpacity style={styles.copyLinkBtn} onPress={handleCopyUrl}>
                  <Ionicons name="copy-outline" size={16} color={C.spice} />
                  <Text style={styles.copyLinkText}>Copy link instead</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.qrPlaceholder}>
                <Ionicons name="qr-code-outline" size={48} color={C.bodySoft} />
                <Text style={styles.qrLabel}>QR Code</Text>
                <Text style={styles.qrSub}>Set a custom URL above to generate your QR code</Text>
              </View>
            )}
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
      width: 44, height: 44, borderRadius: 22,
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
    // Bio
    bioInput: {
      fontFamily: Fonts.sans, fontSize: 15, color: C.textInk,
      backgroundColor: C.bgCard, borderRadius: Radius.md,
      borderWidth: 0.5, borderColor: C.borderWarm,
      paddingHorizontal: 14, paddingVertical: 12,
      minHeight: 100,
    },
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
    hexRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.bgCard, borderRadius: Radius.md, borderWidth: 0.5, borderColor: C.borderWarm, paddingHorizontal: 12, paddingVertical: 10 },
    hexPreview: { width: 24, height: 24, borderRadius: 6, borderWidth: 0.5, borderColor: C.borderWarm },
    hexLabel: { fontFamily: Fonts.sans, fontSize: 13, color: C.bodySoft, width: 70 },
    hexInput: { flex: 1, fontFamily: Fonts.sansMedium, fontSize: 14, color: C.textInk, backgroundColor: C.bgCard, borderRadius: Radius.md, borderWidth: 0.5, borderColor: C.borderWarm, paddingHorizontal: 12, paddingVertical: 10 },
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
    qrCardWrapper: { alignItems: 'center' },
    qrCard: {
      backgroundColor: '#FFFFFF', borderRadius: 24, overflow: 'hidden',
      shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 16, shadowOffset: { width: 0, height: 6 },
      elevation: 8, width: 256,
    },
    qrBanner: {
      flexDirection: 'row', alignItems: 'center', gap: 10,
      backgroundColor: C.honey, paddingHorizontal: 16, paddingVertical: 14,
    },
    qrBannerName: { fontFamily: Fonts.sansMedium, fontSize: 14, color: C.ink },
    qrBannerHandle: { fontFamily: Fonts.sans, fontSize: 11, color: C.bodySoft },
    qrBody: { alignItems: 'center', padding: 16, backgroundColor: '#FFFFFF' },
    qrFooter: {
      flexDirection: 'row', alignItems: 'center', gap: 6,
      backgroundColor: C.honey, paddingHorizontal: 16, paddingVertical: 10,
      justifyContent: 'center',
    },
    qrFooterText: { fontFamily: Fonts.sans, fontSize: 11, color: C.spice },
    qrPlaceholder: {
      alignItems: 'center', gap: 8, padding: 32,
      backgroundColor: C.bgCard, borderRadius: Radius.lg,
      borderWidth: 1, borderColor: C.borderWarm,
    },
    qrLabel: { fontFamily: Fonts.sansMedium, fontSize: 15, color: C.ink },
    qrSub: { fontFamily: Fonts.sans, fontSize: 12, color: C.bodySoft, textAlign: 'center', lineHeight: 17 },
  });
}
