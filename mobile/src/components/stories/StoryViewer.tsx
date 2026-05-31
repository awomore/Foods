import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, TouchableWithoutFeedback, TouchableOpacity,
  StyleSheet, StatusBar, Animated, Modal, Dimensions, Platform,
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { Ionicons } from '@expo/vector-icons';
import { storiesApi, type Story, type StoryFeedEntry, STORY_TYPE_LABELS, STORY_TYPE_COLORS } from '../../api/stories';
import { useColors } from '../../context/ThemeContext';
import { Fonts, Spacing, Radius } from '../../constants/theme';
import Avatar from '../ui/Avatar';

const { width: SW, height: SH } = Dimensions.get('window');
const STORY_DURATION = 5000;

interface Props {
  entry: StoryFeedEntry;
  startIndex: number;
  onClose: () => void;
  onViewed: (storyId: string) => void;
}

export default function StoryViewer({ entry, startIndex, onClose, onViewed }: Props) {
  const C = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  function visitKitchen() {
    onClose();
    router.push(`/cook/${entry.cook.id}` as any);
  }
  const [index, setIndex] = useState(startIndex);
  const progress = useRef(new Animated.Value(0)).current;
  const anim = useRef<Animated.CompositeAnimation | null>(null);
  const paused = useRef(false);

  const story: Story | undefined = entry.stories[index];

  const advance = useCallback(() => {
    if (index < entry.stories.length - 1) {
      setIndex(i => i + 1);
    } else {
      onClose();
    }
  }, [index, entry.stories.length, onClose]);

  const startProgress = useCallback(() => {
    progress.setValue(0);
    anim.current?.stop();
    anim.current = Animated.timing(progress, {
      toValue: 1,
      duration: STORY_DURATION,
      useNativeDriver: false,
    });
    anim.current.start(({ finished }) => {
      if (finished && !paused.current) advance();
    });
  }, [advance, progress]);

  useEffect(() => {
    if (!story) return;
    startProgress();
    // Mark as viewed (fire-and-forget)
    storiesApi.markViewed(story.id).catch(() => {});
    onViewed(story.id);
  }, [index, story?.id]);

  useEffect(() => {
    return () => anim.current?.stop();
  }, []);

  function tapLeft() {
    if (index > 0) setIndex(i => i - 1);
  }

  function tapRight() {
    advance();
  }

  if (!story) return null;

  const typeColor = STORY_TYPE_COLORS[story.type] ?? C.spice;

  return (
    <Modal visible animationType="fade" statusBarTranslucent>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <View style={styles.container}>

        {/* Background media */}
        {story.media_url && story.media_type === 'photo' ? (
          <Image
            source={{ uri: story.media_url }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            priority="high"
          />
        ) : story.media_url && story.media_type === 'video' ? (
          <VideoPlaceholder url={story.media_url} color={typeColor} />
        ) : (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: typeColor }]} />
        )}

        {/* Dark overlay for text legibility */}
        <View style={styles.overlay} />

        {/* Progress bars */}
        <View style={[styles.progressRow, { top: insets.top + 8 }]}>
          {entry.stories.map((s, i) => (
            <View key={s.id} style={[styles.progressTrack, { flex: 1 }]}>
              <Animated.View
                style={[
                  styles.progressFill,
                  {
                    flex: i < index ? 1 : i === index ? progress : 0,
                  },
                ]}
              />
            </View>
          ))}
        </View>

        {/* Header: avatar + name (tappable → cook profile) + close */}
        <View style={[styles.header, { top: insets.top + 24 }]}>
          <TouchableOpacity
            style={styles.headerIdentity}
            onPress={visitKitchen}
            activeOpacity={0.8}
            hitSlop={8}
          >
            <Avatar
              name={entry.cook.display_name}
              avatarUrl={entry.cook.avatar_url}
              size={36}
            />
            <View style={styles.headerText}>
              <Text style={styles.cookName}>{entry.cook.display_name}</Text>
              <Text style={styles.timeAgo}>{relativeTime(story.created_at)}</Text>
            </View>
          </TouchableOpacity>
          <View style={[styles.typePill, { backgroundColor: typeColor }]}>
            {story.type === 'live' && <View style={styles.liveDot} />}
            <Text style={styles.typeLabel}>{STORY_TYPE_LABELS[story.type]}</Text>
          </View>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={12}>
            <Ionicons name="close" size={24} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Bottom action row: caption + CTAs */}
        <View style={[styles.bottomRow, { bottom: insets.bottom + Spacing.md }]}>
          {story.caption ? (
            <View style={styles.captionWrap}>
              <Text style={styles.caption}>{story.caption}</Text>
            </View>
          ) : null}

          <View style={styles.ctaRow}>
            {story.media_type === 'video' && story.media_url && (
              <TouchableOpacity
                style={styles.ctaBtn}
                onPress={() => WebBrowser.openBrowserAsync(story.media_url!)}
                activeOpacity={0.8}
              >
                <Ionicons name="play-circle" size={16} color="#fff" />
                <Text style={styles.ctaBtnText}>Watch video</Text>
              </TouchableOpacity>
            )}

            {story.type === 'flash_sale' && (
              <TouchableOpacity style={[styles.ctaBtn, styles.ctaBtnPrimary]} onPress={visitKitchen} activeOpacity={0.85}>
                <Ionicons name="pricetag" size={16} color="#fff" />
                <Text style={styles.ctaBtnText}>Order Now</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity style={styles.ctaBtnOutline} onPress={visitKitchen} activeOpacity={0.85}>
              <Text style={styles.ctaBtnOutlineText}>Visit Kitchen</Text>
              <Ionicons name="arrow-forward" size={14} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Tap zones */}
        <View style={styles.tapZones} pointerEvents="box-none">
          <TouchableWithoutFeedback onPress={tapLeft}>
            <View style={styles.tapLeft} />
          </TouchableWithoutFeedback>
          <TouchableWithoutFeedback onPress={tapRight}>
            <View style={styles.tapRight} />
          </TouchableWithoutFeedback>
        </View>
      </View>
    </Modal>
  );
}

