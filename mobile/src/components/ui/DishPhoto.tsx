/**
 * DishPhoto — cinematic food photography container.
 *
 * Renders real Cloudinary imagery with:
 *  • Shimmer → progressive reveal via expo-image
 *  • Warm tinted fallback with italic label (no broken-image feel)
 *  • Cinematic gradient overlays (editorial depth)
 *  • SOLD OUT, LOW STOCK, LIVE, SURPRISE DROP, GOLD ACCESS badge overlays
 *
 * Photography IS the product. This component should never feel broken.
 */

import React, { memo } from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { Fonts, Radius } from '../../constants/theme';
import { useColors } from '../../context/ThemeContext';
import AppImage from '../media/AppImage';
import { dishPhoto } from '../../utils/cloudinary';

export interface DishPhotoProps {
  /** Cloudinary (or any HTTPS) image URL. Absent → warm tinted placeholder. */
  uri?: string | null;
  /** Fallback background tint when no image is available. */
  tint?: string;
  /** Italic label rendered over the fallback tint. Typically the dish title. */
  label?: string;
  height?: number;
  width?: number | string;
  radius?: number;
  /** Use instead of height for fluid layouts. */
  aspectRatio?: number;
  /** Blurhash placeholder for instant low-fi preview while the image loads. */
  blurhash?: string;
  /** Show a "Sold out" dim overlay. */
  isSoldOut?: boolean;
  /**
   * Number of slots remaining. Shows a "X left" badge when ≤ 3.
   * Ignored when isSoldOut is true.
   */
  slotsLeft?: number;
  /** Show a "Cooking now" live badge. */
  isLive?: boolean;
  /** Show a "Surprise Drop" badge. */
  isSurpriseDrop?: boolean;
  /** Show a "Gold Early Access" badge. */
  isGoldAccess?: boolean;
  style?: ViewStyle;
  accessibilityLabel?: string;
  /** Stable key passed to expo-image to prevent stale frames in FlatList. */
  recyclingKey?: string;
}

function DishPhoto({
  uri,
  tint,
  label,
  height = 200,
  width,
  radius = 14,
  aspectRatio,
  blurhash,
  isSoldOut = false,
  slotsLeft,
  isLive = false,
  isSurpriseDrop = false,
  isGoldAccess = false,
  style,
  accessibilityLabel,
  recyclingKey,
}: DishPhotoProps) {
  const C = useColors();

  // Optimise for display width. 800px covers most card widths at 2× density.
  const optimisedUri = dishPhoto(uri, 800);
  const showLowStock = !isSoldOut && slotsLeft !== undefined && slotsLeft > 0 && slotsLeft <= 3;
  const showTopBadges = isLive || isSurpriseDrop || isGoldAccess;

  const containerStyle: ViewStyle = {
    borderRadius: radius,
    overflow: 'hidden',
    ...(aspectRatio !== undefined ? { aspectRatio } : { height }),
    ...(width !== undefined ? { width: width as any } : { width: '100%' }),
  };

  // Warm tinted placeholder node (shown when no URI or on error).
  const fallbackNode = (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: tint ?? C.bgCook }]}>
      <View style={styles.shine} />
      {label ? (
        <View style={styles.labelWrap}>
          <Text style={styles.fallbackLabel} numberOfLines={3}>{label}</Text>
        </View>
      ) : null}
    </View>
  );

  return (
    <View style={[containerStyle, style]}>
      {/* Image layer */}
      <AppImage
        uri={optimisedUri}
        blurhash={blurhash}
        resizeMode="cover"
        style={StyleSheet.absoluteFill}
        fallback={fallbackNode}
        accessibilityLabel={accessibilityLabel ?? label ?? 'Dish photo'}
        recyclingKey={recyclingKey}
        showSkeleton={!blurhash}
      />

      {/* Cinematic gradient overlays — add editorial depth without obscuring the photo. */}
      <View style={styles.topGradient} pointerEvents="none" />
      <View style={styles.bottomGradient} pointerEvents="none" />

      {/* SOLD OUT: dim overlay + centred pill */}
      {isSoldOut && (
        <View style={styles.soldOutOverlay} pointerEvents="none">
          <View style={styles.soldOutPill}>
            <Text style={styles.soldOutText}>Sold out</Text>
          </View>
        </View>
      )}

      {/* Top-left badges: LIVE, SURPRISE DROP, GOLD ACCESS */}
      {showTopBadges && (
        <View style={styles.topBadges} pointerEvents="none">
          {isLive && (
            <View style={[styles.badge, styles.liveBadge]}>
              <View style={styles.liveDot} />
              <Text style={styles.badgeText}>Cooking now</Text>
            </View>
          )}
          {isSurpriseDrop && (
            <View style={[styles.badge, styles.surpriseBadge]}>
              <Text style={styles.badgeText}>✦ Surprise Drop</Text>
            </View>
          )}
          {isGoldAccess && !isSurpriseDrop && (
            <View style={[styles.badge, styles.goldBadge]}>
              <Text style={[styles.badgeText, { color: '#3A2800' }]}>Gold Early Access</Text>
            </View>
          )}
        </View>
      )}

      {/* Bottom-right: LOW STOCK indicator */}
      {showLowStock && (
        <View style={styles.lowStockWrap} pointerEvents="none">
          <View style={styles.lowStockPill}>
            <Text style={styles.lowStockText}>{slotsLeft} left</Text>
          </View>
        </View>
      )}
    </View>
  );
}

export default memo(DishPhoto);

const styles = StyleSheet.create({
  // Gradients add editorial cinematic depth.
  topGradient: {
    position: 'absolute', top: 0, left: 0, right: 0, height: 52,
    backgroundColor: 'rgba(0,0,0,0.10)',
  },
  bottomGradient: {
    position: 'absolute', bottom: 0, left: 0, right: 0, height: 72,
    backgroundColor: 'rgba(17, 24, 39,0.34)',
  },

  // SOLD OUT
  soldOutOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(17, 24, 39,0.52)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  soldOutPill: {
    backgroundColor: 'rgba(255, 255, 255,0.92)',
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: Radius.full,
  },
  soldOutText: {
    fontFamily: Fonts.sansMedium,
    fontSize: 13,
    color: '#111827',
    letterSpacing: 0.3,
  },

  // Top badges
  topBadges: {
    position: 'absolute',
    top: 10,
    left: 10,
    right: 10,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: Radius.full,
    gap: 5,
  },
  liveBadge:     { backgroundColor: 'rgba(46,139,63,0.90)' },
  surpriseBadge: { backgroundColor: 'rgba(232,146,74,0.92)' },
  goldBadge:     { backgroundColor: 'rgba(255,200,50,0.92)' },
  badgeText: {
    fontFamily: Fonts.sansMedium,
    fontSize: 10,
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  liveDot: {
    width: 6, height: 6, borderRadius: 3,
    backgroundColor: '#FFFFFF',
  },

  // Low stock
  lowStockWrap: { position: 'absolute', bottom: 10, right: 10 },
  lowStockPill: {
    backgroundColor: 'rgba(17, 24, 39,0.72)',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: Radius.full,
  },
  lowStockText: {
    fontFamily: Fonts.sansMedium,
    fontSize: 11,
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },

  // Fallback
  shine: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(255,236,200,0.14)' },
  labelWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  fallbackLabel: {
    fontFamily: Fonts.serifItalic,
    fontSize: 20,
    color: 'rgba(255,247,232,0.88)',
    textAlign: 'center',
    lineHeight: 26,
  },
});
