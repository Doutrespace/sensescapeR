/**
 * BadgeIcon - Renders a single badge with glow effect
 */
import React, { useEffect } from 'react';
import { StyleSheet, View, Text, Pressable } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withRepeat,
  withTiming,
  withSequence,
  Easing,
  interpolate,
  cancelAnimation,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { BadgeDefinition } from '../../badges/types';

interface BadgeIconProps {
  badge: BadgeDefinition;
  size?: 'small' | 'medium' | 'large' | 'xlarge';
  showGlow?: boolean;
  animated?: boolean;
  onPress?: () => void;
}

const SIZES = {
  small: { container: 32, emoji: 16, glow: 40 },
  medium: { container: 48, emoji: 24, glow: 60 },
  large: { container: 72, emoji: 36, glow: 90 },
  xlarge: { container: 120, emoji: 60, glow: 150 },
};

export function BadgeIcon({
  badge,
  size = 'medium',
  showGlow = true,
  animated = false,
  onPress,
}: BadgeIconProps) {
  const dimensions = SIZES[size];
  const scale = useSharedValue(1);
  const glowOpacity = useSharedValue(0.6);
  const glowScale = useSharedValue(1);
  const rotation = useSharedValue(0);

  useEffect(() => {
    if (animated) {
      // Pulsing glow animation
      glowOpacity.value = withRepeat(
        withSequence(
          withTiming(0.9, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
          withTiming(0.4, { duration: 1000, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        true
      );

      glowScale.value = withRepeat(
        withSequence(
          withTiming(1.15, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
          withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        true
      );

      // Subtle rotation for special badges
      if (badge.isSpecial) {
        rotation.value = withRepeat(
          withSequence(
            withTiming(3, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
            withTiming(-3, { duration: 2000, easing: Easing.inOut(Easing.ease) })
          ),
          -1,
          true
        );
      }
    }

    return () => {
      cancelAnimation(glowOpacity);
      cancelAnimation(glowScale);
      cancelAnimation(rotation);
    };
  }, [animated, badge.isSpecial, glowOpacity, glowScale, rotation]);

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    // Bounce animation on press
    scale.value = withSequence(
      withSpring(1.3, { damping: 8, stiffness: 400 }),
      withSpring(1, { damping: 8, stiffness: 400 })
    );

    onPress?.();
  };

  const containerAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: scale.value },
      { rotate: `${rotation.value}deg` },
    ],
  }));

  const glowAnimatedStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
    transform: [{ scale: glowScale.value }],
  }));

  const Container = onPress ? Pressable : View;

  return (
    <Container onPress={onPress ? handlePress : undefined}>
      <Animated.View
        style={[
          styles.container,
          {
            width: dimensions.container,
            height: dimensions.container,
            borderRadius: dimensions.container / 2,
          },
          containerAnimatedStyle,
        ]}
      >
        {showGlow && (
          <Animated.View
            style={[
              styles.glow,
              {
                width: dimensions.glow,
                height: dimensions.glow,
                borderRadius: dimensions.glow / 2,
                backgroundColor: badge.glowColor,
              },
              glowAnimatedStyle,
            ]}
          />
        )}
        <View
          style={[
            styles.badgeCircle,
            {
              width: dimensions.container,
              height: dimensions.container,
              borderRadius: dimensions.container / 2,
              backgroundColor: badge.color,
            },
          ]}
        >
          <Text style={[styles.emoji, { fontSize: dimensions.emoji }]}>
            {badge.icon}
          </Text>
        </View>
      </Animated.View>
    </Container>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  glow: {
    position: 'absolute',
  },
  badgeCircle: {
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  emoji: {
    textAlign: 'center',
  },
});
