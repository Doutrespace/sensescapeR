import React, { useMemo, useRef, useState } from 'react';
import {
  LayoutChangeEvent,
  PanResponder,
  Platform,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { Colors } from '../../theme/colors';
import { t } from '../../i18n';

const THUMB_SIZE = 38;
const TRACK_HEIGHT = 10;
const TOUCH_HEIGHT = 56;
const TICK_SIZE = 6;

/** White or near-black, whichever reads better on the given hex colour. */
function readableTextOn(hexColor: string): string {
  const hex = hexColor.replace('#', '');
  if (hex.length !== 6) {
    return '#FFFFFF';
  }
  const [red, green, blue] = [0, 2, 4].map((offset) => {
    const channel = parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return channel <= 0.03928 ? channel / 12.92 : Math.pow((channel + 0.055) / 1.055, 2.4);
  });
  const luminance = 0.2126 * red + 0.7152 * green + 0.0722 * blue;
  return luminance > 0.3 ? Colors.text : '#FFFFFF';
}

interface Props {
  min: number;
  max: number;
  /** null = not rated yet (no thumb is shown). */
  value: number | null;
  onChange: (value: number) => void;
  minLabel: string;
  maxLabel: string;
  valueLabels?: Record<number, string>;
  /** Fill from the zero point instead of from the left edge. */
  bipolar?: boolean;
  /** Colour of the fill and thumb. */
  accentColor?: string;
  /** One colour per scale point; overrides accentColor for the current value. */
  stepColors?: string[];
  accessibilityLabel: string;
}

/**
 * Stepped slider for rating scales, sized for thumbs. Tap or drag along the
 * track; the thumb snaps to whole scale points. Starts without a thumb so an
 * unanswered item is visibly different from a midpoint rating.
 */
export function StepSlider({
  min,
  max,
  value,
  onChange,
  minLabel,
  maxLabel,
  valueLabels,
  bipolar = false,
  accentColor = Colors.primary,
  stepColors,
  accessibilityLabel,
}: Props) {
  const [trackWidth, setTrackWidth] = useState(0);
  const stepCount = max - min;

  // PanResponder is created once; keep what it needs in a ref.
  const latest = useRef({ min, max, value, onChange, trackWidth });
  latest.current = { min, max, value, onChange, trackWidth };
  // Touch position is tracked from the event itself rather than the gesture
  // state, which can skip moves that share a timestamp.
  const gestureStart = useRef({ locationX: 0, pageX: 0 });

  const setFromPosition = (positionX: number) => {
    const current = latest.current;
    const usable = current.trackWidth - THUMB_SIZE;
    if (usable <= 0) {
      return;
    }

    const ratio = Math.max(0, Math.min(1, (positionX - THUMB_SIZE / 2) / usable));
    const next = current.min + Math.round(ratio * (current.max - current.min));
    if (next !== current.value) {
      void Haptics.selectionAsync();
      current.onChange(next);
    }
  };

  const panResponder = useMemo(
    () => PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      // Only claim clearly horizontal drags so the page can still scroll.
      onMoveShouldSetPanResponder: (_event, gesture) => (
        Math.abs(gesture.dx) > Math.abs(gesture.dy)
      ),
      onPanResponderGrant: (event) => {
        const { locationX, pageX } = event.nativeEvent;
        gestureStart.current = { locationX, pageX };
        setFromPosition(locationX);
      },
      onPanResponderMove: (event) => {
        const start = gestureStart.current;
        setFromPosition(start.locationX + (event.nativeEvent.pageX - start.pageX));
      },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const positionFor = (scaleValue: number) => {
    const usable = Math.max(0, trackWidth - THUMB_SIZE);
    return THUMB_SIZE / 2 + ((scaleValue - min) / stepCount) * usable;
  };

  const colorFor = (scaleValue: number) => stepColors?.[scaleValue - min] ?? accentColor;

  const hasValue = value !== null;
  const activeColor = hasValue ? colorFor(value) : accentColor;
  const thumbX = hasValue ? positionFor(value) : 0;
  const fillStartX = bipolar && min < 0 && max > 0 ? positionFor(0) : THUMB_SIZE / 2;
  const fillLeft = Math.min(fillStartX, thumbX);
  const fillWidth = Math.abs(thumbX - fillStartX);

  const valueText = hasValue
    ? (valueLabels?.[value] ? t(valueLabels[value]) : t('{value} of {max}', { value, max }))
    : t('Tap or slide to rate');

  const handleLayout = (event: LayoutChangeEvent) => {
    setTrackWidth(event.nativeEvent.layout.width);
  };

  return (
    <View>
      <View
        style={[styles.touchArea, webTouchStyle]}
        onLayout={handleLayout}
        {...panResponder.panHandlers}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={accessibilityLabel}
        accessibilityHint={t('Tap or drag to rate from {min} to {max}', { min: minLabel, max: maxLabel })}
        accessibilityValue={{ min, max, now: hasValue ? value : undefined, text: valueText }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={(event) => {
          if (!hasValue) {
            onChange(Math.round((min + max) / 2));
            return;
          }
          const delta = event.nativeEvent.actionName === 'increment' ? 1 : -1;
          onChange(Math.max(min, Math.min(max, value + delta)));
        }}
      >
        <View style={styles.track} pointerEvents="none" />

        {trackWidth > 0 && (
          <>
            {hasValue && (
              <View
                pointerEvents="none"
                style={[styles.fill, { left: fillLeft, width: fillWidth, backgroundColor: activeColor }]}
              />
            )}

            {Array.from({ length: stepCount + 1 }, (_, index) => (
              <View
                key={index}
                pointerEvents="none"
                style={[
                  styles.tick,
                  { left: positionFor(min + index) - TICK_SIZE / 2 },
                  stepColors ? { backgroundColor: colorFor(min + index) } : null,
                ]}
              />
            ))}

            {hasValue && (
              <View
                pointerEvents="none"
                style={[styles.thumb, { left: thumbX - THUMB_SIZE / 2, borderColor: activeColor }]}
              >
                <Text style={styles.thumbText}>{value > 0 && bipolar ? `+${value}` : value}</Text>
              </View>
            )}
          </>
        )}
      </View>

      <View style={styles.labelRow}>
        <Text style={[styles.endLabel, styles.endLabelLeft]} numberOfLines={2}>{minLabel}</Text>
        <Text style={[styles.endLabel, styles.endLabelRight]} numberOfLines={2}>{maxLabel}</Text>
      </View>

      <View style={[styles.valuePill, hasValue && { backgroundColor: activeColor }]}>
        <Text
          style={[
            styles.valueText,
            hasValue && styles.valueTextActive,
            hasValue && { color: readableTextOn(activeColor) },
          ]}
          numberOfLines={1}
        >
          {valueText}
        </Text>
      </View>
    </View>
  );
}

// Let the browser keep vertical scrolling while horizontal drags reach us.
const webTouchStyle = Platform.OS === 'web'
  ? ({ touchAction: 'pan-y', userSelect: 'none', cursor: 'pointer' } as object)
  : null;

const styles = StyleSheet.create({
  touchArea: {
    height: TOUCH_HEIGHT,
    justifyContent: 'center',
  },
  track: {
    position: 'absolute',
    left: THUMB_SIZE / 2 - TRACK_HEIGHT / 2,
    right: THUMB_SIZE / 2 - TRACK_HEIGHT / 2,
    height: TRACK_HEIGHT,
    borderRadius: TRACK_HEIGHT / 2,
    backgroundColor: '#E6E0D4',
  },
  tick: {
    position: 'absolute',
    top: (TOUCH_HEIGHT - TICK_SIZE) / 2,
    width: TICK_SIZE,
    height: TICK_SIZE,
    borderRadius: TICK_SIZE / 2,
    backgroundColor: 'rgba(23, 23, 23, 0.22)',
  },
  fill: {
    position: 'absolute',
    top: (TOUCH_HEIGHT - TRACK_HEIGHT) / 2,
    height: TRACK_HEIGHT,
    borderRadius: TRACK_HEIGHT / 2,
  },
  thumb: {
    position: 'absolute',
    top: (TOUCH_HEIGHT - THUMB_SIZE) / 2,
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 4,
    elevation: 3,
  },
  thumbText: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  endLabel: {
    flex: 1,
    fontSize: 12,
    lineHeight: 15,
    color: Colors.textMuted,
  },
  endLabelLeft: {
    textAlign: 'left',
  },
  endLabelRight: {
    textAlign: 'right',
  },
  valuePill: {
    alignSelf: 'center',
    marginTop: 8,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 100,
    backgroundColor: 'rgba(23, 23, 23, 0.06)',
    maxWidth: '100%',
  },
  valueText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textMuted,
  },
  valueTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
});
