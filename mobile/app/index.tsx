import { useEffect, useRef, useState, useMemo } from 'react';
import { Animated, View, StyleSheet } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { useAuth } from '../src/context/AuthContext';
import { Fonts } from '../src/constants/theme';
import { useColors, type AppColors } from '../src/context/ThemeContext';

const SPLASH_DURATION = 1800; // ms before routing away

function SplashLogo() {
  const C = useColors();
  const styles = useMemo(() => makeStyles(C), [C]);
  const opacity = useRef(new Animated.Value(0)).current;
  const scale   = useRef(new Animated.Value(0.88)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, friction: 5, tension: 60, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <View style={styles.root}>
      <Animated.View style={[styles.logoWrap, { opacity, transform: [{ scale }] }]}>
        <Animated.Text style={styles.logoFoods}>FOODS</Animated.Text>
        <Animated.Text style={styles.logoByme}>byme</Animated.Text>
      </Animated.View>
      <Animated.Text style={[styles.tagline, { opacity }]}>
        Real food · real kitchens · real people
      </Animated.Text>
    </View>
  );
}

export default function Index() {
  const { isAuthenticated, isLoading, user, activeMode } = useAuth();
  const [splashDone, setSplashDone] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setSplashDone(true), SPLASH_DURATION);
    return () => clearTimeout(t);
  }, []);

  if (isLoading || !splashDone) {
    return <SplashLogo />;
  }

  if (!isAuthenticated) {
    return <Redirect href="/(auth)/welcome" />;
  }

  if (user?.role === 'cook' && activeMode !== 'customer') {
    return <Redirect href="/(cook)" />;
  }

  return <Redirect href="/(customer)" />;
}

function makeStyles(C: AppColors) { return StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#1A1009',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  logoWrap: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  logoFoods: {
    fontFamily: Fonts.serif,
    fontSize: 52,
    color: C.canvas,
    letterSpacing: -1,
  },
  logoByme: {
    fontFamily: Fonts.sansLight,
    fontSize: 24,
    color: C.ember,
    marginLeft: 6,
  },
  tagline: {
    fontFamily: Fonts.sans,
    fontSize: 13,
    color: 'rgba(232,146,74,0.65)',
    letterSpacing: 0.5,
  },
}); }
