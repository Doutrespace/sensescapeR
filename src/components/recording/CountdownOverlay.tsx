import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, Animated } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Colors, Spacing } from '../../theme/colors';

interface Props {
  seconds?: number;
  onComplete: () => void;
}

export function CountdownOverlay({ seconds = 3, onComplete }: Props) {
  const [count, setCount] = useState(seconds);
  const scaleAnim = useRef(new Animated.Value(0.5)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (count === 0) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onComplete();
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    // Reset animations
    scaleAnim.setValue(0.5);
    opacityAnim.setValue(0);

    // Animate number appearance
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 5,
        tension: 100,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();

    // Schedule next count
    const timer = setTimeout(() => {
      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start(() => {
        setCount((c) => c - 1);
      });
    }, 800);

    return () => clearTimeout(timer);
  }, [count, onComplete, scaleAnim, opacityAnim]);

  return (
    <View style={styles.container}>
      <View style={styles.countdownCircle}>
        <Animated.Text
          style={[
            styles.countdownText,
            {
              opacity: opacityAnim,
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          {count}
        </Animated.Text>
      </View>
      <Text style={styles.hint}>Get ready to record...</Text>
      <Text style={styles.subhint}>Find a quiet position</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.lg,
  },
  countdownCircle: {
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: Colors.surface,
    borderWidth: 4,
    borderColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xl,
  },
  countdownText: {
    fontSize: 72,
    fontWeight: '700',
    color: Colors.primary,
  },
  hint: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text,
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  subhint: {
    fontSize: 14,
    color: Colors.textMuted,
    textAlign: 'center',
  },
});
