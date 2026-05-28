import { useEffect, useRef, useState } from 'react';
import { Animated, View, StyleSheet } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { useAuth } from '../src/context/AuthContext';
import { Colors, Fonts } from '../src/constants/theme';

const SPLASH_DURATION = 1800; // ms before routing away

function SplashLogo() {
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
        {/* FOODS */}
        <Animated.Text style={styles.logoFoods}>FOODS</Animated.Text>
        {/* byme */}
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

  // Show branded splash while fonts/auth load OR splash timer not done
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

const styles = StyleSheet.create({
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
    color: Colors.canvas,
    letterSpacing: -1,
  },
  logoByme: {
    fontFamily: Fonts.sansLight,
    fontSize: 24,
    color: Colors.ember,
    marginLeft: 6,
  },
  tagline: {
    fontFamily: Fonts.sans,
    fontSize: 13,
    color: 'rgba(232,146,74,0.65)',
    letterSpacing: 0.5,
  },
});
