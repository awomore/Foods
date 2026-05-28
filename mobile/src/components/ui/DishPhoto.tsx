import React, { useState, useRef, useEffect } from 'react';
import { View, Image, StyleSheet, Animated } from 'react-native';
import { Colors, Fonts } from '../../constants/theme';
import { useColors } from '../../context/ThemeContext';

interface Props {
  uri?: string | null;       // real Cloudinary URL (or null/undefined → fallback)
  tint?: string;             // fallback background tint
  label?: string;            // fallback text label
  height?: number;
  width?: number | string;
  radius?: number;
  aspectRatio?: number;      // alternative to fixed height
}

export default function DishPhoto({
  uri,
  tint = Colors.ember,
  label,
  height = 200,
  width,
  radius = 14,
  aspectRatio,
}: Props) {
  const C = useColors();
  const [loaded, setLoaded] = useState(false);
  const [errored, setErrored] = useState(false);
  const shimmerOpacity = useRef(new Animated.Value(1)).current;
  const imgOpacity = useRef(new Animated.Value(0)).current;
  const shimmerAnim = useRef<Animated.CompositeAnimation | null>(null);

  // Shimmer loop while loading
  useEffect(() => {
    if (uri && !loaded && !errored) {
      shimmerAnim.current = Animated.loop(
        Animated.sequence([
          Animated.timing(shimmerOpacity, { toValue: 0.4, duration: 800, useNativeDriver: true }),
          Animated.timing(shimmerOpacity, { toValue: 1, duration: 800, useNativeDriver: true }),
        ])
      );
      shimmerAnim.current.start();
    }
    return () => shimmerAnim.current?.stop();
  }, [uri, loaded, errored]);

  function handleLoad() {
    shimmerAnim.current?.stop();
    setLoaded(true);
    Animated.timing(imgOpacity, { toValue: 1, duration: 250, useNativeDriver: true }).start();
  }

  const containerStyle: any = {
    backgroundColor: uri && !errored ? C.bgCook : tint,
    borderRadius: radius,
    overflow: 'hidden',
    ...(aspectRatio ? { aspectRatio } : { height }),
    ...(width ? { width } : { width: '100%' }),
  };

  const showRealImage = !!uri && !errored;

  return (
    <View style={containerStyle}>
      {/* Gradient sheen overlay (always present, adds cinematic depth) */}
      <View style={StyleSheet.absoluteFill}>
        <View style={styles.topGradient} />
        <View style={styles.bottomGradient} />
      </View>

      {showRealImage ? (
        <>
          {/* Shimmer while loading */}
          {!loaded && (
            <Animated.View
              style={[StyleSheet.absoluteFill, styles.shimmer, { opacity: shimmerOpacity }]}
            />
          )}

          {/* The real image */}
          <Animated.Image
            source={{ uri }}
            style={[StyleSheet.absoluteFill, styles.image, { opacity: imgOpacity }]}
            resizeMode="cover"
            onLoad={handleLoad}
            onError={() => { shimmerAnim.current?.stop(); setErrored(true); }}
            accessibilityLabel={label ?? 'Dish photo'}
          />
        </>
      ) : (
        // Fallback: warm tinted placeholder with italic label
        <View style={[StyleSheet.absoluteFill, styles.fallback, { backgroundColor: tint }]}>
          <View style={styles.shine} />
          {label ? (
            <View style={styles.labelWrap}>
              <Animated.Text style={styles.fallbackLabel} numberOfLines={3}>
                {label}
              </Animated.Text>
            </View>
          ) : null}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  image: { width: '100%', height: '100%' },

  shimmer: {
    backgroundColor: 'rgba(255,255,255,0.07)',
  },

  topGradient: {
    position: 'absolute', top: 0, left: 0, right: 0, height: 40,
    backgroundColor: 'rgba(0,0,0,0.08)',
  },
  bottomGradient: {
    position: 'absolute', bottom: 0, left: 0, right: 0, height: 60,
    backgroundColor: 'rgba(26,18,8,0.30)',
  },

  fallback: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  shine: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(255,236,200,0.14)' },
  labelWrap: { paddingHorizontal: 16, alignItems: 'center' },
  fallbackLabel: {
    fontFamily: Fonts.serifItalic,
    fontSize: 20,
    color: 'rgba(255,247,232,0.88)',
    textAlign: 'center',
    lineHeight: 26,
  },
});
