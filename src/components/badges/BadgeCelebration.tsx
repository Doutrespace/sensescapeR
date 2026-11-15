/**
 * BadgeCelebration - Full-screen celebration overlay when a badge is earned
 */
import React, { useEffect, useCallback } from 'react';
import { StyleSheet, View, Text, Pressable, Dimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withDelay,
  withSequence,
  runOnJS,
  Easing,
  FadeIn,
  FadeOut,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { BadgeDefinition } from '../../badges/types';
import { BadgeIcon } from './BadgeIcon';
import { Colors, Typography, Spacing } from '../../theme/colors';
import { ConfettiAnimation } from './ConfettiAnimation';
import { t } from '../../i18n';

interface BadgeCelebrationProps {
  badge: BadgeDefinition;
  onDismiss: () => void;
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export function BadgeCelebration({ badge, onDismiss }: BadgeCelebrationProps) {
  const badgeScale = useSharedValue(0);
  const badgeOpacity = useSharedValue(0);
  const textOpacity = useSharedValue(0);
  const buttonOpacity = useSharedValue(0);
  const ringScale = useSharedValue(0);
  const ringOpacity = useSharedValue(0.8);

  const triggerHaptic = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, []);

  useEffect(() => {
    // Badge entrance animation
    badgeScale.value = withDelay(
      200,
      withSpring(1, { damping: 8, stiffness: 120 }, (finished) => {
        if (finished) {
          runOnJS(triggerHaptic)();
        }
      })
    );
    badgeOpacity.value = withDelay(200, withTiming(1, { duration: 300 }));

    // Ring expansion animation
    ringScale.value = withDelay(
      400,
      withTiming(3, { duration: 800, easing: Easing.out(Easing.ease) })
    );
    ringOpacity.value = withDelay(
      400,
      withTiming(0, { duration: 800, easing: Easing.out(Easing.ease) })
    );

    // Text fade in
    textOpacity.value = withDelay(600, withTiming(1, { duration: 400 }));

    // Button fade in
    buttonOpacity.value = withDelay(1000, withTiming(1, { duration: 400 }));
  }, [badgeScale, badgeOpacity, textOpacity, buttonOpacity, ringScale, ringOpacity, triggerHaptic]);

  const handleDismiss = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    badgeScale.value = withTiming(0.8, { duration: 200 });
    badgeOpacity.value = withTiming(0, { duration: 200 });
    textOpacity.value = withTiming(0, { duration: 150 });
    buttonOpacity.value = withTiming(0, { duration: 150 }, (finished) => {
      if (finished) {
        runOnJS(onDismiss)();
      }
    });
  }, [onDismiss, badgeScale, badgeOpacity, textOpacity, buttonOpacity]);

  const badgeAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: badgeScale.value }],
    opacity: badgeOpacity.value,
  }));

  const textAnimatedStyle = useAnimatedStyle(() => ({
    opacity: textOpacity.value,
  }));

  const buttonAnimatedStyle = useAnimatedStyle(() => ({
    opacity: buttonOpacity.value,
  }));

  const ringAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: ringScale.value }],
    opacity: ringOpacity.value,
    borderColor: badge.glowColor,
  }));

  return (
    <Animated.View
      style={styles.overlay}
      entering={FadeIn.duration(300)}
      exiting={FadeOut.duration(200)}
    >
      <ConfettiAnimation color={badge.color} />

      <View style={styles.content}>
        {/* Expanding ring effect */}
        <Animated.View style={[styles.ring, ringAnimatedStyle]} />

        {/* Badge */}
        <Animated.View style={[styles.badgeContainer, badgeAnimatedStyle]}>
          <BadgeIcon badge={badge} size="xlarge" showGlow animated />
        </Animated.View>

        {/* Badge info */}
        <Animated.View style={[styles.textContainer, textAnimatedStyle]}>
          <Text style={styles.congratsText}>{t('Achievement Unlocked!')}</Text>
          <Text style={styles.badgeName}>{t(badge.name)}</Text>
          <Text style={styles.badgeDescription}>{t(badge.description)}</Text>
        </Animated.View>

        {/* Dismiss button */}
        <Animated.View style={[styles.buttonContainer, buttonAnimatedStyle]}>
          <Pressable style={styles.button} onPress={handleDismiss}>
            <Text style={styles.buttonText}>{t('Awesome!')}</Text>
          </Pressable>
        </Animated.View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  content: {
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
  },
  ring: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 3,
  },
  badgeContainer: {
    marginBottom: Spacing.xl,
  },
  textContainer: {
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  congratsText: {
    fontSize: Typography.body,
    color: '#FFFFFF99',
    textTransform: 'uppercase',
    letterSpacing: 2,
    marginBottom: Spacing.sm,
  },
  badgeName: {
    fontSize: Typography.headline,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: Spacing.sm,
    textAlign: 'center',
  },
  badgeDescription: {
    fontSize: Typography.body,
    color: '#FFFFFFCC',
    textAlign: 'center',
    maxWidth: 280,
  },
  buttonContainer: {
    marginTop: Spacing.lg,
  },
  button: {
    backgroundColor: '#FFFFFF',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl * 2,
    borderRadius: 100,
  },
  buttonText: {
    fontSize: Typography.bodyLarge,
    fontWeight: '600',
    color: Colors.primary,
  },
});
