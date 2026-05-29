import React, { useEffect, useRef } from 'react';
import {
  Modal, View, Text, Pressable, Animated,
  StyleSheet, ScrollView, PanResponder, Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '../../context/ThemeContext';
import { Fonts, Radius, FontSize, Shadow, Spacing } from '../../constants/theme';
import { haptic } from './haptics';

const SCREEN_HEIGHT = Dimensions.get('window').height;

interface Props {
  visible: boolean;
  onClose: () => void;
  title?: string;
  snapHeight?: number; // fraction of screen height, 0.4 – 0.92
  children: React.ReactNode;
  scrollable?: boolean;
}

export function BottomSheetModal({
  visible,
  onClose,
  title,
  snapHeight = 0.6,
  children,
  scrollable = true,
}: Props) {
  const C = useColors();
  const insets = useSafeAreaInsets();

  const sheetHeight = SCREEN_HEIGHT * snapHeight;
  const slideY  = useRef(new Animated.Value(sheetHeight)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(slideY, {
          toValue: 0,
          damping: 22,
          stiffness: 300,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    } else {
      slideY.setValue(sheetHeight);
      opacity.setValue(0);
    }
  }, [visible]);

  function close() {
    haptic.light();
    Animated.parallel([
      Animated.timing(slideY, { toValue: sheetHeight, duration: 260, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 0, duration: 220, useNativeDriver: true }),
    ]).start(onClose);
  }

  const pan = useRef(PanResponder.create({
    onMoveShouldSetPanResponder: (_, g) => g.dy > 8,
    onPanResponderMove: (_, g) => {
      if (g.dy > 0) slideY.setValue(g.dy);
    },
    onPanResponderRelease: (_, g) => {
      if (g.dy > sheetHeight * 0.3 || g.vy > 0.6) {
        close();
      } else {
        Animated.spring(slideY, { toValue: 0, useNativeDriver: true }).start();
      }
    },
  })).current;

  const ContentWrapper = scrollable ? ScrollView : View;
  const contentProps = scrollable
    ? { bounces: false, showsVerticalScrollIndicator: false, contentContainerStyle: styles.scrollContent }
    : { style: styles.scrollContent };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={close}
      statusBarTranslucent
    >
      <Animated.View style={[styles.backdrop, { opacity }]}>
        <Pressable style={StyleSheet.absoluteFillObject} onPress={close} />
      </Animated.View>

      <Animated.View
        style={[
          styles.sheet,
          {
            height: sheetHeight,
            backgroundColor: C.bgCard,
            paddingBottom: insets.bottom + 8,
            transform: [{ translateY: slideY }],
          },
        ]}
      >
        {/* Drag handle */}
        <View {...pan.panHandlers} style={styles.handleArea}>
          <View style={[styles.handle, { backgroundColor: C.borderWarm }]} />
        </View>

        {/* Header */}
        {title ? (
          <View style={[styles.header, { borderBottomColor: C.borderWarm }]}>
            <Text style={[styles.headerTitle, { color: C.textInk }]}>{title}</Text>
            <Pressable onPress={close} hitSlop={12} accessibilityRole="button" accessibilityLabel="Close">
              <Ionicons name="close" size={20} color={C.bodySoft} />
            </Pressable>
          </View>
        ) : null}

        {/* Content */}
        <ContentWrapper {...contentProps as any}>
          {children}
        </ContentWrapper>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.38)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    ...Shadow.lift,
  },
  handleArea: {
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 4,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: 14,
    borderBottomWidth: 0.5,
  },
  headerTitle: {
    fontFamily: Fonts.sansMedium,
    fontSize: FontSize.lg,
  },
  scrollContent: {
    padding: Spacing.lg,
    paddingBottom: 24,
  },
});
