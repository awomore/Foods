import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, TouchableWithoutFeedback, TouchableOpacity,
  StyleSheet, StatusBar, Animated, Modal, Dimensions,
  TextInput, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { Ionicons } from '@expo/vector-icons';
import { storiesApi, type Story, type StoryFeedEntry, STORY_TYPE_LABELS, STORY_TYPE_COLORS } from '../../api/stories';
import { useColors } from '../../context/ThemeContext';
import { Fonts, Spacing, Radius } from '../../constants/theme';
import { useFeedback } from '../feedback';
import Avatar from '../ui/Avatar';

const { width: SW } = Dimensions.get('window');
const STORY_DURATION = 5000;

interface Props {
  entry: StoryFeedEntry;
  startIndex: number;
  onClose: () => void;
  onViewed: (storyId: string) => void;
}

export default function StoryViewer({ entry, startIndex, onClose, onViewed }: Props) {
  const C       = useColors();
  const insets  = useSafeAreaInsets();
  const router  = useRouter();
  const feedback = useFeedback();

  function visitKitchen() {
    onClose();
    router.push(`/cook/${entry.cook.id}` as any);
  }

  const [index, setIndex]     = useState(startIndex);
  const progress  = useRef(new Animated.Value(0)).current;
  const anim      = useRef<Animated.CompositeAnimation | null>(null);
  const paused    = useRef(false);
  const progressVal = useRef(0);

  // Reply / react state
  const [replyText, setReplyText] = useState('');
  const [sending, setSending]     = useState(false);
  const [hearted, setHearted]     = useState(false);
  const heartScale = useRef(new Animated.Value(1)).current;
  const heartFloat = useRef(new Animated.Value(0)).current;
  const inputRef   = useRef<TextInput>(null);

  const story: Story | undefined = entry.stories[index];

  const advance = useCallback(() => {
    if (index < entry.stories.length - 1) {
      setIndex(i => i + 1);
    } else {
      onClose();
    }
  }, [index, entry.stories.length, onClose]);

  // Track live progress value so we can resume from pause position
  useEffect(() => {
    const id = progress.addListener(({ value }) => { progressVal.current = value; });
    return () => progress.removeListener(id);
  }, [progress]);

  const startProgress = useCallback(() => {
    progress.setValue(0);
    progressVal.current = 0;
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

  function pauseStory() {
    paused.current = true;
    anim.current?.stop();
  }

  function resumeStory() {
    paused.current = false;
    const remaining = Math.max(400, (1 - progressVal.current) * STORY_DURATION);
    anim.current = Animated.timing(progress, {
      toValue: 1,
      duration: remaining,
      useNativeDriver: false,
    });
    anim.current.start(({ finished }) => {
      if (finished && !paused.current) advance();
    });
  }

  useEffect(() => {
    if (!story) return;
    setHearted(false);
    setReplyText('');
    startProgress();
    storiesApi.markViewed(story.id).catch(() => {});
    onViewed(story.id);
  }, [index, story?.id]);

  useEffect(() => () => anim.current?.stop(), []);

  function tapLeft()  { if (index > 0) setIndex(i => i - 1); }
  function tapRight() { advance(); }

  async function sendHeart() {
    if (hearted) return;
    setHearted(true);
    Animated.sequence([
      Animated.spring(heartScale, { toValue: 1.4, useNativeDriver: true, speed: 30, bounciness: 12 }),
      Animated.spring(heartScale, { toValue: 1,   useNativeDriver: true, speed: 20 }),
    ]).start();
    Animated.timing(heartFloat, { toValue: 1, duration: 900, useNativeDriver: true }).start(() => {
      heartFloat.setValue(0);
    });
    storiesApi.react(story.id, '❤️').catch(() => {});
  }

  async function sendReply() {
    const msg = replyText.trim();
    if (!msg || sending) return;
    setSending(true);
    try {
      await storiesApi.reply(story.id, msg);
      setReplyText('');
      inputRef.current?.blur();
      feedback.success('Sent!');
    } catch {
      feedback.error('Could not send');
    } finally {
      setSending(false);
    }
  }

  if (!story) return null;

  const typeColor = STORY_TYPE_COLORS[story.type] ?? C.spice;

  return (
    <Modal visible animationType="fade" statusBarTranslucent>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Background media */}
        {story.media_url && story.media_type === 'photo' ? (
          <Image
            source={{ uri: story.media_url }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            priority="high"
          />
        ) : story.media_url && story.media_type === 'video' ? (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: '#111', alignItems: 'center', justifyContent: 'center' }]}>
            <Ionicons name="videocam" size={64} color={typeColor} />
          </View>
        ) : (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: typeColor }]} />
        )}

        {/* Dark overlay */}
        <View style={styles.overlay} />

        {/* Progress bars */}
        <View style={[styles.progressRow, { top: insets.top + 8 }]}>
          {entry.stories.map((s, i) => (
            <View
              key={s.id}
              style={[
                styles.progressTrack,
                { flex: 1, backgroundColor: i > index ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.45)' },
              ]}
            >
              {i < index ? (
                <View style={[styles.progressFill, { width: '100%' }]} />
              ) : i === index ? (
                <Animated.View
                  style={[
                    styles.progressFill,
                    {
                      width: progress.interpolate({
                        inputRange: [0, 1],
                        outputRange: ['0%', '100%'],
                      }),
                    },
                  ]}
                />
              ) : null}
            </View>
          ))}
        </View>

        {/* Header */}
        <View style={[styles.header, { top: insets.top + 24 }]}>
          <TouchableOpacity style={styles.headerIdentity} onPress={visitKitchen} activeOpacity={0.8} hitSlop={8}>
            <Avatar name={entry.cook.display_name} avatarUrl={entry.cook.avatar_url} size={36} />
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

        {/* Caption */}
        {story.caption ? (
          <View style={[styles.captionWrap, { bottom: insets.bottom + 80 }]}>
            <Text style={styles.caption}>{story.caption}</Text>
          </View>
        ) : null}

        {/* Floating heart */}
        <Animated.View
          pointerEvents="none"
          style={[
            styles.floatingHeart,
            { bottom: insets.bottom + 90 },
            {
              opacity: heartFloat,
              transform: [
                { translateY: heartFloat.interpolate({ inputRange: [0, 1], outputRange: [0, -120] }) },
                { scale: heartScale },
              ],
            },
          ]}
        >
          <Text style={{ fontSize: 44 }}>❤️</Text>
        </Animated.View>

        {/* Reply row */}
        <View style={[styles.replyRow, { bottom: insets.bottom + 12 }]}>
          <TextInput
            ref={inputRef}
            style={styles.replyInput}
            value={replyText}
            onChangeText={setReplyText}
            placeholder={`Reply to ${entry.cook.display_name}…`}
            placeholderTextColor="rgba(255,255,255,0.45)"
            onFocus={pauseStory}
            onBlur={resumeStory}
            onSubmitEditing={sendReply}
            returnKeyType="send"
            blurOnSubmit={false}
          />
          {sending ? (
            <ActivityIndicator size="small" color="#fff" style={styles.replyAction} />
          ) : replyText.trim() ? (
            <TouchableOpacity onPress={sendReply} style={styles.replyAction}>
              <Ionicons name="send" size={22} color="#fff" />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity onPress={sendHeart} style={styles.replyAction} activeOpacity={0.7}>
              <Animated.View style={{ transform: [{ scale: heartScale }] }}>
                <Ionicons
                  name={hearted ? 'heart' : 'heart-outline'}
                  size={26}
                  color={hearted ? '#FF6B35' : '#fff'}
                />
              </Animated.View>
            </TouchableOpacity>
          )}
        </View>

        {/* Tap zones — leave bottom 90px clear for reply row */}
        <View style={styles.tapZones} pointerEvents="box-none">
          <TouchableWithoutFeedback onPress={tapLeft}>
            <View style={[styles.tapLeft,  { marginBottom: 90 }]} />
          </TouchableWithoutFeedback>
          <TouchableWithoutFeedback onPress={tapRight}>
            <View style={[styles.tapRight, { marginBottom: 90 }]} />
          </TouchableWithoutFeedback>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.25)' },

  progressRow: {
    position: 'absolute', left: Spacing.sm, right: Spacing.sm,
    flexDirection: 'row', gap: 3, zIndex: 10,
  },
  progressTrack: { height: 2, borderRadius: 1, overflow: 'hidden' },
  progressFill:  { height: '100%', backgroundColor: '#fff' },

  header: {
    position: 'absolute', left: Spacing.md, right: Spacing.md,
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, zIndex: 10,
  },
  headerIdentity: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flex: 1 },
  headerText: { flex: 1 },
  cookName: { color: '#fff', fontFamily: Fonts.sansMedium, fontSize: 14 },
  timeAgo:  { color: 'rgba(255,255,255,0.7)', fontFamily: Fonts.sans, fontSize: 11 },
  typePill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10,
  },
  liveDot:   { width: 6, height: 6, borderRadius: 3, backgroundColor: '#fff' },
  typeLabel: { color: '#fff', fontFamily: Fonts.sansMedium, fontSize: 11, letterSpacing: 0.3 },
  closeBtn:  { padding: 4 },

  captionWrap: {
    position: 'absolute', left: Spacing.md, right: Spacing.md,
    backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 10,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, zIndex: 10,
  },
  caption: { color: '#fff', fontFamily: Fonts.sans, fontSize: 15, lineHeight: 22 },

  floatingHeart: { position: 'absolute', right: 24, zIndex: 20 },

  replyRow: {
    position: 'absolute', left: Spacing.md, right: Spacing.md,
    flexDirection: 'row', alignItems: 'center', gap: 10, zIndex: 15,
  },
  replyInput: {
    flex: 1,
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.4)',
    borderRadius: Radius.full,
    paddingHorizontal: 18, paddingVertical: 11,
    fontFamily: Fonts.sans, fontSize: 14, color: '#fff',
  },
  replyAction: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },

  tapZones: { ...StyleSheet.absoluteFillObject, flexDirection: 'row', zIndex: 5 },
  tapLeft:  { flex: 1 },
  tapRight: { flex: 2 },
});
