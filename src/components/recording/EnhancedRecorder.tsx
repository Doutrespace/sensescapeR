import React, { useState, useEffect, useRef, useCallback } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Alert, Animated, useWindowDimensions, Linking, Platform } from 'react-native';
import { Audio, InterruptionModeAndroid, InterruptionModeIOS } from 'expo-av';
import * as Haptics from 'expo-haptics';
import { Paths, File, Directory } from 'expo-file-system';
import { captureRef } from 'react-native-view-shot';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Radius, Shadows } from '../../theme/colors';
import { QualityFlags, LocationData } from '../../types/recording';
import { formatDuration } from '../../constants/protocols';
import {
  DB_MIN,
  CLIP_THRESHOLD_DB,
  LOW_LEVEL_THRESHOLD_DB,
  CLIP_COUNT_THRESHOLD,
  LOW_SNR_RATIO_THRESHOLD,
  dbToNormalized,
} from '../../constants/audio';
import { SpectrogramView } from './SpectrogramView';
import { useSpectrogramData } from '../../hooks/useSpectrogramData';
import { useAudioClassifier } from '../../hooks/useAudioClassifier';
import { ResultsPanel } from './ResultsPanel';
import { AudioAnalyzer } from '../../services/audio/audioAnalyzer';
import { PcmWavRecorder } from '../../services/audio/pcmWavRecorder';
import { LoggingService } from '../../services/logging/LoggingService';
import type { AudioLevelingMode } from '../../stores/usePreferencesStore';
import { MaterialIcons } from '@expo/vector-icons';
import { t } from '../../i18n';

interface Props {
  targetDuration: number;
  location?: LocationData | null;
  audioLevelingMode?: AudioLevelingMode;
  onRecordingComplete: (
    uri: string,
    duration: number,
    qualityFlags: QualityFlags,
    spectrogramUri?: string,
    detectedSounds?: string,
    normalizationApplied?: boolean,
    normalizationGain?: number | null,
    acousticMetrics?: string,
  ) => void;
  onCancel: () => void;
}

function getRecordingStartErrorMessage(error?: string): string {
  if (!error) {
    return 'The microphone pipeline could not start. Close other apps using the microphone and try again.';
  }

  const normalized = error.toLowerCase();
  if (normalized.includes('live analyzer failed to start')) {
    return 'The live audio analyzer could not start. Close other apps using the microphone and try again.';
  }
  if (normalized.includes('permission')) {
    return 'Microphone access is unavailable. Check the app permission in system settings.';
  }
  return 'The microphone pipeline could not start. Close other apps using the microphone and try again.';
}


