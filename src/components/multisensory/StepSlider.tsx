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

const THUMB_SIZE = 28;
const TRACK_HEIGHT = 6;
const TOUCH_HEIGHT = 44;

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
  accessibilityLabel: string;
}

/**
 * Stepped slider for rating scales. Tap or drag along the track; the thumb
 * snaps to whole scale points. Starts without a thumb so an unanswered item
 * is visibly different from a midpoint rating.
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

  const hasValue = value !== null;
  const thumbX = hasValue ? positionFor(value) : 0;
  const fillStartX = bipolar && min < 0 && max > 0 ? positionFor(0) : THUMB_SIZE / 2;
  const fillLeft = Math.min(fillStartX, thumbX);
  const fillWidth = Math.abs(thumbX - fillStartX);

  const valueText = hasValue
    ? valueLabels?.[value] ?? String(value)
    : 'Not rated';

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
        accessibilityHint={`Tap or drag to rate from ${minLabel} to ${maxLabel}`}
        accessibilityValue={{ min, max, now: hasValue ? value : undefined, text: valueText }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={(event) => {
          const start = hasValue ? value : Math.round((min + max) / 2);
          const delta = event.nativeEvent.actionName === 'increment' ? 1 : -1;
          onChange(Math.max(min, Math.min(max, hasValue ? start + delta : start)));
        }}
      >
        <View style={styles.track} pointerEvents="none" />

        {trackWidth > 0 && (
          <>
            {Array.from({ length: stepCount + 1 }, (_, index) => (
              <View
                key={index}
                pointerEvents="none"
                style={[styles.tick, { left: positionFor(min + index) - 2 }]}
              />
            ))}

            {hasValue && (
              <>
                <View
                  pointerEvents="none"
                  style={[styles.fill, { left: fillLeft, width: fillWidth }]}
                />
                <View
                  pointerEvents="none"
                  style={[styles.thumb, { left: thumbX - THUMB_SIZE / 2 }]}
                >
                  <Text style={styles.thumbText}>{value > 0 && bipolar ? `+${value}` : value}</Text>
                </View>
              </>
            )}
          </>
        )}
      </View>

      <View style={styles.labelRow}>
        <Text style={[styles.endLabel, styles.endLabelLeft]} numberOfLines={2}>{minLabel}</Text>
        <Text style={[styles.valueLabel, !hasValue && styles.valueLabelEmpty]} numberOfLines={1}>
          {valueText}
        </Text>
        <Text style={[styles.endLabel, styles.endLabelRight]} numberOfLines={2}>{maxLabel}</Text>
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
    left: THUMB_SIZE / 2,
    right: THUMB_SIZE / 2,
    height: TRACK_HEIGHT,
    borderRadius: TRACK_HEIGHT / 2,
    backgroundColor: Colors.surfaceHighlight,
  },
  tick: {
    position: 'absolute',
    top: TOUCH_HEIGHT / 2 - 2,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.textDisabled,
  },
  fill: {
    position: 'absolute',
    top: (TOUCH_HEIGHT - TRACK_HEIGHT) / 2,
    height: TRACK_HEIGHT,
    borderRadius: TRACK_HEIGHT / 2,
    backgroundColor: Colors.primary,
  },
  thumb: {
    position: 'absolute',
    top: (TOUCH_HEIGHT - THUMB_SIZE) / 2,
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.surface,
  },
  thumbText: {
    color: Colors.surface,
    fontSize: 12,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  endLabel: {
    flex: 1,
    fontSize: 11,
    lineHeight: 14,
    color: Colors.textMuted,
  },
  endLabelLeft: {
    textAlign: 'left',
  },
  endLabelRight: {
    textAlign: 'right',
  },
  valueLabel: {
    flexShrink: 0,
    maxWidth: '46%',
    fontSize: 12,
    lineHeight: 14,
    fontWeight: '700',
    color: Colors.text,
    textAlign: 'center',
  },
  valueLabelEmpty: {
    fontWeight: '500',
    color: Colors.textDisabled,
  },
});
