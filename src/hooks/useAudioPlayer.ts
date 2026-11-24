import { useState, useEffect, useCallback, useRef } from 'react';
import { Audio } from 'expo-av';
import { LoggingService } from '../services/logging';

interface UseAudioPlayerReturn {
  isPlaying: boolean;
  isLoaded: boolean;
  duration: number;
  position: number;
  play: () => Promise<void>;
  pause: () => Promise<void>;
  stop: () => Promise<void>;
  seekTo: (position: number) => Promise<void>;
  unload: () => Promise<void>;
}

export function useAudioPlayer(uri: string | null): UseAudioPlayerReturn {
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [duration, setDuration] = useState(0);
  const [position, setPosition] = useState(0);
  const positionInterval = useRef<NodeJS.Timeout | null>(null);

  // Load sound when URI changes
  useEffect(() => {
    let isMounted = true;

    let loadedSound: Audio.Sound | null = null;

    async function loadSound() {
      if (!uri) return;

      try {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          playsInSilentModeIOS: true,
        });

        const { sound: newSound, status } = await Audio.Sound.createAsync(
          { uri },
          { shouldPlay: false }
        );

        if (!isMounted) {
          await newSound.unloadAsync();
          return;
        }

        if (status.isLoaded) {
          setDuration(status.durationMillis ?? 0);
        }

        loadedSound = newSound;
        setSound(newSound);
        setIsLoaded(true);

        // Set up playback status update
        newSound.setOnPlaybackStatusUpdate((status) => {
          if (status.isLoaded) {
            setPosition(status.positionMillis ?? 0);
            setIsPlaying(status.isPlaying);

            if (status.didJustFinish) {
              setIsPlaying(false);
              setPosition(0);
            }
          }
        });
      } catch (error) {
        LoggingService.warn('Failed to load sound', {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    loadSound();

    return () => {
      isMounted = false;
      // Unloading also stops playback, so the old take cannot play into a
      // new recording.
      void loadedSound?.unloadAsync().catch(() => undefined);
    };
  }, [uri]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (positionInterval.current) {
        clearInterval(positionInterval.current);
      }
    };
  }, []);

  const play = useCallback(async () => {
    if (!sound) return;

    try {
      const status = await sound.getStatusAsync();
      if (status.isLoaded && status.positionMillis === status.durationMillis) {
        await sound.setPositionAsync(0);
      }
      await sound.playAsync();
    } catch (error) {
      LoggingService.warn('Failed to play audio', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }, [sound]);

  const pause = useCallback(async () => {
    if (!sound) return;

    try {
      await sound.pauseAsync();
    } catch (error) {
      LoggingService.warn('Failed to pause audio', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }, [sound]);

  const stop = useCallback(async () => {
    if (!sound) return;

    try {
      await sound.stopAsync();
      await sound.setPositionAsync(0);
      setPosition(0);
    } catch (error) {
      LoggingService.warn('Failed to stop audio', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }, [sound]);

  const seekTo = useCallback(
    async (newPosition: number) => {
      if (!sound) return;

      try {
        await sound.setPositionAsync(newPosition);
        setPosition(newPosition);
      } catch (error) {
        LoggingService.warn('Failed to seek audio', {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    },
    [sound]
  );

  const unload = useCallback(async () => {
    if (!sound) return;

    try {
      await sound.unloadAsync();
      setSound(null);
      setIsLoaded(false);
      setIsPlaying(false);
      setPosition(0);
      setDuration(0);
    } catch (error) {
      LoggingService.warn('Failed to unload audio', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }, [sound]);

  return {
    isPlaying,
    isLoaded,
    duration,
    position,
    play,
    pause,
    stop,
    seekTo,
    unload,
  };
}
