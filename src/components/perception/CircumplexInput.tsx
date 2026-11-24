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
  Platform,
} from 'react-native';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Colors, Spacing, Radius } from '../../theme/colors';
import { CircumplexPerception } from '../../types/recording';
import { t, getLanguage } from '../../i18n';

const PIN_SIZE = 54;

interface Props {
  value: CircumplexPerception;
  hasSelection: boolean;
  onChange: (value: CircumplexPerception) => void;
  onConfirm: () => void;
  /** Back to the previous step of the questionnaire. */
  onBack?: () => void;
}

// Quadrant definitions
const QUADRANTS = {
  // Muted data colours (theme DataColors) on near-neutral backgrounds.
  vibrant: {
    label: 'Vibrant',
    color: '#5E8068',
    bg: '#EDF2EE',
  },
  chaotic: {
    label: 'Chaotic',
    color: '#A4664F',
    bg: '#F5ECE7',
  },
  calm: {
    label: 'Calm',
    color: '#4F6F86',
    bg: '#EAF0F4',
  },
  monotonous: {
    label: 'Monotonous',
    color: '#7A756C',
    bg: '#F0EEEA',
  },
};

export default function CircumplexInput({
  value,
  hasSelection,
  onChange,
  onConfirm,
  onBack,
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

  // Derived on every render, so the pin stays right when the pad changes
  // size (keyboard closing, rotation).
  const pinPosition = valueToPosition(value);

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

  // The responder is created once, so it must call the handlers of the
  // current render. Otherwise it keeps the pad size of the first render and
  // records wrong positions after the screen area changed.
  const handlers = useRef({ grant: handlePanGrant, move: handlePanMove, release: handlePanRelease });
  handlers.current = { grant: handlePanGrant, move: handlePanMove, release: handlePanRelease };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      // Keep the gesture when the finger moves vertically over a scroll view.
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (evt) => handlers.current.grant(evt),
      onPanResponderMove: (evt) => handlers.current.move(evt),
      onPanResponderRelease: () => handlers.current.release(),
      onPanResponderTerminate: () => handlers.current.release(),
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

  const axisStrength = (axisValue: number) => Math.round(Math.abs(axisValue) * 100);
  const pleasantLabel = value.pleasant >= 0 ? t('Pleasant') : t('Annoying');
  const eventfulLabel = value.eventful >= 0 ? t('Eventful') : t('Uneventful');
  const intensity = Math.sqrt((value.pleasant ** 2) + (value.eventful ** 2));
  const intensityPrefix = intensity < 0.2
    ? t('Neutral')
    : intensity < 0.45
      ? t('Slightly')
      : intensity < 0.7
        ? t('Moderately')
        : t('Strongly');

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
          <Text style={styles.title}>{t('Perceptual Assessment')}</Text>
          <Text style={styles.subtitle}>
            {hasSelection
              ? t('Place the marker where the experience felt right')
              : t('Tap once or drag to set the soundscape position')}
          </Text>
        </View>

        {/* Circumplex Plane - Fullscreen */}
        <View
          style={[styles.planeContainer, { width: PLANE_SIZE, height: PLANE_SIZE }, webTouchStyle]}
          {...panResponder.panHandlers}
          accessible
          accessibilityRole="adjustable"
          accessibilityLabel={t('Perceptual circumplex plane')}
          accessibilityHint={t('Tap or drag within the plane to set pleasantness and eventfulness')}
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
            <Text style={styles.axisLabel}>{t('EVENTFUL')}</Text>
          </View>
          <View style={[styles.axisLabelContainer, styles.labelBottom]} pointerEvents="none">
            <Text style={styles.axisLabel}>{t('UNEVENTFUL')}</Text>
          </View>
          <View style={[styles.axisLabelContainer, styles.labelLeft]} pointerEvents="none">
            <Text style={[styles.axisLabel, styles.axisLabelVertical]}>{t('ANNOYING')}</Text>
          </View>
          <View style={[styles.axisLabelContainer, styles.labelRight]} pointerEvents="none">
            <Text style={[styles.axisLabel, styles.axisLabelVertical]}>{t('PLEASANT')}</Text>
          </View>

          {/* Quadrant labels - larger font */}
          <Text style={[styles.quadrantLabel, styles.quadrantTopLeft]}>{t('Chaotic')}</Text>
          <Text style={[styles.quadrantLabel, styles.quadrantTopRight]}>{t('Vibrant')}</Text>
          <Text style={[styles.quadrantLabel, styles.quadrantBottomLeft]}>{t('Monotonous')}</Text>
          <Text style={[styles.quadrantLabel, styles.quadrantBottomRight]}>{t('Calm')}</Text>

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
              <Text style={styles.touchHintText}>{t('Tap or drag anywhere')}</Text>
            </View>
          )}
        </View>

        {/* Data Display - Compact */}
        <View style={styles.dataSection}>
          <View style={[styles.quadrantBadge, { backgroundColor: quadrantInfo.bg }]}>
            <View style={[styles.quadrantDot, { backgroundColor: quadrantInfo.color }]} />
            <Text style={[styles.quadrantBadgeText, { color: quadrantInfo.color }]}>
              {intensity < 0.2 ? t('Neutral') : `${intensityPrefix} ${getLanguage() === 'de' ? t(quadrantInfo.label).toLowerCase() : t(quadrantInfo.label)}`}
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
              accessibilityLabel={t('Reset perceptual marker')}
              accessibilityHint={t('Return the perceptual marker to the neutral center position')}
              onPress={() => {
                onChange({ pleasant: 0, eventful: 0 });
                Haptics.selectionAsync();
              }}
            >
              <MaterialIcons name="restart-alt" size={16} color={Colors.textMuted} />
              <Text style={styles.resetButtonText}>{t('Reset')}</Text>
            </TouchableOpacity>
          </View>

        </View>
      </ScrollView>

      {/* Footer - Floating at bottom */}
      <View style={[styles.footer, { paddingBottom: footerBottomPadding }]}>
        {onBack ? (
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => {
              Haptics.selectionAsync();
              onBack();
            }}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={t('Back')}
          >
            <MaterialIcons name="arrow-back" size={22} color={Colors.text} />
          </TouchableOpacity>
        ) : null}
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
          accessibilityLabel={t('Continue from perceptual assessment')}
          accessibilityHint={t('Save the current pleasantness and eventfulness position and continue')}
          accessibilityState={{ disabled: !hasSelection }}
        >
          <Text style={styles.confirmButtonText}>{t('Continue')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// In the browser a drag on the pad must not scroll the page.
const webTouchStyle = Platform.OS === 'web'
  ? ({ touchAction: 'none', userSelect: 'none' } as object)
  : null;

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
    backgroundColor: '#FFFFFF',
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
    backgroundColor: '#FFFFFF',
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
    backgroundColor: '#FFFFFFEE',
    borderWidth: 2.5,
    borderColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinActive: {
    backgroundColor: '#FFFFFF',
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
    backgroundColor: '#FFFFFF',
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
  footer: {
    flexDirection: 'row',
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.surfaceHighlight,
    backgroundColor: Colors.background,
    paddingTop: 18,
    paddingHorizontal: Spacing.lg,
  },
  backButton: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.surfaceHighlight,
  },
  confirmButton: {
    flex: 1,
    backgroundColor: Colors.primary,
    height: 58,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
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
