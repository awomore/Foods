import React from 'react';
import { View, ViewProps, StyleSheet } from 'react-native';
import { Colors, Radius, Shadow } from '../../constants/theme';

interface Props extends ViewProps {
  children: React.ReactNode;
  padding?: number;
  radius?: number;
  shadow?: boolean;
}

export default function Card({ children, padding = 16, radius = Radius.lg, shadow = true, style, ...rest }: Props) {
  return (
    <View
      style={[
        styles.card,
        { padding, borderRadius: radius },
        shadow ? Shadow.card : null,
        style,
      ]}
      {...rest}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.bgCard,
    borderWidth: 0.5,
    borderColor: Colors.borderWarm,
  },
});
