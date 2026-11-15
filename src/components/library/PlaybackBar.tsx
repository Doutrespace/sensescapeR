import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Audio, AVPlaybackStatus } from 'expo-av';
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Colors, Spacing, Radius } from '../../theme/colors';
import { formatDuration } from '../../constants/protocols';
import { LoggingService } from '../../services/logging';

interface Props {
  audioUri: string;
  durationMs: number;
  onPlaybackComplete?: () => void;
  compact?: boolean;
}

export function PlaybackBar({ audioUri, durationMs, onPlaybackComplete, compact = false }: Props) {
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [positionMs, setPositionMs] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      // Cleanup sound on unmount
      if (sound) {
        sound.unloadAsync();
      }
    };
  }, [sound]);

  const loadAndPlaySound = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Configure audio mode
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
      });

      // Unload previous sound if exists
      if (sound) {
        await sound.unloadAsync();
      }

      // Load new sound
      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri: audioUri },
        { shouldPlay: true },
        onPlaybackStatusUpdate
      );

      setSound(newSound);
      setIsPlaying(true);
      setIsLoading(false);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (err) {
      LoggingService.warn('Failed to load playback audio', {
        error: err instanceof Error ? err.message : String(err),
      });
      setError('Failed to load audio');
      setIsLoading(false);
    }
  };

  const onPlaybackStatusUpdate = (status: AVPlaybackStatus) => {
    if (!status.isLoaded) {
      if (status.error) {
        setError(status.error);
        setIsPlaying(false);
      }
      return;
    }

    setPositionMs(status.positionMillis);
    setIsPlaying(status.isPlaying);

    if (status.didJustFinish) {
      setIsPlaying(false);
      setPositionMs(0);
      onPlaybackComplete?.();
    }
  };

  const handlePlayPause = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    if (!sound) {
      await loadAndPlaySound();
      return;
    }

    if (isPlaying) {
      await sound.pauseAsync();
    } else {
      // If at the end, restart
      if (positionMs >= durationMs - 100) {
        await sound.setPositionAsync(0);
      }
      await sound.playAsync();
    }
  };

  const handleSeek = async (forward: boolean) => {
    if (!sound) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const seekAmount = 10000; // 10 seconds
    let newPosition = forward
      ? Math.min(positionMs + seekAmount, durationMs)
      : Math.max(positionMs - seekAmount, 0);

    await sound.setPositionAsync(newPosition);
    setPositionMs(newPosition);
  };

  const handleStop = async () => {
    if (sound) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await sound.stopAsync();
      await sound.setPositionAsync(0);
      setPositionMs(0);
      setIsPlaying(false);
    }
  };

  const progress = durationMs > 0 ? (positionMs / durationMs) * 100 : 0;

  return (
    <View style={[styles.container, compact && styles.containerCompact]}>
      {/* Progress bar */}
      <View style={[styles.progressContainer, compact && styles.progressContainerCompact]}>
        <View style={[styles.progressBar, compact && styles.progressBarCompact]}>
          <View style={[styles.progressFill, { width: `${progress}%` }]} />
        </View>
        <View style={styles.timeRow}>
          <Text style={styles.timeText}>{formatDuration(positionMs)}</Text>
          <Text style={styles.timeText}>{formatDuration(durationMs)}</Text>
        </View>
      </View>

      {/* Controls */}
      <View style={[styles.controls, compact && styles.controlsCompact]}>
        <TouchableOpacity
          style={[styles.seekButton, compact && styles.seekButtonCompact]}
          onPress={() => handleSeek(false)}
          disabled={!sound || isLoading}
        >
          <MaterialIcons
            name="replay-10"
            size={28}
            color={sound && !isLoading ? Colors.text : Colors.textMuted}
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.playButton, compact && styles.playButtonCompact]}
          onPress={handlePlayPause}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color={Colors.background} size="small" />
          ) : (
            <MaterialIcons
              name={isPlaying ? 'pause' : 'play-arrow'}
              size={compact ? 26 : 32}
              color={Colors.background}
            />
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.seekButton, compact && styles.seekButtonCompact]}
          onPress={() => handleSeek(true)}
          disabled={!sound || isLoading}
        >
          <MaterialIcons
            name="forward-10"
            size={28}
            color={sound && !isLoading ? Colors.text : Colors.textMuted}
          />
        </TouchableOpacity>

        {sound && (
          <TouchableOpacity
            style={[styles.stopButton, compact && styles.stopButtonCompact]}
            onPress={handleStop}
          >
            <MaterialIcons name="stop" size={compact ? 20 : 24} color={Colors.error} />
          </TouchableOpacity>
        )}
      </View>

      {/* Error message */}
      {error && (
        <View style={styles.errorContainer}>
          <MaterialIcons name="error" size={16} color={Colors.error} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.surfaceHighlight,
  },
  containerCompact: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 18,
  },
  progressContainer: {
    marginBottom: Spacing.md,
  },
  progressContainerCompact: {
    marginBottom: 10,
  },
  progressBar: {
    height: 6,
    backgroundColor: Colors.surfaceHighlight,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarCompact: {
    height: 4,
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.primary,
    borderRadius: 3,
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: Spacing.xs,
  },
  timeText: {
    fontSize: 12,
    color: Colors.textMuted,
    fontVariant: ['tabular-nums'],
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.lg,
  },
  controlsCompact: {
    gap: 12,
  },
  seekButton: {
    padding: Spacing.sm,
  },
  seekButtonCompact: {
    padding: 4,
  },
  playButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playButtonCompact: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  stopButton: {
    padding: Spacing.sm,
    position: 'absolute',
    right: 0,
  },
  stopButtonCompact: {
    padding: 4,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.errorMuted,
    padding: Spacing.sm,
    borderRadius: Radius.sm,
    marginTop: Spacing.md,
    gap: Spacing.xs,
  },
  errorText: {
    flex: 1,
    fontSize: 12,
    color: Colors.error,
  },
});
