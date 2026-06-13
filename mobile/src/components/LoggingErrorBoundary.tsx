import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { type ErrorBoundaryProps } from 'expo-router';

export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  // Log so adb logcat captures the actual error
  console.error('[FOODS] ErrorBoundary caught:', error?.message, error?.stack ?? String(error));
  return (
    <View style={S.container}>
      <Text style={S.title}>Something went wrong</Text>
      <Text style={S.msg}>{error?.message ?? String(error)}</Text>
      <TouchableOpacity style={S.btn} onPress={retry}>
        <Text style={S.btnText}>Retry</Text>
      </TouchableOpacity>
    </View>
  );
}

const S = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111827', alignItems: 'center', justifyContent: 'center', padding: 24 },
  title: { color: '#FFFFFF', fontSize: 20, fontWeight: 'bold', marginBottom: 12 },
  msg: { color: '#C4B4A0', fontSize: 13, textAlign: 'center', marginBottom: 24 },
  btn: { backgroundColor: '#FF6B35', borderRadius: 24, paddingVertical: 12, paddingHorizontal: 32 },
  btnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
});
