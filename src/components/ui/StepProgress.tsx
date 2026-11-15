import React, { useEffect, useRef } from 'react';
import { StyleSheet, View, Text, Animated, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, Spacing } from '../../theme/colors';

interface Step {
  key: string;
  label: string;
}

interface Props {
  steps: Step[];
  currentStep: string;
  onHomePress?: () => void;
}

export default function StepProgress({ steps, currentStep, onHomePress }: Props) {
  const currentIndex = steps.findIndex((s) => s.key === currentStep);
  const progressAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(progressAnim, {
      toValue: currentIndex,
      useNativeDriver: false,
      tension: 50,
      friction: 10,
    }).start();
  }, [currentIndex, progressAnim]);

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, steps.length - 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <View
      style={styles.container}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={`Step ${currentIndex + 1} of ${steps.length}: ${steps[currentIndex]?.label || 'Unknown step'}`}
      accessibilityValue={{ min: 1, max: steps.length, now: currentIndex + 1 }}
    >
      <View style={styles.progressTrack}>
        <Animated.View style={[styles.progressFill, { width: progressWidth }]} />
      </View>
      <View style={styles.labelRow}>
        <View style={styles.labelLeft}>
          {onHomePress ? (
            <TouchableOpacity
              style={styles.homeButton}
              onPress={onHomePress}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Return to start screen"
              accessibilityHint="Discards this unsaved session and goes back to the home screen"
            >
              <MaterialIcons name="home" size={16} color={Colors.text} />
            </TouchableOpacity>
          ) : null}
          <Text style={styles.stepLabel}>
            {steps[currentIndex]?.label || ''}
          </Text>
        </View>
        <Text style={styles.stepCount}>
          {currentIndex + 1}/{steps.length}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.sm,
  },
  progressTrack: {
    height: 4,
    backgroundColor: '#D8D1C3',
    borderRadius: 999,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.primary,
    borderRadius: 999,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  labelLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  homeButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.surfaceHighlight,
  },
  stepLabel: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    color: Colors.text,
  },
  stepCount: {
    fontSize: 12,
    color: Colors.textMuted,
    fontVariant: ['tabular-nums'],
  },
});
