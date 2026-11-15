import React, { useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Animated,
  Dimensions,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import * as Haptics from 'expo-haptics';
import { Colors, Spacing } from '../../theme/colors';
import { PAQPerception } from '../../types/recording';

const RING_COUNT = 5;

// PAQ attributes in ISO 12913-2 order (clockwise from top)
const PAQ_ATTRIBUTES: {
  key: keyof PAQPerception;
  label: string;
  color: string;
  angle: number;
}[] = [
  { key: 'eventful', label: 'Eventful', color: '#F59E0B', angle: 0 },
  { key: 'chaotic', label: 'Chaotic', color: '#EF4444', angle: 45 },
  { key: 'annoying', label: 'Annoying', color: '#DC2626', angle: 90 },
  { key: 'monotonous', label: 'Monotonous', color: '#6B7280', angle: 135 },
  { key: 'uneventful', label: 'Uneventful', color: '#3B82F6', angle: 180 },
  { key: 'calm', label: 'Calm', color: '#06B6D4', angle: 225 },
  { key: 'pleasant', label: 'Pleasant', color: '#22C55E', angle: 270 },
  { key: 'vibrant', label: 'Vibrant', color: '#84CC16', angle: 315 },
];

interface Props {
  value: PAQPerception;
  onChange: (value: PAQPerception) => void;
  onConfirm: () => void;
  onSkip?: () => void;
}

interface AttributeControlProps {
  attribute: (typeof PAQ_ATTRIBUTES)[0];
  value: number;
  onChange: (value: number) => void;
  wheelSize: number;
  center: number;
}

function AttributeControl({ attribute, value, onChange, wheelSize, center }: AttributeControlProps) {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  // Calculate position on the wheel edge
  const angleRad = (attribute.angle - 90) * (Math.PI / 180);
  const radius = wheelSize / 2 - 24;
  const x = center + radius * Math.cos(angleRad);
  const y = center + radius * Math.sin(angleRad);

  const handlePress = (newValue: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onChange(newValue);

    // Pulse animation
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 1.1,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();
  };

  return (
    <Animated.View
      style={[
        styles.attributeContainer,
        {
          left: x - 40,
          top: y - 50,
          transform: [{ scale: scaleAnim }],
        },
      ]}
    >
      <Text style={[styles.attributeLabel, { color: attribute.color }]}>
        {attribute.label}
      </Text>
      <View style={styles.ratingDots}>
        {[1, 2, 3, 4, 5].map((rating) => {
          const isSelected = value >= rating;
          const isExact = value === rating;
          return (
            <TouchableOpacity
              key={rating}
              onPress={() => handlePress(rating)}
              activeOpacity={0.7}
              hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
            >
              <View
                style={[
                  styles.ratingDot,
                  isSelected && { backgroundColor: attribute.color },
                  isExact && styles.ratingDotExact,
                ]}
              />
            </TouchableOpacity>
          );
        })}
      </View>
    </Animated.View>
  );
}

export default function PAQWheel({ value, onChange, onConfirm, onSkip }: Props) {
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();

  // Calculate wheel size: 90% of screen width, but leave room for labels
  const WHEEL_SIZE = Math.min(screenWidth * 0.92, screenHeight * 0.48);
  const CENTER = WHEEL_SIZE / 2;

  const handleRatingChange = (attribute: keyof PAQPerception, rating: number) => {
    onChange({
      ...value,
      [attribute]: rating,
    });
  };

  // Calculate polygon points for the filled shape
  const getPolygonPoints = () => {
    return PAQ_ATTRIBUTES.map((attr) => {
      const rating = value[attr.key] || 0;
      const normalizedRating = rating / 5;
      const angleRad = (attr.angle - 90) * (Math.PI / 180);
      const maxRadius = (WHEEL_SIZE / 2 - 60) * normalizedRating;
      return {
        x: CENTER + maxRadius * Math.cos(angleRad),
        y: CENTER + maxRadius * Math.sin(angleRad),
      };
    });
  };

  const polygonPoints = getPolygonPoints();
  const ratedCount = PAQ_ATTRIBUTES.filter((attr) => value[attr.key] > 0).length;
  const isComplete = ratedCount === 8;
  const footerBottomPadding = tabBarHeight + 16;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Detailed PAQ</Text>
        <Text style={styles.subtitle}>
          Optional: rate the eight perceptual attributes in more detail
        </Text>
      </View>

      <View style={[styles.wheelContainer, { width: WHEEL_SIZE, height: WHEEL_SIZE }]}>
        {/* Concentric rings */}
        {[...Array(RING_COUNT)].map((_, i) => {
          const ringRadius = ((i + 1) / RING_COUNT) * (WHEEL_SIZE / 2 - 60);
          return (
            <View
              key={i}
              style={[
                styles.ring,
                {
                  width: ringRadius * 2,
                  height: ringRadius * 2,
                  borderRadius: ringRadius,
                  left: CENTER - ringRadius,
                  top: CENTER - ringRadius,
                },
              ]}
            />
          );
        })}

        {/* Axis lines */}
        {PAQ_ATTRIBUTES.map((attr) => {
          const angleRad = (attr.angle - 90) * (Math.PI / 180);
          const endX = CENTER + (WHEEL_SIZE / 2 - 60) * Math.cos(angleRad);
          const endY = CENTER + (WHEEL_SIZE / 2 - 60) * Math.sin(angleRad);

          return (
            <View
              key={attr.key}
              style={[
                styles.axisLine,
                {
                  width: Math.sqrt(Math.pow(endX - CENTER, 2) + Math.pow(endY - CENTER, 2)),
                  left: CENTER,
                  top: CENTER,
                  transform: [
                    { translateX: -1 },
                    { rotate: `${attr.angle}deg` },
                    { translateX: (WHEEL_SIZE / 2 - 60) / 2 },
                  ],
                },
              ]}
            />
          );
        })}

        {/* Filled perception shape */}
        {ratedCount > 0 && (
          <View style={styles.shapeContainer} pointerEvents="none">
            {/* Draw filled shape using overlapping triangles from center */}
            {polygonPoints.map((point, i) => {
              const nextPoint = polygonPoints[(i + 1) % polygonPoints.length];
              if (value[PAQ_ATTRIBUTES[i].key] === 0 && value[PAQ_ATTRIBUTES[(i + 1) % 8].key] === 0) {
                return null;
              }
              return (
                <View
                  key={i}
                  style={[
                    styles.shapeSegment,
                    {
                      position: 'absolute',
                      left: CENTER - 5,
                      top: CENTER - 5,
                      width: 10,
                      height: 10,
                      backgroundColor: `${PAQ_ATTRIBUTES[i].color}40`,
                      borderRadius: 5,
                      transform: [
                        { translateX: (point.x - CENTER) * 0.9 },
                        { translateY: (point.y - CENTER) * 0.9 },
                      ],
                    },
                  ]}
                />
              );
            })}
          </View>
        )}

        {/* Center indicator */}
        <View style={[styles.centerDot, { left: CENTER - 28, top: CENTER - 28 }]}>
          <Text style={styles.centerText}>{ratedCount}/8</Text>
        </View>

        {/* Attribute controls */}
        {PAQ_ATTRIBUTES.map((attr) => (
          <AttributeControl
            key={attr.key}
            attribute={attr}
            value={value[attr.key]}
            onChange={(rating) => handleRatingChange(attr.key, rating)}
            wheelSize={WHEEL_SIZE}
            center={CENTER}
          />
        ))}
      </View>

      {/* Legend */}
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, styles.legendDotEmpty]} />
          <Text style={styles.legendText}>1 = Not at all</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, styles.legendDotFilled]} />
          <Text style={styles.legendText}>5 = Completely</Text>
        </View>
      </View>

      {/* Buttons - Fixed at bottom */}
      <View style={[styles.buttonContainer, { paddingBottom: footerBottomPadding }]}>
        {onSkip && (
          <TouchableOpacity
            style={styles.skipButton}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onSkip();
            }}
            activeOpacity={0.7}
          >
            <Text style={styles.skipButtonText}>Skip and continue</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[styles.confirmButton, !isComplete && styles.confirmButtonDisabled]}
          onPress={() => {
            if (isComplete) {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              onConfirm();
            }
          }}
          disabled={!isComplete}
          activeOpacity={0.8}
        >
          <Text style={styles.confirmButtonText}>
            {isComplete ? 'Continue' : `Rate ${8 - ratedCount} more`}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    alignItems: 'center',
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
    paddingHorizontal: Spacing.lg,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 15,
    color: Colors.textMuted,
    textAlign: 'center',
  },
  wheelContainer: {
    alignSelf: 'center',
    position: 'relative',
  },
  ring: {
    position: 'absolute',
    borderWidth: 1,
    borderColor: Colors.surfaceHighlight,
  },
  axisLine: {
    position: 'absolute',
    height: 1,
    backgroundColor: Colors.surfaceHighlight,
    transformOrigin: 'left center',
  },
  shapeContainer: {
    position: 'absolute',
    width: '100%',
    height: '100%',
  },
  shapeSegment: {
    position: 'absolute',
  },
  centerDot: {
    position: 'absolute',
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.surface,
    borderWidth: 2,
    borderColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerText: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.primary,
  },
  attributeContainer: {
    position: 'absolute',
    width: 80,
    alignItems: 'center',
  },
  attributeLabel: {
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  ratingDots: {
    flexDirection: 'row',
    gap: 4,
  },
  ratingDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: Colors.surfaceHighlight,
    borderWidth: 1,
    borderColor: Colors.surfaceHighlight,
  },
  ratingDotExact: {
    borderWidth: 2,
    borderColor: Colors.text,
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 24,
    marginTop: Spacing.sm,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  legendDotEmpty: {
    backgroundColor: Colors.surfaceHighlight,
  },
  legendDotFilled: {
    backgroundColor: Colors.primary,
  },
  legendText: {
    fontSize: 13,
    color: Colors.textMuted,
  },
  buttonContainer: {
    marginTop: 'auto',
    paddingHorizontal: Spacing.lg,
    gap: 8,
  },
  skipButton: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  skipButtonText: {
    color: Colors.textMuted,
    fontSize: 15,
    fontWeight: '600',
  },
  confirmButton: {
    backgroundColor: Colors.primary,
    paddingVertical: 18,
    borderRadius: 100,
    alignItems: 'center',
  },
  confirmButtonDisabled: {
    backgroundColor: Colors.surfaceHighlight,
  },
  confirmButtonText: {
    color: Colors.background,
    fontSize: 17,
    fontWeight: '700',
  },
});
