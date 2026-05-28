/**
 * AppImage — universal image component for FOODSbyme.
 *
 * Uses expo-image for native-level caching, blurhash placeholders,
 * and smooth transitions. Adds a pulsing shimmer overlay while loading
 * (when no blurhash is available) and graceful error fallbacks.
 *
 * Design principle: photography is the product. Nothing should feel broken.
 */

import React, { useRef, useEffect, useState, memo } from 'react';
import { View, StyleSheet, Animated, AccessibilityRole } from 'react-native';
import { Image } from 'expo-image';
import { useColors } from '../../context/ThemeContext';

export interface AppImageProps {
  /** Cloudinary or any HTTPS image URL. Null/undefined → shows fallback. */
  uri?: string | null;
  /** Blurhash placeholder string (handled natively by expo-image). */
  blurhash?: string;
  /** Aspect ratio (width / height). Use instead of fixed height for fluid layouts. */
  aspectRatio?: number;
  /** How the image fills its container. Default: 'cover'. */
  resizeMode?: 'cover' | 'contain' | 'fill';
  /** Border radius applied to both container and image. */
  borderRadius?: number;
  /** Image fetch priority. Default: 'normal'. */
  priority?: 'low' | 'normal' | 'high';
  /** Custom fallback rendered when uri is absent or image fails. */
  fallback?: React.ReactNode;
  /** Fade-in duration after the image loads (ms). Default: 300. */
  transitionDuration?: number;
  /** Show shimmer skeleton while loading. Default: true. */
  showSkeleton?: boolean;
  /** Additional styles for the outer container. */
  style?: any;
  /** Accessibility label for the image. */
  accessibilityLabel?: string;
  /**
   * Stable key used by expo-image to prevent stale frames when a FlatList
   * recycles the same cell with a different image. Pass item.id or similar.
   */
  recyclingKey?: string;
  /** Fixed pixel width. Leave unset to use flex / percentage sizing. */
  width?: number | string;
  /** Fixed pixel height. Leave unset together with aspectRatio. */
  height?: number | string;
}

function AppImage({
  uri,
  blurhash,
  aspectRatio,
  resizeMode = 'cover',
  borderRadius = 0,
  priority = 'normal',
  fallback,
  transitionDuration = 300,
  showSkeleton = true,
  style,
  accessibilityLabel,
  recyclingKey,
  width,
  height,
}: AppImageProps) {
  const C = useColors();
  const [errored, setErrored] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const shimmerOpacity = useRef(new Animated.Value(0.5)).current;
  const shimmerAnim = useRef<Animated.CompositeAnimation | null>(null);

  const hasUri = !!uri && !errored;
  // Shimmer only when loading an image without a blurhash placeholder.
  const needsShimmer = showSkeleton && hasUri && !loaded && !blurhash;

  useEffect(() => {
    if (!needsShimmer) return;
    shimmerAnim.current = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerOpacity, { toValue: 0.9, duration: 900, useNativeDriver: true }),
        Animated.timing(shimmerOpacity, { toValue: 0.3, duration: 900, useNativeDriver: true }),
      ])
    );
    shimmerAnim.current.start();
    return () => { shimmerAnim.current?.stop(); };
  }, [needsShimmer]);

  function handleLoad() {
    shimmerAnim.current?.stop();
    setLoaded(true);
    // Fade shimmer out gracefully so the handoff feels organic.
    Animated.timing(shimmerOpacity, { toValue: 0, duration: 200, useNativeDriver: true }).start();
  }

  function handleError() {
    shimmerAnim.current?.stop();
    setErrored(true);
  }

  const br = borderRadius > 0 ? { borderRadius } : {};

  const containerStyle: any[] = [
    styles.container,
    { backgroundColor: C.bgCook },
    br,
    aspectRatio !== undefined && { aspectRatio },
    width !== undefined && { width },
    height !== undefined && { height },
    style,
  ];

  // ── No valid URI: show fallback or skeleton ──────────────────────────────────
  if (!hasUri) {
    if (fallback) {
      return (
        <View style={containerStyle}>
          {fallback}
        </View>
      );
    }
    // Static skeleton colour — pulses once to signal "content materialising."
    return (
      <View style={containerStyle}>
        {showSkeleton && (
          <Animated.View
            style={[StyleSheet.absoluteFill, br, { backgroundColor: C.borderWarm }]}
          />
        )}
      </View>
    );
  }

  // ── Has URI: render image with optional shimmer ──────────────────────────────
  return (
    <View style={containerStyle}>
      {/* Shimmer overlay — sits above the image until it loads. */}
      {showSkeleton && !blurhash && (
        <Animated.View
          style={[StyleSheet.absoluteFill, br, { backgroundColor: C.bgCook, opacity: shimmerOpacity }]}
          pointerEvents="none"
        />
      )}

      <Image
        source={{ uri }}
        placeholder={blurhash ? { blurhash } : undefined}
        placeholderContentFit={resizeMode}
        contentFit={resizeMode}
        transition={transitionDuration}
        priority={priority}
        cachePolicy="memory-disk"
        recyclingKey={recyclingKey ?? uri}
        style={[StyleSheet.absoluteFill, br]}
        onLoad={handleLoad}
        onError={handleError}
        accessible
        accessibilityLabel={accessibilityLabel ?? 'Image'}
      />
    </View>
  );
}

export default memo(AppImage);

const styles = StyleSheet.create({
  container: { overflow: 'hidden' },
});
