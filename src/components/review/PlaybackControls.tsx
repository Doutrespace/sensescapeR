import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, Radius } from '../../theme/colors';
import { formatDuration } from '../../constants/protocols';

interface Props {
  isPlaying: boolean;
  isLoaded: boolean;
  duration: number;
  position: number;
  onPlay: () => void;
  onPause: () => void;
  onSeek: (position: number) => void;
}

export default function PlaybackControls({
  isPlaying,
  isLoaded,
  duration,
  position,
  onPlay,
  onPause,
  onSeek,
}: Props) {
  const progress = duration > 0 ? position / duration : 0;

  const handleSeekBarPress = (event: any) => {
    const { locationX, target } = event.nativeEvent;
    // Get width from the target element
    target.measure((_x: number, _y: number, width: number) => {
      const newPosition = (locationX / width) * duration;
      onSeek(Math.max(0, Math.min(duration, newPosition)));
    });
  };

  return (
    <View style={styles.container}>
      <View style={styles.timeContainer}>
        <Text style={styles.timeText}>{formatDuration(position)}</Text>
        <Text style={styles.timeDivider}>/</Text>
        <Text style={styles.timeText}>{formatDuration(duration)}</Text>
      </View>

      <TouchableOpacity
        style={styles.seekBar}
        onPress={handleSeekBarPress}
        activeOpacity={0.9}
      >
        <View style={styles.seekBarTrack}>
          <View style={[styles.seekBarProgress, { width: `${progress * 100}%` }]} />
          <View
            style={[styles.seekBarThumb, { left: `${progress * 100}%` }]}
          />
        </View>
      </TouchableOpacity>

      <View style={styles.controls}>
        <TouchableOpacity
          style={styles.seekButton}
          onPress={() => onSeek(Math.max(0, position - 5000))}
          disabled={!isLoaded}
        >
          <MaterialIcons
            name="replay-5"
            size={28}
            color={isLoaded ? Colors.text : Colors.textMuted}
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.playButton}
          onPress={isPlaying ? onPause : onPlay}
          disabled={!isLoaded}
        >
          <MaterialIcons
            name={isPlaying ? 'pause' : 'play-arrow'}
            size={40}
            color={isLoaded ? Colors.background : Colors.textMuted}
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.seekButton}
          onPress={() => onSeek(Math.min(duration, position + 5000))}
          disabled={!isLoaded}
        >
          <MaterialIcons
            name="forward-5"
            size={28}
            color={isLoaded ? Colors.text : Colors.textMuted}
          />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 4,
    paddingTop: 10,
    paddingBottom: 4,
  },
  timeContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  timeText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text,
    fontVariant: ['tabular-nums'],
  },
  timeDivider: {
    fontSize: 14,
    color: Colors.textMuted,
    marginHorizontal: 4,
  },
  seekBar: {
    height: 32,
    justifyContent: 'center',
    marginBottom: 16,
  },
  seekBarTrack: {
    height: 5,
    backgroundColor: '#D8D1C3',
    borderRadius: 999,
    position: 'relative',
  },
  seekBarProgress: {
    height: '100%',
    backgroundColor: Colors.primary,
    borderRadius: 999,
  },
  seekBarThumb: {
    position: 'absolute',
    top: -4,
    marginLeft: -7,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: Colors.primary,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 24,
  },
  seekButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EFE8DC',
  },
  playButton: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
