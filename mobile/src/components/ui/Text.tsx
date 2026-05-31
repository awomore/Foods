import React from 'react';
import { Text as RNText, TextProps } from 'react-native';
import { Fonts, FontSize } from '../../constants/theme';
import { useColors } from '../../context/ThemeContext';

type Variant = 'display' | 'h1' | 'h2' | 'h3' | 'label' | 'body' | 'small' | 'note' | 'caps' | 'price';

interface Props extends TextProps {
  variant?: Variant;
  color?: string;
  italic?: boolean;
}

export default function Text({ variant = 'body', color, italic, style, children, ...rest }: Props) {
  const C = useColors();

  const variantStyles: Record<Variant, object> = {
    display: { fontFamily: Fonts.serif,       fontSize: 34, color: C.textInk, lineHeight: 40 },
    h1:      { fontFamily: Fonts.serif,       fontSize: 28, color: C.textInk, lineHeight: 34 },
    h2:      { fontFamily: Fonts.serif,       fontSize: 22, color: C.textInk, lineHeight: 28 },
    h3:      { fontFamily: Fonts.serif,       fontSize: 17, color: C.textInk, lineHeight: 22 },
    label:   { fontFamily: Fonts.sansMedium,  fontSize: 14, color: C.textInk, fontWeight: '600' },
    body:    { fontFamily: Fonts.sans,        fontSize: 14, color: C.body,    lineHeight: 22 },
    small:   { fontFamily: Fonts.sans,        fontSize: 12, color: C.bodySoft },
    note:    { fontFamily: Fonts.sans,        fontSize: 12, color: C.bodySoft, fontStyle: 'italic' },
    caps:    { fontFamily: Fonts.sansMedium,  fontSize: 10, color: C.caps, letterSpacing: 1.2, textTransform: 'uppercase' },
    price:   { fontFamily: Fonts.serif,       fontSize: 20, color: C.spice },
  };

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
