import React from 'react';
import { Text, View } from 'react-native';
import { Fonts } from '../../constants/theme';
import { useColors } from '../../context/ThemeContext';

type Size = 'compact' | 'medium' | 'hero';
type Variant = 'light' | 'dark';

const sizeMap = {
  compact: { foods: 22, byme: 11, gap: 3, dot: 5, dotGap: 5 },
  medium:  { foods: 34, byme: 16, gap: 4, dot: 7, dotGap: 7 },
  hero:    { foods: 54, byme: 24, gap: 6, dot: 10, dotGap: 9 },
};

export default function Wordmark({ size = 'compact', on = 'light' }: { size?: Size; on?: Variant | string }) {
  const C = useColors();
  const s = sizeMap[size];
  const isDark = on === 'dark';

  const foodsColor  = isDark ? 'rgba(250,246,240,0.96)' : C.textInk;
  const bymeColor   = isDark ? 'rgba(232,146,74,0.90)'  : C.ember;
  const dotColor    = isDark ? 'rgba(232,146,74,0.85)'  : C.ember;

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      {/* 9 o'clock dot */}
      <View style={{
        width: s.dot, height: s.dot, borderRadius: 9999,
        backgroundColor: dotColor, marginRight: s.dotGap,
        alignSelf: 'center',
      }} />
      <Text style={{ fontFamily: Fonts.serif,    fontSize: s.foods, color: foodsColor, letterSpacing: -0.5 }}>FOODS</Text>
      <Text style={{ fontFamily: Fonts.sansLight, fontSize: s.byme,  color: bymeColor,  marginLeft: s.gap }}>byme</Text>
    </View>
  );
}
