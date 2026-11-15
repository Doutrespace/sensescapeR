import React, { useState, useRef, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  PanResponder,
  TouchableOpacity,
  Animated,
  useWindowDimensions,
  ScrollView,
} from 'react-native';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Colors, Spacing, Radius } from '../../theme/colors';
import { CircumplexPerception } from '../../types/recording';
import { calculatePAQFromCircumplex } from '../../services/database/perceptions';

const PIN_SIZE = 54;

interface Props {
  value: CircumplexPerception;
  hasSelection: boolean;
  onChange: (value: CircumplexPerception) => void;
  onConfirm: () => void;
}

// Quadrant definitions
const QUADRANTS = {
  vibrant: {
    label: 'Vibrant',
    color: '#8FA37E',
    bg: '#DDE8D5',
  },
  chaotic: {
    label: 'Chaotic',
    color: '#BC5B4F',
    bg: '#E8C9C4',
  },
  calm: {
    label: 'Calm',
    color: '#3B6E8C',
    bg: '#CADBE6',
  },
  monotonous: {
    label: 'Monotonous',
    color: '#94666E',
    bg: '#DECED1',
  },
};

export default function CircumplexInput({
  value,
  hasSelection,
  onChange,
  onConfirm,
}: Props) {
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const tabBarHeight = useBottomTabBarHeight();

  // Calculate plane size: 85% of screen width, but leave room for labels
  const PLANE_SIZE = Math.min(screenWidth * 0.88, screenHeight * 0.45);
  const CENTER = PLANE_SIZE / 2;

  const [isDragging, setIsDragging] = useState(false);
  const pinScaleAnim = useRef(new Animated.Value(1)).current;
  const lastHapticRef = useRef(0);

  // Convert value to position
  const valueToPosition = useCallback((v: CircumplexPerception) => ({
    x: v.pleasant * (PLANE_SIZE / 2),
    y: -v.eventful * (PLANE_SIZE / 2),
  }), [PLANE_SIZE]);

  const [pinPosition, setPinPosition] = useState(() => valueToPosition(value));

  const triggerHaptic = useCallback(() => {
    const now = Date.now();
    if (now - lastHapticRef.current > 80) {
      Haptics.selectionAsync();
      lastHapticRef.current = now;
    }
  }, []);

  const updateFromPosition = useCallback((x: number, y: number) => {
    const halfSize = PLANE_SIZE / 2;
    const constrainedX = Math.max(-halfSize, Math.min(halfSize, x));
    const constrainedY = Math.max(-halfSize, Math.min(halfSize, y));

    setPinPosition({ x: constrainedX, y: constrainedY });

    const pleasant = constrainedX / halfSize;
    const eventful = -constrainedY / halfSize;
    onChange({ pleasant, eventful });

    triggerHaptic();
  }, [onChange, triggerHaptic, PLANE_SIZE]);

  const handlePanGrant = useCallback((evt: any) => {
    setIsDragging(true);
    Animated.spring(pinScaleAnim, {
      toValue: 1.15,
      useNativeDriver: true,
      tension: 400,
      friction: 15,
    }).start();

    const { locationX, locationY } = evt.nativeEvent;
    updateFromPosition(locationX - CENTER, locationY - CENTER);
  }, [pinScaleAnim, updateFromPosition, CENTER]);

  const handlePanMove = useCallback((evt: any) => {
    const { locationX, locationY } = evt.nativeEvent;
    updateFromPosition(locationX - CENTER, locationY - CENTER);
  }, [updateFromPosition, CENTER]);

  const handlePanRelease = useCallback(() => {
    setIsDragging(false);
    Animated.spring(pinScaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      tension: 400,
      friction: 15,
    }).start();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [pinScaleAnim]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: handlePanGrant,
      onPanResponderMove: handlePanMove,
      onPanResponderRelease: handlePanRelease,
      onPanResponderTerminate: handlePanRelease,
    })
  ).current;

  // Get current quadrant
  const getQuadrant = () => {
    if (value.pleasant >= 0 && value.eventful >= 0) return 'vibrant';
    if (value.pleasant < 0 && value.eventful >= 0) return 'chaotic';
    if (value.pleasant >= 0 && value.eventful < 0) return 'calm';
    return 'monotonous';
  };

  const currentQuadrant = getQuadrant();
  const quadrantInfo = QUADRANTS[currentQuadrant];
  const derivedPaq = calculatePAQFromCircumplex(value);

  const axisStrength = (axisValue: number) => Math.round(Math.abs(axisValue) * 100);
  const pleasantLabel = value.pleasant >= 0 ? 'Pleasant' : 'Annoying';
  const eventfulLabel = value.eventful >= 0 ? 'Eventful' : 'Uneventful';
  const intensity = Math.sqrt((value.pleasant ** 2) + (value.eventful ** 2));
  const intensityPrefix = intensity < 0.2
    ? 'Neutral'
    : intensity < 0.45
      ? 'Slightly'
      : intensity < 0.7
        ? 'Moderately'
        : 'Strongly';

  // Calculate footer bottom padding for tab bar
  const footerBottomPadding = tabBarHeight + 16;

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: footerBottomPadding + 110 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Perceptual Assessment</Text>
          <Text style={styles.subtitle}>
            {hasSelection
              ? 'Place the marker where the experience felt right'
              : 'Tap once or drag to set the soundscape position'}
          </Text>
        </View>

        {/* Circumplex Plane - Fullscreen */}
        <View
          style={[styles.planeContainer, { width: PLANE_SIZE, height: PLANE_SIZE }]}
          {...panResponder.panHandlers}
          accessible
          accessibilityRole="adjustable"
          accessibilityLabel="Perceptual circumplex plane"
          accessibilityHint="Tap or drag within the plane to set pleasantness and eventfulness"
          accessibilityValue={{
            text: `${pleasantLabel} ${axisStrength(value.pleasant)} percent, ${eventfulLabel} ${axisStrength(value.eventful)} percent`,
          }}
        >
          {/* Quadrant backgrounds */}
          <View style={styles.quadrants} pointerEvents="none">
            <View style={[styles.quadrant, { backgroundColor: QUADRANTS.chaotic.bg }]} />
            <View style={[styles.quadrant, { backgroundColor: QUADRANTS.vibrant.bg }]} />
            <View style={[styles.quadrant, { backgroundColor: QUADRANTS.monotonous.bg }]} />
            <View style={[styles.quadrant, { backgroundColor: QUADRANTS.calm.bg }]} />
          </View>

          {/* Grid lines */}
          <View style={styles.gridContainer} pointerEvents="none">
            {/* Horizontal lines */}
            <View style={[styles.gridLine, styles.gridHorizontal, { top: '25%' }]} />
            <View style={[styles.gridLine, styles.gridHorizontal, { top: '50%' }]} />
            <View style={[styles.gridLine, styles.gridHorizontal, { top: '75%' }]} />
            {/* Vertical lines */}
            <View style={[styles.gridLine, styles.gridVertical, { left: '25%' }]} />
            <View style={[styles.gridLine, styles.gridVertical, { left: '50%' }]} />
            <View style={[styles.gridLine, styles.gridVertical, { left: '75%' }]} />
          </View>

          {/* Main axes */}
          <View style={styles.axisX} />
          <View style={styles.axisY} />

          {/* Axis labels */}
          <View style={[styles.axisLabelContainer, styles.labelTop]} pointerEvents="none">
            <Text style={styles.axisLabel}>EVENTFUL</Text>
          </View>
          <View style={[styles.axisLabelContainer, styles.labelBottom]} pointerEvents="none">
            <Text style={styles.axisLabel}>UNEVENTFUL</Text>
          </View>
          <View style={[styles.axisLabelContainer, styles.labelLeft]} pointerEvents="none">
            <Text style={[styles.axisLabel, styles.axisLabelVertical]}>ANNOYING</Text>
          </View>
          <View style={[styles.axisLabelContainer, styles.labelRight]} pointerEvents="none">
            <Text style={[styles.axisLabel, styles.axisLabelVertical]}>PLEASANT</Text>
          </View>

          {/* Quadrant labels - larger font */}
          <Text style={[styles.quadrantLabel, styles.quadrantTopLeft]}>Chaotic</Text>
          <Text style={[styles.quadrantLabel, styles.quadrantTopRight]}>Vibrant</Text>
          <Text style={[styles.quadrantLabel, styles.quadrantBottomLeft]}>Monotonous</Text>
          <Text style={[styles.quadrantLabel, styles.quadrantBottomRight]}>Calm</Text>

          {/* Guide lines */}
          <View
            pointerEvents="none"
            style={[
              styles.guideLineVertical,
              {
                left: CENTER - 0.5 + pinPosition.x,
              },
            ]}
          />
          <View
            pointerEvents="none"
            style={[
              styles.guideLineHorizontal,
              {
                top: CENTER - 0.5 + pinPosition.y,
              },
            ]}
          />

          {/* Draggable pin */}
          <Animated.View
            pointerEvents="none"
            style={[
              styles.pin,
              isDragging && styles.pinActive,
              {
                left: CENTER - PIN_SIZE / 2,
                top: CENTER - PIN_SIZE / 2,
                width: PIN_SIZE,
                height: PIN_SIZE,
                borderRadius: PIN_SIZE / 2,
                transform: [
                  { translateX: pinPosition.x },
                  { translateY: pinPosition.y },
                  { scale: pinScaleAnim },
                ],
              },
            ]}
          >
            <View style={[styles.pinCore, isDragging && styles.pinCoreActive]} />
          </Animated.View>

          {/* Touch hint overlay when not dragging */}
          {!isDragging && (
            <View style={styles.touchHint} pointerEvents="none">
              <Text style={styles.touchHintText}>Tap or drag anywhere</Text>
            </View>
          )}
        </View>

        {/* Data Display - Compact */}
        <View style={styles.dataSection}>
          <View style={[styles.quadrantBadge, { backgroundColor: quadrantInfo.bg }]}>
            <View style={[styles.quadrantDot, { backgroundColor: quadrantInfo.color }]} />
            <Text style={[styles.quadrantBadgeText, { color: quadrantInfo.color }]}>
              {intensityPrefix === 'Neutral' ? 'Neutral' : `${intensityPrefix} ${quadrantInfo.label}`}
            </Text>
          </View>

          <View style={styles.summaryRow}>
            <View style={styles.summaryMetric}>
              <Text style={styles.summaryLabel}>{pleasantLabel}</Text>
              <Text style={styles.summaryValue}>{axisStrength(value.pleasant)}%</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryMetric}>
              <Text style={styles.summaryLabel}>{eventfulLabel}</Text>
              <Text style={styles.summaryValue}>{axisStrength(value.eventful)}%</Text>
            </View>
            <TouchableOpacity
              style={styles.resetButton}
              accessibilityRole="button"
              accessibilityLabel="Reset perceptual marker"
              accessibilityHint="Return the perceptual marker to the neutral center position"
              onPress={() => {
                setPinPosition({ x: 0, y: 0 });
                onChange({ pleasant: 0, eventful: 0 });
                Haptics.selectionAsync();
              }}
            >
              <MaterialIcons name="restart-alt" size={16} color={Colors.textMuted} />
              <Text style={styles.resetButtonText}>Reset</Text>
            </TouchableOpacity>
          </View>

          <View
            style={styles.paqSection}
            accessible
            accessibilityLabel="Derived perceptual attribute questionnaire values"
          >
            <Text style={styles.paqTitle}>Derived PAQ values</Text>
            <View style={styles.paqGrid}>
              {[
                ['Pleasant', derivedPaq.pleasant],
                ['Vibrant', derivedPaq.vibrant],
                ['Eventful', derivedPaq.eventful],
                ['Chaotic', derivedPaq.chaotic],
                ['Annoying', derivedPaq.annoying],
                ['Monotonous', derivedPaq.monotonous],
                ['Uneventful', derivedPaq.uneventful],
                ['Calm', derivedPaq.calm],
              ].map(([label, score]) => (
                <View key={label} style={styles.paqChip}>
                  <Text style={styles.paqChipLabel}>{label}</Text>
                  <Text style={styles.paqChipValue}>{score}/5</Text>
                </View>
              ))}
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Footer - Floating at bottom */}
      <View style={[styles.footer, { paddingBottom: footerBottomPadding }]}>
        <TouchableOpacity
          style={[styles.confirmButton, !hasSelection && styles.confirmButtonDisabled]}
          onPress={() => {
            if (!hasSelection) {
              return;
            }
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            onConfirm();
          }}
          disabled={!hasSelection}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="Continue from perceptual assessment"
          accessibilityHint="Save the current pleasantness and eventfulness position and continue"
          accessibilityState={{ disabled: !hasSelection }}
        >
          <Text style={styles.confirmButtonText}>Continue</Text>
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 0,
  },
  header: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.4,
    color: Colors.text,
    marginBottom: 6,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: Colors.textMuted,
    lineHeight: 19,
    textAlign: 'center',
  },
  planeContainer: {
    alignSelf: 'center',
    position: 'relative',
    borderRadius: Radius.lg,
    overflow: 'hidden',
    backgroundColor: '#F8F5EE',
    borderWidth: 1,
    borderColor: Colors.surfaceHighlight,
  },
  quadrants: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  quadrant: {
    width: '50%',
    height: '50%',
  },
  gridContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  gridLine: {
    position: 'absolute',
    backgroundColor: Colors.surfaceHighlight,
    opacity: 0.35,
  },
  gridHorizontal: {
    left: 0,
    right: 0,
    height: 1,
  },
  gridVertical: {
    top: 0,
    bottom: 0,
    width: 1,
  },
  axisX: {
    position: 'absolute',
    top: '50%',
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: Colors.textMuted,
    opacity: 0.22,
  },
  axisY: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: '50%',
    width: 2,
    backgroundColor: Colors.textMuted,
    opacity: 0.22,
  },
  guideLineVertical: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: '#17171726',
  },
  guideLineHorizontal: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: '#17171726',
  },
  axisLabelContainer: {
    position: 'absolute',
    backgroundColor: '#F8F5EE',
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  axisLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: Colors.textMuted,
    letterSpacing: 1,
  },
  axisLabelVertical: {
    // Keep text horizontal for readability
  },
  labelTop: {
    top: 4,
    left: '50%',
    transform: [{ translateX: -28 }],
  },
  labelBottom: {
    bottom: 4,
    left: '50%',
    transform: [{ translateX: -36 }],
  },
  labelLeft: {
    left: 4,
    top: '50%',
    transform: [{ translateY: -8 }],
  },
  labelRight: {
    right: 4,
    top: '50%',
    transform: [{ translateY: -8 }],
  },
  quadrantLabel: {
    position: 'absolute',
    fontSize: 10,
    fontWeight: '600',
    color: Colors.textMuted,
    opacity: 0.72,
  },
  quadrantTopLeft: {
    top: 22,
    left: 8,
  },
  quadrantTopRight: {
    top: 22,
    right: 8,
  },
  quadrantBottomLeft: {
    bottom: 22,
    left: 8,
  },
  quadrantBottomRight: {
    bottom: 22,
    right: 8,
  },
  pin: {
    position: 'absolute',
    backgroundColor: '#FBF8F1EE',
    borderWidth: 2.5,
    borderColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinActive: {
    backgroundColor: '#FBF8F1',
    borderWidth: 3,
  },
  pinCore: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: Colors.primary,
  },
  pinCoreActive: {
    width: 20,
    height: 20,
    borderRadius: 10,
  },
  touchHint: {
    position: 'absolute',
    bottom: 8,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  touchHintText: {
    fontSize: 11,
    color: Colors.textMuted,
    backgroundColor: '#FBF8F1',
    paddingHorizontal: 10,
    paddingVertical: 2,
    borderRadius: Radius.full,
  },
  dataSection: {
    marginTop: 14,
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
  },
  quadrantBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: Radius.full,
    marginBottom: 12,
    gap: 6,
  },
  quadrantDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  quadrantBadgeText: {
    fontSize: 13,
    fontWeight: '700',
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: Colors.surfaceHighlight,
  },
  summaryMetric: {
    flex: 1,
    alignItems: 'center',
  },
  summaryDivider: {
    width: 1,
    height: 30,
    backgroundColor: Colors.surfaceHighlight,
    marginHorizontal: 12,
  },
  summaryLabel: {
    fontSize: 11,
    color: Colors.textMuted,
    marginBottom: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  summaryValue: {
    fontSize: 19,
    fontWeight: '800',
    color: Colors.text,
    fontVariant: ['tabular-nums'],
  },
  resetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: Radius.full,
    backgroundColor: Colors.secondaryMuted,
    marginLeft: 12,
  },
  resetButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textMuted,
  },
  paqSection: {
    alignSelf: 'stretch',
    marginTop: 12,
    padding: 12,
    borderRadius: Radius.md,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.surfaceHighlight,
  },
  paqTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  paqGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  paqChip: {
    width: '48%',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: Radius.sm,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.surfaceHighlight,
  },
  paqChipLabel: {
    fontSize: 11,
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  paqChipValue: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
    fontVariant: ['tabular-nums'],
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: Colors.surfaceHighlight,
    backgroundColor: Colors.background,
    paddingTop: 18,
    paddingHorizontal: Spacing.lg,
  },
  confirmButton: {
    backgroundColor: Colors.primary,
    paddingVertical: 18,
    borderRadius: Radius.full,
    alignItems: 'center',
  },
  confirmButtonDisabled: {
    opacity: 0.45,
  },
  confirmButtonText: {
    color: Colors.background,
    fontSize: 17,
    fontWeight: '700',
  },
});
