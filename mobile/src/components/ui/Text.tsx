import React from 'react';
import { Text as RNText, TextProps, StyleSheet } from 'react-native';
import { Colors, Fonts, FontSize } from '../../constants/theme';

type Variant = 'display' | 'h1' | 'h2' | 'h3' | 'label' | 'body' | 'small' | 'note' | 'caps' | 'price';

interface Props extends TextProps {
  variant?: Variant;
  color?: string;
  italic?: boolean;
}

const variantStyles: Record<Variant, object> = {
  display: { fontFamily: Fonts.serif,       fontSize: 34, color: Colors.textInk, lineHeight: 40 },
  h1:      { fontFamily: Fonts.serif,       fontSize: 28, color: Colors.textInk, lineHeight: 34 },
  h2:      { fontFamily: Fonts.serif,       fontSize: 22, color: Colors.textInk, lineHeight: 28 },
  h3:      { fontFamily: Fonts.serif,       fontSize: 17, color: Colors.textInk, lineHeight: 22 },
  label:   { fontFamily: Fonts.sansMedium,  fontSize: 14, color: Colors.textInk, fontWeight: '600' },
  body:    { fontFamily: Fonts.sans,        fontSize: 14, color: Colors.body,    lineHeight: 22 },
  small:   { fontFamily: Fonts.sans,        fontSize: 12, color: Colors.bodySoft },
  note:    { fontFamily: Fonts.sans,        fontSize: 12, color: Colors.bodySoft, fontStyle: 'italic' },
  caps:    { fontFamily: Fonts.sansMedium,  fontSize: 10, color: Colors.caps, letterSpacing: 1.2, textTransform: 'uppercase' },
  price:   { fontFamily: Fonts.serif,       fontSize: 20, color: Colors.spice },
};

export default function Text({ variant = 'body', color, italic, style, children, ...rest }: Props) {
  return (
    <RNText
      style={[
        variantStyles[variant],
        italic && { fontFamily: variant === 'h1' || variant === 'h2' || variant === 'h3' || variant === 'display' ? Fonts.serifItalic : Fonts.sans, fontStyle: 'italic' },
        color ? { color } : null,
        style,
      ]}
      {...rest}
    >
      {children}
    </RNText>
  );
}
