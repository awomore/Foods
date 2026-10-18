/**
 * CreatorShareSheet — the one place a creator link gets shared.
 *
 * Before this existed the same platform grid, QR card and copy-link button were
 * written out three times: the storefront's share modal, the Share section of
 * creator branding, and the Share quick action on the cook profile. They drifted
 * (different QR capture, different deep links, one of them had two copy buttons),
 * so they are now a single sheet that all three open.
 */

import React, { useRef, useState } from 'react';
import {
  View, Text, Modal, TouchableOpacity, StyleSheet,
  ActivityIndicator, Share, Clipboard, Platform, Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import QRCode from 'react-native-qrcode-svg';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';
import Avatar from '../ui/Avatar';
import { useFeedback } from '../feedback';
import { Fonts, Spacing, Radius } from '../../constants/theme';
import { useColors, type AppColors } from '../../context/ThemeContext';

const PLATFORMS = [
  { platform: 'whatsapp',  label: 'WhatsApp',  icon: 'logo-whatsapp',  color: '#25D366' },
  { platform: 'twitter',   label: 'X',         icon: 'logo-twitter',   color: '#000000' },
  { platform: 'facebook',  label: 'Facebook',  icon: 'logo-facebook',  color: '#1877F2' },
  { platform: 'instagram', label: 'Instagram', icon: 'logo-instagram', color: '#E1306C' },
  { platform: 'tiktok',    label: 'TikTok',    icon: 'logo-tiktok',    color: '#010101' },
] as const;

interface Props {
  visible: boolean;
  onClose: () => void;
  /** Public profile URL. The sheet renders nothing useful without it. */
  profileUrl: string;
  displayName: string;
  /** Username or profile slug, shown on the QR card without the @. */
  handle?: string | null;
  avatarUrl?: string | null;
  /** Message body for the share sheet and the deep links. */
  shareMessage: string;
}

export default function CreatorShareSheet({
  visible, onClose, profileUrl, displayName, handle, avatarUrl, shareMessage,
}: Props) {
  const C = useColors();
  const { t } = useTranslation();
  const feedback = useFeedback();
  const styles = React.useMemo(() => makeStyles(C), [C]);
  const qrCardRef = useRef<View>(null);
  const [sharingQr, setSharingQr] = useState(false);

  const nativeShare = async () => {
    await Share.share({ message: shareMessage, url: profileUrl });
  };

  const shareTo = async (platform: string) => {
    const encodedMsg = encodeURIComponent(shareMessage);
    const encodedUrl = encodeURIComponent(profileUrl);

    // Instagram and TikTok have no URL-share deep link — hand those to the OS
    // sheet so the user picks the app themselves.
    if (platform === 'instagram' || platform === 'tiktok') {
      await nativeShare();
      onClose();
      return;
    }

    let url = '';
    switch (platform) {
      case 'whatsapp': url = `whatsapp://send?text=${encodedMsg}`; break;
      case 'twitter':  url = `twitter://post?message=${encodedMsg}`; break;
      // fb:// is deprecated; the web sharer works in-app
      case 'facebook': url = `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`; break;
    }
    const canOpen = url ? await Linking.canOpenURL(url).catch(() => false) : false;
    if (canOpen) await Linking.openURL(url);
    else await nativeShare();
    onClose();
  };

  const copyLink = () => {
    Clipboard.setString(profileUrl);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    feedback.success(t('share_sheet.copied_title'), t('share_sheet.copied_body'));
    onClose();
  };

  const shareQrCard = async () => {
    if (!qrCardRef.current) return;
    setSharingQr(true);
    try {
      const uri = await captureRef(qrCardRef, { format: 'png', quality: 1 });
      if (Platform.OS === 'ios') {
        await Share.share({ url: uri });
      } else {
        await Sharing.shareAsync(uri, {
          mimeType: 'image/png',
          dialogTitle: t('share_sheet.qr_dialog_title', { name: displayName }),
        });
      }
    } catch {
      feedback.error(t('common.error'), t('share_sheet.qr_failed'));
    } finally {
      setSharingQr(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.handleBar} />
          <Text style={styles.title}>{t('share_sheet.title')}</Text>

          {!!profileUrl && (
            <View style={styles.qrCardWrapper}>
              <View style={styles.qrCard} ref={qrCardRef} collapsable={false}>
                <View style={styles.qrBanner}>
                  <Avatar name={displayName} avatarUrl={avatarUrl ?? null} size={40} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.qrBannerName} numberOfLines={1}>{displayName}</Text>
                    {handle ? <Text style={styles.qrBannerHandle}>@{handle}</Text> : null}
                  </View>
                </View>
                <View style={styles.qrBody}>
                  <QRCode
                    value={profileUrl}
                    size={172}
                    color="#1A1A1A"
                    backgroundColor="#FFFFFF"
                    logo={require('../../../assets/images/icon.png')}
                    logoSize={42}
                    logoBackgroundColor="#FFFFFF"
                    logoMargin={5}
                    logoBorderRadius={14}
                    quietZone={6}
                  />
                </View>
                <View style={styles.qrFooter}>
                  <Ionicons name="scan-outline" size={13} color={C.spice} />
                  <Text style={styles.qrFooterText}>{t('share_sheet.qr_footer')}</Text>
                </View>
              </View>
            </View>
          )}

          <View style={styles.grid}>
            {PLATFORMS.map(p => (
              <TouchableOpacity key={p.platform} style={styles.platformBtn} onPress={() => shareTo(p.platform)}>
                <View style={[styles.platformIcon, { backgroundColor: p.color }]}>
                  <Ionicons name={p.icon as any} size={22} color="#fff" />
                </View>
                <Text style={styles.platformLabel}>{p.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {!!profileUrl && (
            <TouchableOpacity
              style={[styles.qrBtn, sharingQr && { opacity: 0.6 }]}
              onPress={shareQrCard}
              disabled={sharingQr}
            >
              {sharingQr
                ? <ActivityIndicator size="small" color={C.ink} />
                : <><Ionicons name="qr-code-outline" size={18} color={C.ink} /><Text style={styles.qrBtnText}>{t('share_sheet.share_qr')}</Text></>}
            </TouchableOpacity>
          )}

          <TouchableOpacity style={styles.copyBtn} onPress={copyLink}>
            <Ionicons name="copy-outline" size={18} color={C.spice} />
            <Text style={styles.copyBtnText}>{t('share_sheet.copy_link')}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
            <Text style={styles.cancelText}>{t('common.cancel')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

function makeStyles(C: AppColors) {
  return StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    sheet: {
      backgroundColor: C.bg,
      borderTopLeftRadius: 24, borderTopRightRadius: 24,
      padding: Spacing.lg, paddingBottom: 32, gap: 14,
    },
    handleBar: { width: 38, height: 4, borderRadius: 2, backgroundColor: C.borderWarm, alignSelf: 'center' },
    title: { fontFamily: Fonts.sansMedium, fontSize: 16, color: C.textInk, textAlign: 'center' },

    qrCardWrapper: { alignItems: 'center' },
    qrCard: {
      backgroundColor: '#FFFFFF', borderRadius: Radius.lg,
      padding: 14, gap: 10, width: 232,
      borderWidth: 0.5, borderColor: C.borderWarm,
    },
    qrBanner: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    qrBannerName: { fontFamily: Fonts.sansMedium, fontSize: 14, color: '#1A1A1A' },
    qrBannerHandle: { fontFamily: Fonts.sans, fontSize: 11, color: '#6B7280' },
    qrBody: { alignItems: 'center' },
    qrFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 },
    qrFooterText: { fontFamily: Fonts.sans, fontSize: 11, color: '#6B7280' },

    grid: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 4 },
    platformBtn: { alignItems: 'center', gap: 6, width: 60 },
    platformIcon: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
    platformLabel: { fontFamily: Fonts.sans, fontSize: 11, color: C.body },

    qrBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
      paddingVertical: 13, borderRadius: Radius.full,
      borderWidth: 1, borderColor: C.borderWarm, backgroundColor: C.bgCard,
    },
    qrBtnText: { fontFamily: Fonts.sansMedium, fontSize: 14, color: C.ink },
    copyBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
      paddingVertical: 13, borderRadius: Radius.full,
      borderWidth: 1, borderColor: C.spice,
    },
    copyBtnText: { fontFamily: Fonts.sansMedium, fontSize: 14, color: C.spice },
    cancelBtn: { alignItems: 'center', paddingVertical: 10 },
    cancelText: { fontFamily: Fonts.sans, fontSize: 14, color: C.bodySoft },
  });
}
