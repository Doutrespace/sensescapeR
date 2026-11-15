import React, { useMemo, useRef } from 'react';
import { PanResponder, Platform, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Colors, Radius } from '../../theme/colors';
import { t } from '../../i18n';

const MARKER_SIZE = 44;

export interface GridPoint {
  /** -1 (left) to 1 (right) */
  x: number;
  /** -1 (bottom) to 1 (top) */
  y: number;
}

/** Values for the four quadrants, in reading order. */
export interface Quadrants<T> {
  topLeft: T;
  topRight: T;
  bottomLeft: T;
  bottomRight: T;
}

interface Props {
  size: number;
  /** null = nothing placed yet (no marker is shown). */
  value: GridPoint | null;
  onChange: (value: GridPoint) => void;
  /** Snap to a steps x steps grid of cells (e.g. 9 for a 9-point affect grid). */
  steps?: number;
  leftLabel: string;
  rightLabel: string;
  topLabel: string;
  bottomLabel: string;
  accentColor?: string;
  /** Background tint per quadrant. */
  quadrantColors?: Quadrants<string>;
  /** Word shown in each corner, as on the printed Affect Grid. */
  quadrantLabels?: Quadrants<string>;
  accessibilityLabel: string;
}

function clamp(value: number): number {
  return Math.max(-1, Math.min(1, value));
}

/** Index of the cell (0..steps-1) a normalized coordinate falls into. */
function cellIndex(value: number, steps: number): number {
  return Math.min(steps - 1, Math.floor(((clamp(value) + 1) / 2) * steps));
}

/**
 * Two-dimensional rating pad: tap or drag to place a marker. Generic version
 * of the soundscape circumplex, used for smell and affect ratings.
 */