function VideoPlaceholder({ url, color }: { url: string; color: string }) {
  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: '#111', alignItems: 'center', justifyContent: 'center' }]}>
      <Ionicons name="videocam" size={64} color={color} />
    </View>
  );
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  progressRow: {
    position: 'absolute',
    left: Spacing.sm,
    right: Spacing.sm,
    flexDirection: 'row',
    gap: 3,
    zIndex: 10,
  },
  progressTrack: {
    height: 2,
    backgroundColor: 'rgba(255,255,255,0.35)',
    borderRadius: 1,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#fff',
  },
  header: {
    position: 'absolute',
    left: Spacing.md,
    right: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    zIndex: 10,
  },
  headerIdentity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flex: 1,
  },
  headerText: { flex: 1 },
  cookName: {
    color: '#fff',
    fontFamily: Fonts.sansMedium,
    fontSize: 14,
  },
  timeAgo: {
    color: 'rgba(255,255,255,0.7)',
    fontFamily: Fonts.sans,
    fontSize: 11,
  },
  typePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#fff',
  },
  typeLabel: {
    color: '#fff',
    fontFamily: Fonts.sansMedium,
    fontSize: 11,
    letterSpacing: 0.3,
  },
  closeBtn: {
    padding: 4,
  },
  bottomRow: {
    position: 'absolute',
    left: Spacing.md,
    right: Spacing.md,
    gap: Spacing.sm,
    zIndex: 10,
  },
  captionWrap: {
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 10,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  caption: {
    color: '#fff',
    fontFamily: Fonts.sans,
    fontSize: 15,
    lineHeight: 22,
  },
  ctaRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    flexWrap: 'wrap',
  },
  ctaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  ctaBtnPrimary: {
    backgroundColor: '#C62828',
    borderColor: 'transparent',
  },
  ctaBtnText: {
    color: '#fff',
    fontFamily: Fonts.sansMedium,
    fontSize: 13,
  },
  ctaBtnOutline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    flex: 1,
    justifyContent: 'center',
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  ctaBtnOutlineText: {
    color: '#fff',
    fontFamily: Fonts.sansMedium,
    fontSize: 13,
  },
  tapZones: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
    zIndex: 5,
  },
  tapLeft:  { flex: 1 },
  tapRight: { flex: 2 },
});
