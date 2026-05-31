/**
 * Avatar — cook profile photo with graceful fallback.
 *
 * Uses expo-image for native caching and smooth transitions.
 * Falls back to initials on a warm brand-tinted circle.
 * Optional verification badge for credentialed cooks.
 */

import React, { memo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Fonts } from '../../constants/theme';
import { useColors } from '../../context/ThemeContext';
import AppImage from '../media/AppImage';
import { avatarPhoto } from '../../utils/cloudinary';
import StoryRing from '../stories/StoryRing';

interface Props {
  name: string;
  avatarUrl?: string | null;
  avatarBg?: string;
  size?: number;
  /** Show a small verification badge in the corner. */
  verified?: boolean;
  /** Blurhash for an instant low-fi preview. */
  blurhash?: string;
  /** Wrap with a story ring when the cook has unseen stories. */
  hasStory?: boolean;
  /** Show a pulsing red LIVE ring instead of the story ring. */
  isLive?: boolean;
  /** Called when the story ring is tapped. */
  onStoryPress?: () => void;
}

function Avatar({ name, avatarUrl, avatarBg, size = 44, verified = false, blurhash, hasStory = false, isLive = false, onStoryPress }: Props) {
  const C = useColors();
  const bg = avatarBg ?? C.spice;
  const initial = name?.charAt(0)?.toUpperCase() ?? '?';
  const radius = size / 2;

  // Request 2× for retina clarity without oversized downloads.
  const optimisedUrl = avatarPhoto(avatarUrl, size * 2);

  const initials = (
    <View style={[styles.circle, { width: size, height: size, borderRadius: radius, backgroundColor: bg }]}>
      <Text style={[styles.initial, { fontSize: size * 0.4 }]}>{initial}</Text>
    </View>
  );

  const inner = (
    <View style={{ width: size, height: size }}>
      {optimisedUrl ? (
        <AppImage
          uri={optimisedUrl}
          blurhash={blurhash}
          resizeMode="cover"
          borderRadius={radius}
          width={size}
          height={size}
          showSkeleton
          accessibilityLabel={name ? `${name}'s profile photo` : 'Profile photo'}
          fallback={initials}
        />
      ) : (
        initials
      )}

      {/* Verification badge — shown only on larger avatars to stay legible. */}
      {verified && size >= 32 && (
        <View
          style={[
            styles.badge,
            {
              width: Math.max(14, size * 0.32),
              height: Math.max(14, size * 0.32),
              borderRadius: Math.max(7, size * 0.16),
              right: -1,
              bottom: -1,
              borderWidth: Math.max(1, size * 0.035),
              borderColor: C.bg,
              backgroundColor: C.leaf,
            },
          ]}
        >
          <Text style={{ fontSize: Math.max(7, size * 0.18), color: '#FAF6F0', lineHeight: Math.max(14, size * 0.32), textAlign: 'center' }}>✓</Text>
        </View>
      )}
    </View>
  );

  if (hasStory || isLive) {
    if (onStoryPress) {
      return (
        <TouchableOpacity onPress={onStoryPress} activeOpacity={0.85}>
          <StoryRing size={size} hasUnseen={hasStory} isLive={isLive}>
            {inner}
          </StoryRing>
        </TouchableOpacity>
      );
    }
    return (
      <StoryRing size={size} hasUnseen={hasStory} isLive={isLive}>
        {inner}
      </StoryRing>
    );
  }

  return inner;
}

export default memo(Avatar);

const styles = StyleSheet.create({
  circle: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  initial: { fontFamily: Fonts.serif, color: '#FAF6F0', includeFontPadding: false },
  badge: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
});
