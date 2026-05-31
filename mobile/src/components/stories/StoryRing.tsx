import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet } from 'react-native';
import { useColors } from '../../context/ThemeContext';

interface Props {
  size: number;
  hasUnseen: boolean;
  isLive?: boolean;
  children: React.ReactNode;
}

const RING_WIDTH = 2.5;
const GAP = 2;

export default function StoryRing({ size, hasUnseen, isLive = false, children }: Props) {
  const C = useColors();
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!isLive) return;
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.15, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1,    duration: 700, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [isLive, pulse]);

  const outerSize = size + (RING_WIDTH + GAP) * 2;
  const radius = outerSize / 2;

  if (!hasUnseen && !isLive) {
    return <>{children}</>;
  }

  const ringColor = isLive ? '#D32F2F' : C.spice;

  return (
    <Animated.View
      style={[
        styles.ring,
        {
          width: outerSize,
          height: outerSize,
          borderRadius: radius,
          borderWidth: RING_WIDTH,
          borderColor: ringColor,
          transform: isLive ? [{ scale: pulse }] : [],
        },
      ]}
    >
      <View
        style={{
          width: size + GAP * 2,
          height: size + GAP * 2,
          borderRadius: (size + GAP * 2) / 2,
          backgroundColor: C.bg,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {children}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  ring: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
