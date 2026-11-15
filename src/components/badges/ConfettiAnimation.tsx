/**
 * ConfettiAnimation - Particle burst effect for celebrations
 */
import React, { useEffect, useMemo } from 'react';
import { StyleSheet, Dimensions, View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  Easing,
} from 'react-native-reanimated';

interface ConfettiAnimationProps {
  color: string;
  particleCount?: number;
}

interface Particle {
  id: number;
  x: number;
  delay: number;
  rotation: number;
  color: string;
  size: number;
  shape: 'circle' | 'square' | 'triangle';
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const COLORS = [
  '#FFD700', // Gold
  '#FF6B6B', // Coral
  '#4ECDC4', // Teal
  '#A855F7', // Purple
  '#F97316', // Orange
  '#22C55E', // Green
  '#3B82F6', // Blue
  '#EC4899', // Pink
];

function ConfettiParticle({ particle }: { particle: Particle }) {
  const translateY = useSharedValue(-100);
  const translateX = useSharedValue(0);
  const rotation = useSharedValue(0);
  const opacity = useSharedValue(1);
  const scale = useSharedValue(0);

  useEffect(() => {
    const duration = 2500 + Math.random() * 1000;
    const horizontalDrift = (Math.random() - 0.5) * 200;

    scale.value = withDelay(
      particle.delay,
      withTiming(1, { duration: 200, easing: Easing.out(Easing.back(2)) })
    );

    translateY.value = withDelay(
      particle.delay,
      withTiming(SCREEN_HEIGHT + 100, {
        duration,
        easing: Easing.in(Easing.quad),
      })
    );

    translateX.value = withDelay(
      particle.delay,
      withTiming(horizontalDrift, {
        duration,
        easing: Easing.inOut(Easing.ease),
      })
    );

    rotation.value = withDelay(
      particle.delay,
      withTiming(particle.rotation + 720 * (Math.random() > 0.5 ? 1 : -1), {
        duration,
        easing: Easing.linear,
      })
    );

    opacity.value = withDelay(
      particle.delay + duration * 0.7,
      withTiming(0, { duration: duration * 0.3 })
    );
  }, [translateY, translateX, rotation, opacity, scale, particle]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { rotate: `${rotation.value}deg` },
      { scale: scale.value },
    ],
    opacity: opacity.value,
  }));

  const shapeStyle = useMemo(() => {
    const baseStyle = {
      width: particle.size,
      height: particle.size,
      backgroundColor: particle.color,
    };

    switch (particle.shape) {
      case 'circle':
        return {
          ...baseStyle,
          borderRadius: particle.size / 2,
        };
      case 'square':
        return {
          ...baseStyle,
          borderRadius: 2,
        };
      case 'triangle':
        return {
          width: 0,
          height: 0,
          backgroundColor: 'transparent',
          borderLeftWidth: particle.size / 2,
          borderRightWidth: particle.size / 2,
          borderBottomWidth: particle.size,
          borderLeftColor: 'transparent',
          borderRightColor: 'transparent',
          borderBottomColor: particle.color,
        };
      default:
        return baseStyle;
    }
  }, [particle]);

  return (
    <Animated.View
      style={[
        styles.particle,
        { left: particle.x },
        animatedStyle,
      ]}
    >
      <View style={shapeStyle} />
    </Animated.View>
  );
}

export function ConfettiAnimation({
  color,
  particleCount = 50,
}: ConfettiAnimationProps) {
  const particles = useMemo<Particle[]>(() => {
    const shapes: ('circle' | 'square' | 'triangle')[] = ['circle', 'square', 'triangle'];
    const allColors = [color, ...COLORS];

    return Array.from({ length: particleCount }, (_, i) => ({
      id: i,
      x: Math.random() * SCREEN_WIDTH,
      delay: Math.random() * 500,
      rotation: Math.random() * 360,
      color: allColors[Math.floor(Math.random() * allColors.length)],
      size: 8 + Math.random() * 10,
      shape: shapes[Math.floor(Math.random() * shapes.length)],
    }));
  }, [color, particleCount]);

  return (
    <View style={styles.container} pointerEvents="none">
      {particles.map((particle) => (
        <ConfettiParticle key={particle.id} particle={particle} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  particle: {
    position: 'absolute',
    top: 0,
  },
});
