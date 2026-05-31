import React from 'react';
import { Text, View } from 'react-native';
import { Fonts } from '../../constants/theme';
import { useColors } from '../../context/ThemeContext';

type Size = 'compact' | 'medium' | 'hero';

const sizeMap = {
  compact: { foods: 22, byme: 11, gap: 3 },
  medium:  { foods: 34, byme: 16, gap: 4 },
  hero:    { foods: 54, byme: 24, gap: 6 },
};

export default function Wordmark({ size = 'compact' }: { size?: Size; on?: string }) {
  const C = useColors();
  const s = sizeMap[size];

  return (
    <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
      <Text style={{ fontFamily: Fonts.serif,    fontSize: s.foods, color: C.textInk, letterSpacing: -0.5 }}>FOODS</Text>
      <Text style={{ fontFamily: Fonts.sansLight, fontSize: s.byme,  color: C.ember,   marginLeft: s.gap }}>byme</Text>
    </View>
  );
}