export function Grid2DInput({
  size,
  value,
  onChange,
  steps,
  leftLabel,
  rightLabel,
  topLabel,
  bottomLabel,
  accentColor = Colors.primary,
  quadrantColors,
  quadrantLabels,
  accessibilityLabel,
}: Props) {
  const latest = useRef({ size, steps, value, onChange });
  latest.current = { size, steps, value, onChange };
  // Touch position is tracked from the event itself rather than the gesture
  // state, which can skip moves that share a timestamp.
  const gestureStart = useRef({ x: 0, y: 0, pageX: 0, pageY: 0 });

  const setFromPosition = (positionX: number, positionY: number) => {
    const current = latest.current;
    let x = clamp((positionX / current.size) * 2 - 1);
    let y = clamp(1 - (positionY / current.size) * 2);

    if (current.steps && current.steps > 1) {
      // Snap to cell centres expressed on the -1..1 axis.
      x = (cellIndex(x, current.steps) / (current.steps - 1)) * 2 - 1;
      y = (cellIndex(y, current.steps) / (current.steps - 1)) * 2 - 1;
    }

    if (!current.value || current.value.x !== x || current.value.y !== y) {
      if (current.steps) {
        void Haptics.selectionAsync();
      }
      current.onChange({ x, y });
    }
  };

  const panResponder = useMemo(
    () => PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (event) => {
        const { locationX, locationY, pageX, pageY } = event.nativeEvent;
        gestureStart.current = { x: locationX, y: locationY, pageX, pageY };
        setFromPosition(locationX, locationY);
      },
      onPanResponderMove: (event) => {
        const start = gestureStart.current;
        setFromPosition(
          start.x + (event.nativeEvent.pageX - start.pageX),
          start.y + (event.nativeEvent.pageY - start.pageY)
        );
      },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const toPixels = (normalized: number, invert: boolean) => {
    const ratio = steps && steps > 1
      ? (Math.round(((normalized + 1) / 2) * (steps - 1)) + 0.5) / steps
      : (normalized + 1) / 2;
    return (invert ? 1 - ratio : ratio) * size;
  };

  const gridLineCount = steps && steps > 1 ? steps - 1 : 3;
  const gridLines = Array.from({ length: gridLineCount }, (_, index) => (
    ((index + 1) / (gridLineCount + 1)) * 100
  ));

  return (
    <View
      style={[styles.plane, { width: size, height: size }, webTouchStyle]}
      {...panResponder.panHandlers}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={t('Tap or drag inside the square to place the marker')}
    >
      {quadrantColors && (
        <View pointerEvents="none" style={styles.quadrants}>
          <View style={[styles.quadrant, { backgroundColor: quadrantColors.topLeft }]} />
          <View style={[styles.quadrant, { backgroundColor: quadrantColors.topRight }]} />
          <View style={[styles.quadrant, { backgroundColor: quadrantColors.bottomLeft }]} />
          <View style={[styles.quadrant, { backgroundColor: quadrantColors.bottomRight }]} />
        </View>
      )}

      {gridLines.map((percent) => (
        <React.Fragment key={percent}>
          <View pointerEvents="none" style={[styles.gridLine, styles.gridHorizontal, { top: `${percent}%` }]} />
          <View pointerEvents="none" style={[styles.gridLine, styles.gridVertical, { left: `${percent}%` }]} />
        </React.Fragment>
      ))}

      {quadrantLabels && (
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          <Text style={[styles.cornerLabel, styles.cornerTopLeft]}>{quadrantLabels.topLeft}</Text>
          <Text style={[styles.cornerLabel, styles.cornerTopRight]}>{quadrantLabels.topRight}</Text>
          <Text style={[styles.cornerLabel, styles.cornerBottomLeft]}>{quadrantLabels.bottomLeft}</Text>
          <Text style={[styles.cornerLabel, styles.cornerBottomRight]}>{quadrantLabels.bottomRight}</Text>
        </View>
      )}

      {/* Axis labels sit inside the pad so it can use the full screen width. */}
      <View pointerEvents="none" style={[styles.axisLabelRow, styles.axisTop]}>
        <Text style={styles.axisLabel}>{topLabel}</Text>
      </View>
      <View pointerEvents="none" style={[styles.axisLabelRow, styles.axisBottom]}>
        <Text style={styles.axisLabel}>{bottomLabel}</Text>
      </View>
      <View pointerEvents="none" style={[styles.axisLabelColumn, styles.axisLeft]}>
        <Text style={styles.axisLabel}>{leftLabel}</Text>
      </View>
      <View pointerEvents="none" style={[styles.axisLabelColumn, styles.axisRight]}>
        <Text style={styles.axisLabel}>{rightLabel}</Text>
      </View>

      {value ? (
        <View
          pointerEvents="none"
          style={[
            styles.marker,
            {
              left: toPixels(value.x, false) - MARKER_SIZE / 2,
              top: toPixels(value.y, true) - MARKER_SIZE / 2,
              borderColor: accentColor,
            },
          ]}
        >
          <View style={[styles.markerCore, { backgroundColor: accentColor }]} />
        </View>
      ) : (
        <View style={styles.hint} pointerEvents="none">
          <View style={styles.hintPill}>
            <Text style={styles.hintText}>{t('Tap or drag to place')}</Text>
          </View>
        </View>
      )}
    </View>
  );
}

const webTouchStyle = Platform.OS === 'web'
  ? ({ touchAction: 'none', userSelect: 'none', cursor: 'crosshair' } as object)
  : null;

const styles = StyleSheet.create({
  plane: {
    alignSelf: 'center',
    borderRadius: Radius.lg,
    overflow: 'hidden',
    backgroundColor: '#F8F5EE',
    borderWidth: 1,
    borderColor: Colors.surfaceHighlight,
  },
  quadrants: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  quadrant: {
    width: '50%',
    height: '50%',
  },
  gridLine: {
    position: 'absolute',
    backgroundColor: 'rgba(23, 23, 23, 0.07)',
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
  cornerLabel: {
    position: 'absolute',
    fontSize: 12,
    fontWeight: '600',
    fontStyle: 'italic',
    color: 'rgba(23, 23, 23, 0.5)',
  },
  cornerTopLeft: {
    top: 34,
    left: 14,
  },
  cornerTopRight: {
    top: 34,
    right: 14,
  },
  cornerBottomLeft: {
    bottom: 34,
    left: 14,
  },
  cornerBottomRight: {
    bottom: 34,
    right: 14,
  },
  axisLabelRow: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  axisTop: {
    top: 8,
  },
  axisBottom: {
    bottom: 8,
  },
  axisLabelColumn: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
  axisLeft: {
    left: 8,
  },
  axisRight: {
    right: 8,
  },
  axisLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: Colors.text,
    backgroundColor: 'rgba(255, 255, 255, 0.78)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    overflow: 'hidden',
  },
  marker: {
    position: 'absolute',
    width: MARKER_SIZE,
    height: MARKER_SIZE,
    borderRadius: MARKER_SIZE / 2,
    backgroundColor: '#FFFFFF',
    borderWidth: 4,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 4,
  },
  markerCore: {
    width: 16,
    height: 16,
    borderRadius: 8,
  },
  hint: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    // Sit below the centre line so it does not run into the side labels.
    paddingTop: 64,
  },
  hintPill: {
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 100,
  },
  hintText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textMuted,
  },
});
