import React, { useMemo } from 'react';
import { StyleSheet, View, Dimensions } from 'react-native';
import { Colors } from '../../theme/colors';

interface Props {
  duration: number;
  position: number;
  isPlaying: boolean;
}

const CONTAINER_WIDTH = Dimensions.get('window').width - 48;
const BAR_COUNT = 60;
const BAR_WIDTH = 3;
const BAR_GAP = (CONTAINER_WIDTH - BAR_COUNT * BAR_WIDTH) / (BAR_COUNT - 1);
const MAX_HEIGHT = 80;
const MIN_HEIGHT = 8;

export default function WaveformViewer({ duration, position, isPlaying }: Props) {
  // Generate pseudo-random waveform data based on duration
  // In a real implementation, this would come from audio analysis
  const waveformData = useMemo(() => {
    const data: number[] = [];
    const seed = duration % 1000; // Use duration as seed for consistency

    for (let i = 0; i < BAR_COUNT; i++) {
      // Generate pseudo-random heights that look like audio
      const base = Math.sin(i * 0.3 + seed * 0.01) * 0.3 + 0.5;
      const variation = Math.sin(i * 0.8 + seed * 0.02) * 0.2;
      const noise = Math.sin(i * 2.1 + seed * 0.03) * 0.1;
      const height = Math.max(0.1, Math.min(1, base + variation + noise));
      data.push(height);
    }

    return data;
  }, [duration]);

  const progressIndex = duration > 0 ? Math.floor((position / duration) * BAR_COUNT) : 0;

  return (
    <View style={styles.container}>
      <View style={styles.waveformContainer}>
        {waveformData.map((height, index) => {
          const isPlayed = index < progressIndex;
          const isCurrent = index === progressIndex;
          const barHeight = MIN_HEIGHT + height * (MAX_HEIGHT - MIN_HEIGHT);

          return (
            <View
              key={index}
              style={[
                styles.bar,
                {
                  height: barHeight,
                  backgroundColor: isPlayed
                    ? Colors.primary
                    : isCurrent && isPlaying
                    ? Colors.secondary
                    : Colors.surfaceHighlight,
                  opacity: isPlayed ? 1 : 0.5,
                },
              ]}
            />
          );
        })}
      </View>

      {/* Playhead indicator */}
      <View
        style={[
          styles.playhead,
          {
            left: `${(position / duration) * 100}%`,
            opacity: isPlaying ? 1 : 0.5,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: MAX_HEIGHT + 16,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 8,
    position: 'relative',
    overflow: 'hidden',
  },
  waveformContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  bar: {
    width: BAR_WIDTH,
    borderRadius: BAR_WIDTH / 2,
  },
  playhead: {
    position: 'absolute',
    top: 4,
    bottom: 4,
    width: 2,
    backgroundColor: Colors.primary,
    borderRadius: 1,
  },
});
