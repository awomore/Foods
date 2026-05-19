import React from 'react';
import { Text, View } from 'react-native';
import { Fonts, Colors } from '../../constants/theme';

type Size = 'compact' | 'medium' | 'hero';
type On = 'light' | 'dark' | 'spice';

const sizeMap = {
  compact: { foods: 22, byme: 11, gap: 3 },
  medium:  { foods: 34, byme: 16, gap: 4 },
  hero:    { foods: 54, byme: 24, gap: 6 },
};

export default function Wordmark({ size = 'compact', on = 'light' }: { size?: Size; on?: On }) {
  const s = sizeMap[size];
  const foodsColor = on === 'dark' || on === 'spice' ? Colors.canvas : Colors.ink;
  const bymeColor  = on === 'dark' ? Colors.ember : on === 'spice' ? 'rgba(250,246,240,0.75)' : Colors.spice;

  return (
    <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
      <Text style={{ fontFamily: Fonts.serif,     fontSize: s.foods, color: foodsColor, letterSpacing: -0.5 }}>FOODS</Text>
      <Text style={{ fontFamily: Fonts.sansLight,  fontSize: s.byme,  color: bymeColor,  marginLeft: s.gap }}>byme</Text>
    </View>
  );
}