export default function EnhancedRecorder({
  targetDuration,
  location,
  audioLevelingMode = 'playback',
  onRecordingComplete,
  onCancel,
}: Props) {
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [level, setLevel] = useState(0);
  const [peakLevel, setPeakLevel] = useState(0);
  const [isClipping, setIsClipping] = useState(false);
  const [showLowLevelWarning, setShowLowLevelWarning] = useState(false);

  // Spectrogram
  const { width: screenWidth } = useWindowDimensions();
  const spectrogramViewRef = useRef<View>(null);
  const {
    spectrogramData,
    start: startSpectrogram,
    stop: stopSpectrogram,
  } = useSpectrogramData({ enabled: isRecording, width: Math.round(screenWidth) });

  // Sound classifier
  const {
    classifications,
    broadClassifications,
    macroClassifications,
    isLoading: classifierLoading,
    isReady: classifierReady,
    error: classifierError,
    start: startClassifier,
    stop: stopClassifier,
    getTopDetectedSounds,
  } = useAudioClassifier();
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();

  const qualityFlagsRef = useRef<QualityFlags>({
    hasClipping: false,
    hasWindHandling: false,
    hasLowSNR: false,
    peakDb: DB_MIN,
    rmsDb: DB_MIN,
  });

  const peakHoldTimer = useRef<NodeJS.Timeout | null>(null);
  const clipCount = useRef(0);
  const lowLevelSamples = useRef(0);
  const totalSamples = useRef(0);
  const rmsAccumulator = useRef(0);
  const consecutiveLowLevelCount = useRef(0);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const liveAnalyzerRef = useRef<AudioAnalyzer | null>(null);
  const liveRecorderRef = useRef<PcmWavRecorder | null>(null);
  const hasAutoStartedRef = useRef(false);
  const isStartingRef = useRef(false);

  // Threshold for showing low-level warning (dBFS)
  const LOW_LEVEL_WARNING_THRESHOLD_DB = -55;
  // Number of consecutive low samples before showing warning
  const LOW_LEVEL_WARNING_COUNT = 100; // ~6 seconds at 60ms intervals

  // Pulse animation for recording indicator
  useEffect(() => {
    if (isRecording) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.1,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    }
  }, [isRecording, pulseAnim]);

  const showPermissionAlert = () => {
    if (Platform.OS === 'web') {
      // A web page cannot open browser settings; explain where to allow access.
      Alert.alert(
        t('Microphone access needed'),
        t('Allow microphone access for this site in your browser (tap the icon next to the address bar, or check the site settings), then start the recording again.')
      );
      return;
    }

    Alert.alert(
      t('Microphone Permission Required'),
      t('This app needs microphone access to record soundscapes. Please enable it in your device settings.'),
      [
        { text: t('Cancel'), style: 'cancel' },
        { text: t('Open Settings'), onPress: () => Linking.openSettings() },
      ]
    );
  };

  const beginRecording = useCallback(async () => {
    LoggingService.debug('Starting recording');
    try {
      const permission = await Audio.requestPermissionsAsync();
      LoggingService.debug('Microphone permission status', { status: permission.status });
      if (permission.status !== 'granted') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        showPermissionAlert();
        return;
      }
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        interruptionModeIOS: InterruptionModeIOS.MixWithOthers,
        interruptionModeAndroid: InterruptionModeAndroid.DoNotMix,
        shouldDuckAndroid: false,
        playThroughEarpieceAndroid: false,
        staysActiveInBackground: true,
      });

      // Start spectrogram analysis — returns the live AudioAnalyzer on success
      LoggingService.debug('Starting spectrogram pipeline');
      const liveAnalyzer = await startSpectrogram();
      LoggingService.debug('Spectrogram pipeline state', { started: !!liveAnalyzer });
      if (!liveAnalyzer) {
        throw new Error('Live analyzer failed to start');
      }

      LoggingService.debug('Starting PCM recorder');
      const liveRecorder = new PcmWavRecorder(audioLevelingMode);
      liveRecorder.start(liveAnalyzer);

      liveAnalyzerRef.current = liveAnalyzer;
      liveRecorderRef.current = liveRecorder;
      setIsRecording(true);
      setDuration(0);
      setLevel(0);
      setPeakLevel(0);

      // Start classifier using the live analyzer instance (not the hook's render-time value)
      startClassifier(liveAnalyzer);

      // Reset quality tracking
      qualityFlagsRef.current = {
        hasClipping: false,
        hasWindHandling: false,
        hasLowSNR: false,
        peakDb: DB_MIN,
        rmsDb: DB_MIN,
      };
      clipCount.current = 0;
      lowLevelSamples.current = 0;
      totalSamples.current = 0;
      rmsAccumulator.current = 0;
      consecutiveLowLevelCount.current = 0;
      setShowLowLevelWarning(false);

      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch (err) {
      LoggingService.error('Failed to start recording', {
        error: err instanceof Error ? err.message : String(err),
      });
      liveRecorderRef.current?.cancel();
      liveRecorderRef.current = null;
      liveAnalyzerRef.current = null;
      stopSpectrogram();
      stopClassifier();
      setIsRecording(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert(
        t('Recording unavailable'),
        getRecordingStartErrorMessage(err instanceof Error ? err.message : undefined)
      );
    }
  }, [audioLevelingMode, startClassifier, startSpectrogram, stopClassifier, stopSpectrogram]);

  // Starting takes a moment (permission prompt, model loading). A second tap
  // in that time must not open a second microphone stream.
  const startRecording = useCallback(async () => {
    if (isStartingRef.current || liveRecorderRef.current) {
      return;
    }
    isStartingRef.current = true;
    try {
      await beginRecording();
    } finally {
      isStartingRef.current = false;
    }
  }, [beginRecording]);

  useEffect(() => {
    if (hasAutoStartedRef.current) {
      return;
    }

    hasAutoStartedRef.current = true;
    void startRecording();
  }, [startRecording]);

  const stopRecording = useCallback(async () => {
    const liveRecorder = liveRecorderRef.current;
    if (!liveRecorder) return;

    setIsRecording(false);
    try {
      const {
        uri,
        durationMs,
        normalizationApplied,
        normalizationGain,
        acousticMetrics,
        originalPeakDb,
        originalRmsDb,
      } = await liveRecorder.stop();
      liveRecorderRef.current = null;
      const acousticMetricsJson = acousticMetrics
        ? JSON.stringify(acousticMetrics)
        : undefined;

      // Capture spectrogram image before stopping analysis
      let spectrogramUri: string | undefined;
      if (spectrogramViewRef.current) {
        try {
          const capturedUri = await captureRef(spectrogramViewRef, {
            format: 'png',
            quality: 1,
            result: 'tmpfile',
          });

          // Move to permanent location using new expo-file-system API
          const filename = `spectrogram_${Date.now()}.png`;
          const spectrogramsDir = new Directory(Paths.document, 'spectrograms');

          // Ensure directory exists
          if (!spectrogramsDir.exists) {
            await spectrogramsDir.create();
          }

          const capturedFile = new File(capturedUri);
          const permanentFile = new File(spectrogramsDir, filename);
          await capturedFile.move(permanentFile);

          spectrogramUri = permanentFile.uri;
          LoggingService.debug('Spectrogram saved', { spectrogramUri });
        } catch (captureError) {
          LoggingService.warn('Failed to capture spectrogram', {
            error: captureError instanceof Error ? captureError.message : String(captureError),
          });
        }
      }

      // Collect session classifications before stopping
      const topSounds = getTopDetectedSounds(0.06);
      const detectedSoundsJson = topSounds.length > 0
        ? JSON.stringify(topSounds)
        : undefined;
      if (topSounds.length > 0) {
        LoggingService.debug('Detected session sounds', {
          labels: topSounds.map((sound) => sound.label),
        });
      }

      // Stop spectrogram and classifier
      stopSpectrogram();
      stopClassifier();

      // Calculate final quality flags
      // Peak and mean level of the whole take, measured on every sample of
      // the unprocessed signal (the live meter only sees part of it).
      const hasMeasuredLevels = Number.isFinite(originalPeakDb) && Number.isFinite(originalRmsDb);
      const finalFlags: QualityFlags = {
        ...qualityFlagsRef.current,
        ...(hasMeasuredLevels ? { peakDb: originalPeakDb, rmsDb: originalRmsDb } : {}),
        // Clipped: a sample reached full scale, or the meter saw it repeatedly.
        hasClipping: (hasMeasuredLevels && originalPeakDb >= -0.1)
          || clipCount.current > CLIP_COUNT_THRESHOLD,
        hasLowSNR: totalSamples.current > 0 &&
          lowLevelSamples.current / totalSamples.current > LOW_SNR_RATIO_THRESHOLD,
      };

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      onRecordingComplete(
        uri,
        durationMs,
        finalFlags,
        spectrogramUri,
        detectedSoundsJson,
        normalizationApplied,
        normalizationGain,
        acousticMetricsJson,
      );
    } catch (err) {
      LoggingService.error('Failed to stop recording', {
        error: err instanceof Error ? err.message : String(err),
      });
      Alert.alert(
        t('Recording could not finish'),
        t('The recording stopped unexpectedly before it could be saved. Try one more time and keep the app in the foreground.')
      );
    } finally {
      liveAnalyzerRef.current = null;
      stopSpectrogram();
      stopClassifier();
    }
  }, [getTopDetectedSounds, onRecordingComplete, stopClassifier, stopSpectrogram]);

  // Metering interval
  useEffect(() => {
    let interval: NodeJS.Timeout;

    if (isRecording) {
      interval = setInterval(() => {
        try {
          const stats = liveRecorderRef.current?.getStats();
          const diagnostics = liveAnalyzerRef.current?.getLatestAudioFrameDiagnostics();
          if (!stats || !diagnostics) {
            return;
          }

          const durationMillis = stats.durationMs;
          setDuration(durationMillis);

          const metering = 20 * Math.log10(Math.max(diagnostics.rms, 1e-6));
          const normalizedLevel = dbToNormalized(metering);
          setLevel(normalizedLevel);

          // Track peak
          if (normalizedLevel > peakLevel) {
            setPeakLevel(normalizedLevel);

            // Reset peak hold timer
            if (peakHoldTimer.current) {
              clearTimeout(peakHoldTimer.current);
            }
            peakHoldTimer.current = setTimeout(() => {
              setPeakLevel((prev) => prev * 0.95);
            }, 1500);
          }

          // Update quality metrics
          totalSamples.current++;

          // Track RMS (accumulate linear power values)
          const linearPower = Math.pow(10, metering / 10);
          rmsAccumulator.current += linearPower;

          // Update running RMS estimate
          const avgPower = rmsAccumulator.current / totalSamples.current;
          qualityFlagsRef.current.rmsDb = 10 * Math.log10(avgPower);

          if (metering > qualityFlagsRef.current.peakDb) {
            qualityFlagsRef.current.peakDb = metering;
          }

          // Detect clipping (above threshold)
          if (metering > CLIP_THRESHOLD_DB) {
            clipCount.current++;
            setIsClipping(true);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
            setTimeout(() => setIsClipping(false), 100);
          }

          // Track low level samples for SNR estimation
          if (metering < LOW_LEVEL_THRESHOLD_DB) {
            lowLevelSamples.current++;
          }

          // Track consecutive low levels for user warning
          // Show warning after ~3 seconds of consistently quiet input
          if (metering < LOW_LEVEL_WARNING_THRESHOLD_DB) {
            consecutiveLowLevelCount.current++;
            if (
              diagnostics.peak < 0.015
              && consecutiveLowLevelCount.current >= LOW_LEVEL_WARNING_COUNT
              && !showLowLevelWarning
            ) {
              setShowLowLevelWarning(true);
            }
          } else {
            // Reset counter if we get adequate levels
            consecutiveLowLevelCount.current = 0;
            if (showLowLevelWarning) {
              setShowLowLevelWarning(false);
            }
          }

          // Detect potential wind/handling noise (rapid level changes)
          // This is a simple heuristic - sudden spikes in low frequencies
          if (Math.abs(metering - (qualityFlagsRef.current.peakDb - 10)) > 20) {
            qualityFlagsRef.current.hasWindHandling = true;
          }

          // Auto-stop at target duration
          if (durationMillis >= targetDuration) {
            clearInterval(interval);
            void stopRecording();
          }
        } catch (err) {
          // Recording may have stopped
        }
      }, 60);
    }

    return () => {
      clearInterval(interval);
      if (peakHoldTimer.current) {
        clearTimeout(peakHoldTimer.current);
      }
    };
  }, [isRecording, targetDuration, peakLevel, stopRecording]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      liveRecorderRef.current?.cancel();
      liveRecorderRef.current = null;
      liveAnalyzerRef.current = null;
      stopClassifier();
      stopSpectrogram();
    };
  }, [stopClassifier, stopSpectrogram]);

  const progress = duration / targetDuration;
  const remainingMs = targetDuration - duration;
  const progressPct = Math.max(0, Math.min(100, progress * 100));
  const durationLabel = formatDuration(Math.max(0, duration));
  const remainingLabel = formatDuration(Math.max(0, remainingMs));
  const recordButtonSize = 84;
  // The tab bar floats 16px above the bottom edge; clear it with a small gap.
  const floatingButtonBottom = tabBarHeight + insets.bottom + 16 + 12;
  const resultsBottomInset = floatingButtonBottom + recordButtonSize + 20;

  // GPS coordinates for overlay
  const locationLabel = location
    ? `${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}`
    : t('Locating...');

  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const spectrogramHeight = Math.max(228, Math.min(windowHeight * 0.34, 320));

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.cancelButton}
        onPress={onCancel}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel={t('Cancel Recording')}
      >
        <MaterialIcons name="close" size={22} color={Colors.text} />
      </TouchableOpacity>
      <View style={styles.header}>
        <Text style={styles.title}>
          {t('Soundscape')}
        </Text>
      </View>

      <View
        ref={spectrogramViewRef}
        style={[styles.spectrogramSection, { height: spectrogramHeight }]}
        collapsable={false}
      >
        <SpectrogramView
          spectrogramData={spectrogramData}
          width={windowWidth}
          height={spectrogramHeight}
          showFrequencyLabels={false}
          showGpsOverlay={false}
        />
      </View>

      {showLowLevelWarning && (
        <View style={styles.lowLevelWarning}>
          <Text style={styles.lowLevelWarningText}>
            {t('Very low input level detected. Move closer to the sound source or check the device microphone.')}
          </Text>
        </View>
      )}

      <View style={styles.resultsSection}>
        <ResultsPanel
          classifications={classifications}
          broadClassifications={broadClassifications}
          macroClassifications={macroClassifications}
          isLoading={classifierLoading}
          isReady={classifierReady}
          error={classifierError}
          progressPct={progressPct}
          remainingLabel={remainingLabel}
          durationLabel={durationLabel}
          locationLabel={locationLabel}
          bottomInset={resultsBottomInset}
        />
      </View>

      <Animated.View
        style={[
          styles.floatingControl,
          {
            bottom: floatingButtonBottom,
            transform: [{ scale: pulseAnim }],
          },
        ]}
        pointerEvents="box-none"
      >
        {!isRecording ? (
          <TouchableOpacity
            style={[styles.mainRecordBtn, { width: recordButtonSize, height: recordButtonSize, borderRadius: recordButtonSize / 2 }]}
            onPress={startRecording}
            activeOpacity={0.85}
          >
            <View style={styles.mainRecordInner} />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.mainRecordBtn, { width: recordButtonSize, height: recordButtonSize, borderRadius: recordButtonSize / 2 }]}
            onPress={stopRecording}
            activeOpacity={0.85}
          >
            <View style={styles.mainStopInner} />
          </TouchableOpacity>
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  cancelButton: {
    position: 'absolute',
    top: 8,
    left: 12,
    zIndex: 5,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.surfaceHighlight,
  },
  header: {
    alignItems: 'center',
    paddingTop: 14,
    paddingBottom: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
    color: Colors.text,
  },
  spectrogramSection: {
    width: '100%',
    backgroundColor: '#0D1B2A', // Ensures dark background for canvas
    overflow: 'hidden',
  },
  resultsSection: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  floatingControl: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  mainRecordBtn: {
    backgroundColor: Colors.surface,
    borderWidth: 5,
    borderColor: '#E4DDD0',
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.primary,
  },
  mainRecordInner: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.primary,
  },
  mainStopInner: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: '#B56A5E',
  },
  lowLevelWarning: {
    marginHorizontal: 16,
    marginBottom: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#FEF3C7',
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: '#F59E0B',
  },
  lowLevelWarningText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#92400E',
    textAlign: 'center',
  },
});
