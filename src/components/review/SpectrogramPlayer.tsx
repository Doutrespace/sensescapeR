import React, { useCallback, useState } from 'react';
import { StyleSheet, View, Text, LayoutChangeEvent } from 'react-native';
import { Colors, Radius } from '../../theme/colors';
import { StaticSpectrogram } from '../recording/SpectrogramView';
import { t } from '../../i18n';

// Frequency labels for the Y-axis (matching SpectrogramView)
const FREQUENCY_LABELS = [
  { freq: 8000, label: '8k' },
  { freq: 4000, label: '4k' },
  { freq: 2000, label: '2k' },
  { freq: 1000, label: '1k' },
  { freq: 500, label: '500' },
  { freq: 0, label: '0' },
];

interface SpectrogramPlayerProps {
  spectrogramUri?: string | null;
  duration: number; // Total duration in ms
  position: number; // Current position in ms
  isPlaying: boolean;
  height?: number;
  showFrequencyLabels?: boolean;
  displayBoost?: number;
}

export default function SpectrogramPlayer({
  spectrogramUri,
  duration,
  position,
  isPlaying,
  height = 150,
  showFrequencyLabels = true,
  displayBoost,
}: SpectrogramPlayerProps) {
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  const onLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setDimensions({ width, height });
  }, []);

  const labelWidth = showFrequencyLabels ? 40 : 0;
  const spectrogramWidth = Math.max(0, dimensions.width - labelWidth);

  // Calculate playhead position
  const playbackProgress = duration > 0 ? position / duration : 0;
  const playheadX = playbackProgress * spectrogramWidth;

  if (!spectrogramUri) {
    return (
      <View style={[styles.container, { height }]} onLayout={onLayout}>
        <View style={styles.placeholderContainer}>
          <View style={styles.placeholder}>
            <Text style={styles.placeholderText}>{t('No spectrogram available')}</Text>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { height }]} onLayout={onLayout}>
      {showFrequencyLabels && (
        <View style={[styles.frequencyLabels, { width: labelWidth, height }]}>
          {FREQUENCY_LABELS.map(({ freq, label }) => {
            const yPosition = (1 - freq / 8000) * height;
            return (
              <Text
                key={freq}
                style={[
                  styles.frequencyLabel,
                  { top: yPosition - 8 },
                ]}
              >
                {label}
              </Text>
            );
          })}
        </View>
      )}

      <View style={styles.spectrogramContainer}>
        <StaticSpectrogram
          imageUri={spectrogramUri}
          width={spectrogramWidth}
          height={height}
          displayBoost={displayBoost}
        />

        {/* Playhead */}
        <View
          style={[
            styles.playhead,
            {
              left: playheadX,
              height,
              opacity: playbackProgress > 0 ? 1 : 0,
            },
          ]}
        />

        {/* Playing indicator glow */}
        {isPlaying && (
          <View
            style={[
              styles.playheadGlow,
              {
                left: playheadX - 4,
                height,
              },
            ]}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
  },
  frequencyLabels: {
    position: 'relative',
  },
  frequencyLabel: {
    position: 'absolute',
    right: 4,
    fontSize: 10,
    color: Colors.textMuted,
    fontVariant: ['tabular-nums'],
  },
  spectrogramContainer: {
    flex: 1,
    backgroundColor: '#0D1B2A',
    borderRadius: Radius.xl,
    overflow: 'hidden',
    position: 'relative',
  },
  playhead: {
    position: 'absolute',
    top: 0,
    width: 2,
    backgroundColor: Colors.primary,
  },
  playheadGlow: {
    position: 'absolute',
    top: 0,
    width: 10,
    backgroundColor: `${Colors.primary}40`,
  },
  placeholderContainer: {
    flex: 1,
    paddingLeft: 40, // Account for labels area
  },
  placeholder: {
    flex: 1,
    backgroundColor: '#F3EFE6',
    borderRadius: Radius.xl,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.surfaceHighlight,
  },
  placeholderText: {
    color: Colors.textMuted,
    fontSize: 14,
  },
});
