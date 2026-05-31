import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator,
} from 'react-native';
import { storiesApi, type StoryFeedEntry } from '../../api/stories';
import { useColors } from '../../context/ThemeContext';
import { Fonts, Spacing } from '../../constants/theme';
import Avatar from '../ui/Avatar';
import StoryRing from './StoryRing';
import StoryViewer from './StoryViewer';

interface Props {
  onEmpty?: () => void;
}

export default function StoriesBar({ onEmpty }: Props) {
  const C = useColors();
  const [feed, setFeed] = useState<StoryFeedEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewing, setViewing] = useState<{ entry: StoryFeedEntry; startIndex: number } | null>(null);

  useEffect(() => {
    loadFeed();
  }, []);

  async function loadFeed() {
    try {
      const res = await storiesApi.feed();
      setFeed(res.feed ?? []);
      if (!res.feed?.length) onEmpty?.();
    } catch {
      onEmpty?.();
    } finally {
      setLoading(false);
    }
  }

  const handleStoryViewed = useCallback((entryIndex: number, storyId: string) => {
    setFeed(prev => prev.map((e, i) => {
      if (i !== entryIndex) return e;
      const stories = e.stories.map(s =>
        s.id === storyId ? { ...s, has_viewed: true } : s
      );
      return { ...e, stories, has_unseen: stories.some(s => !s.has_viewed) };
    }));
  }, []);

  const openStory = useCallback((entry: StoryFeedEntry) => {
    const startIndex = entry.stories.findIndex(s => !s.has_viewed);
    setViewing({ entry, startIndex: startIndex === -1 ? 0 : startIndex });
  }, []);

  if (loading) {
    return (
      <View style={[styles.loadingRow, { borderBottomColor: C.borderWarm }]}>
        <ActivityIndicator size="small" color={C.spice} />
      </View>
    );
  }

  if (!feed.length) return null;

  return (
    <>
      <FlatList
        data={feed}
        keyExtractor={item => item.cook.id}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.list}
        renderItem={({ item, index }) => (
          <TouchableOpacity
            style={styles.item}
            onPress={() => openStory(item)}
            activeOpacity={0.8}
          >
            <StoryRing
              size={56}
              hasUnseen={item.has_unseen}
              isLive={item.cook.is_live}
            >
              <Avatar
                name={item.cook.display_name}
                avatarUrl={item.cook.avatar_url}
                size={56}
              />
            </StoryRing>

            {item.cook.is_live && (
              <View style={[styles.liveBadge, { backgroundColor: '#D32F2F' }]}>
                <Text style={styles.liveBadgeText}>LIVE</Text>
              </View>
            )}

            <Text
              style={[styles.name, { color: item.has_unseen ? C.ink : C.bodySoft }]}
              numberOfLines={1}
            >
              {item.cook.display_name}
            </Text>
          </TouchableOpacity>
        )}
      />

      {viewing && (
        <StoryViewer
          entry={viewing.entry}
          startIndex={viewing.startIndex}
          onClose={() => setViewing(null)}
          onViewed={(storyId) => {
            const idx = feed.findIndex(e => e.cook.id === viewing.entry.cook.id);
            if (idx >= 0) handleStoryViewed(idx, storyId);
          }}
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  loadingRow: {
    height: 100,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  list: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    gap: Spacing.md,
  },
  item: {
    alignItems: 'center',
    width: 72,
    position: 'relative',
  },
  name: {
    fontFamily: Fonts.sans,
    fontSize: 11,
    marginTop: 5,
    textAlign: 'center',
    width: 70,
  },
  liveBadge: {
    position: 'absolute',
    bottom: 20,
    alignSelf: 'center',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  liveBadgeText: {
    color: '#fff',
    fontFamily: Fonts.sansMedium,
    fontSize: 9,
    letterSpacing: 0.5,
  },
});
