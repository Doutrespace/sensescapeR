import React, { useEffect, useRef } from 'react';
import { StyleSheet, View, Animated } from 'react-native';
import { Colors } from '../../theme/colors';

interface Props {
  level: number; // 0-1 normalized level
  peakLevel: number; // 0-1 peak hold
  isRecording: boolean;
}

const METER_HEIGHT = 200;
const SEGMENTS = 20;
const SEGMENT_GAP = 2;

export default function LevelMeter({ level, peakLevel, isRecording }: Props) {
  const animatedLevel = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(animatedLevel, {
      toValue: level,
      duration: 50,
      useNativeDriver: false,
    }).start();
  }, [level]);

  const getSegmentColor = (index: number, totalSegments: number) => {
    const position = index / totalSegments;
    if (position > 0.85) return Colors.error; // Red zone (clipping)
    if (position > 0.65) return '#B0956A'; // Yellow/orange zone
    return Colors.success; // Green zone
  };

  const segments = [];
  const activeSegments = Math.floor(level * SEGMENTS);
  const peakSegment = Math.floor(peakLevel * SEGMENTS);

  for (let i = 0; i < SEGMENTS; i++) {
    const isActive = i < activeSegments;
    const isPeak = i === peakSegment && peakSegment > 0;
    const color = getSegmentColor(i, SEGMENTS);

    segments.push(
      <View
        key={i}
        style={[
          styles.segment,
          {
            backgroundColor: isActive || isPeak ? color : Colors.surfaceHighlight,
            opacity: isActive ? 1 : isPeak ? 0.8 : 0.3,
          },
        ]}
      />
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.meterContainer}>
        <View style={styles.meterTrack}>{segments.reverse()}</View>
      </View>
      <View style={styles.labels}>
        <View style={[styles.label, styles.labelRed]} />
        <View style={[styles.label, styles.labelYellow]} />
        <View style={[styles.label, styles.labelGreen]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  meterContainer: {
    width: 32,
    height: METER_HEIGHT,
    backgroundColor: Colors.surface,
    borderRadius: 8,
    padding: 4,
    borderWidth: 1,
    borderColor: Colors.surfaceHighlight,
  },
  meterTrack: {
    flex: 1,
    justifyContent: 'flex-end',
    gap: SEGMENT_GAP,
  },
  segment: {
    flex: 1,
    borderRadius: 2,
    minHeight: 6,
  },
  labels: {
    height: METER_HEIGHT,
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  label: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  labelRed: {
    backgroundColor: Colors.error,
  },
  labelYellow: {
    backgroundColor: '#B0956A',
  },
  labelGreen: {
    backgroundColor: Colors.success,
  },
});
