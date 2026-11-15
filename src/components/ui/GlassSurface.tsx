import React, { ReactNode } from 'react';
import { Platform, StyleSheet, View, ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import { Colors } from '../../theme/colors';

interface GlassSurfaceProps {
  children: ReactNode;
  style?: ViewStyle | ViewStyle[];
  intensity?: number;
  tint?: 'light' | 'dark' | 'default';
}

export function GlassSurface({
  children,
  style,
  intensity = 25,
  tint = 'light',
}: GlassSurfaceProps) {
  const content = (
    <View style={[styles.inner, style]}>
      {children}
    </View>
  );

  // Use blur on iOS only, fallback for Android and other platforms
  if (Platform.OS === 'ios') {
    return (
      <BlurView
        intensity={intensity}
        tint={tint}
        style={styles.blurWrapper}
      >
        {content}
      </BlurView>
    );
  }

  // Android and other platforms: use solid background fallback
  return (
    <View style={styles.fallbackWrapper}>
      {content}
    </View>
  );
}

const styles = StyleSheet.create({
  blurWrapper: {
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.surfaceHighlight,
    backgroundColor: '#FFFFFF33',
  },
  fallbackWrapper: {
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.surfaceHighlight,
    backgroundColor: Colors.surface,
  },
  inner: {
    padding: 16,
  },
});

