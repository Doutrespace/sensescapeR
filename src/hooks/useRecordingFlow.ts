import { useCallback, useRef } from 'react';
import { Alert, Animated } from 'react-native';
import * as Location from 'expo-location';
import * as Device from 'expo-device';
import * as Haptics from 'expo-haptics';

import { useRecordingStore } from '../stores/useRecordingStore';
import { useLibraryStore } from '../stores/useLibraryStore';
import { usePreferencesStore } from '../stores/usePreferencesStore';
import { useBadgeStore } from '../stores/useBadgeStore';
import { createRecording } from '../services/database/recordings';
import { createPerception, calculateCircumplexFromPAQ } from '../services/database/perceptions';
import { LoggingService } from '../services/logging/LoggingService';
import { queueForUpload } from '../services/sync/syncManager';
import { QualityFlags } from '../types/recording';
import { serializeMultisensory } from '../types/multisensory';
import type { ImageClassification } from '../utils/imageClassification';

function getLocationErrorMessage(error?: string): string {
  if (!error) {
    return 'Location could not be determined. You can still save the recording without coordinates.';
  }

  const normalized = error.toLowerCase();
  if (normalized.includes('denied')) {
    return 'Location permission was denied. You can still save the recording without coordinates.';
  }
  if (normalized.includes('timeout')) {
    return 'Location lookup timed out. Move to a more open area or save without coordinates.';
  }
  return 'Location could not be determined. You can still save the recording without coordinates.';
}

function getSaveErrorMessage(error?: string): string {
  if (!error) {
    return 'The recording could not be saved. Please try again.';
  }

  const normalized = error.toLowerCase();
  if (normalized.includes('invalid audio file path')) {
    return 'The recorded audio file could not be found anymore. Retake the recording and save again.';
  }
  if (normalized.includes('invalid coordinates')) {
    return 'The saved location data was invalid. Review the privacy settings or save without coordinates.';
  }
  if (normalized.includes('disk') || normalized.includes('space') || normalized.includes('storage')) {
    return 'There is not enough local storage to save this recording. Free some space and try again.';
  }
  return 'The recording could not be saved. Please try again.';
}

export function useRecordingFlow() {
  const store = useRecordingStore();
  const libraryStore = useLibraryStore();
  const preferences = usePreferencesStore();
  const badgeStore = useBadgeStore();
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const animateTransition = useCallback((callback: () => void) => {
    Animated.sequence([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start();

    setTimeout(callback, 150);
  }, [fadeAnim]);

  const startMeasurement = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    store.setLicense(preferences.defaultLicense);
    store.setPrivacyMode(preferences.defaultPrivacyMode);
    store.setCommunityVisibility(preferences.defaultCommunityVisibility);
    store.setProtocol('opportunistic', 30000);
    animateTransition(() => store.setState('RECORDING'));
  }, [
    animateTransition,
    preferences.defaultCommunityVisibility,
    preferences.defaultLicense,
    preferences.defaultPrivacyMode,
    store,
  ]);

  const handleProtocolConfirm = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    animateTransition(() => store.setState('RECORDING'));
  }, [animateTransition, store]);

  const handleCountdownComplete = useCallback(() => {
    store.setState('RECORDING');
  }, [store]);

  const handleRecordingComplete = useCallback(async (
    uri: string,
    duration: number,
    qualityFlags: QualityFlags,
    spectrogramUri?: string,
    detectedSounds?: string,
    normalizationApplied?: boolean,
    normalizationGain?: number | null,
    acousticMetrics?: string,
  ) => {
    store.setAudioUri(
      uri,
      duration,
      spectrogramUri,
      detectedSounds,
      normalizationApplied,
      normalizationGain,
      acousticMetrics,
    );
    store.updateQualityFlags(qualityFlags);

    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });
        store.setLocation({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          accuracy: location.coords.accuracy ?? 0,
          altitude: location.coords.altitude ?? undefined,
        });
        store.setLocationError(null);
      } else {
        store.setLocationError(getLocationErrorMessage('denied'));
      }
    } catch (err) {
      LoggingService.warn('Failed to capture location for recording', {
        error: err instanceof Error ? err.message : String(err),
      });
      const message = err instanceof Error ? err.message : 'Failed to get location';
      store.setLocationError(getLocationErrorMessage(message));
    }

    animateTransition(() => store.setState('REVIEW'));
  }, [animateTransition, store]);

  const handleRecordingCancel = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Alert.alert(
      'Cancel Recording',
      'Are you sure you want to cancel this recording session?',
      [
        { text: 'Continue Recording', style: 'cancel' },
        {
          text: 'Cancel',
          style: 'destructive',
          onPress: () => {
            animateTransition(() => store.reset());
          },
        },
      ]
    );
  }, [animateTransition, store]);

  const handleReviewContinue = useCallback((detectedSounds?: string | null) => {
    if (typeof detectedSounds !== 'undefined') {
      store.setDetectedSounds(detectedSounds);
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    // Go to photo capture instead of directly to circumplex
    animateTransition(() => store.setState('PHOTO_CAPTURE'));
  }, [animateTransition, store]);

  const handlePhotoCaptured = useCallback((uri: string, classifications?: ImageClassification[]) => {
    store.setPhotoData(uri, classifications);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    animateTransition(() => store.setState('NOTES'));
  }, [animateTransition, store]);

  const handlePhotoSkip = useCallback(() => {
    store.setPhotoData(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    animateTransition(() => store.setState('NOTES'));
  }, [animateTransition, store]);

  const handleNotesConfirm = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    animateTransition(() => store.setState('CIRCUMPLEX'));
  }, [animateTransition, store]);

  const handleReviewRetake = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    animateTransition(() => store.setState('RECORDING'));
  }, [animateTransition, store]);

  const handleCircumplexConfirm = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    animateTransition(() => store.setState('SENSES'));
  }, [animateTransition, store]);

  const handleSensesConfirm = useCallback(() => {
    animateTransition(() => store.setState('CONTEXT'));
  }, [animateTransition, store]);

  const getStoredLocation = useCallback(() => {
    if (!store.location) {
      return {
        latitude: null,
        longitude: null,
        gpsAccuracy: null,
      };
    }

    if (store.privacyMode === 'hidden') {
      return {
        latitude: null,
        longitude: null,
        gpsAccuracy: null,
      };
    }

    if (store.privacyMode === 'fuzzed') {
      return {
        latitude: Math.round(store.location.latitude * 200) / 200,
        longitude: Math.round(store.location.longitude * 200) / 200,
        gpsAccuracy: Math.max(store.location.accuracy ?? 0, 500),
      };
    }

    return {
      latitude: store.location.latitude,
      longitude: store.location.longitude,
      gpsAccuracy: store.location.accuracy ?? null,
    };
  }, [store.location, store.privacyMode]);

  const saveRecording = useCallback(async () => {
    const current = useRecordingStore.getState();
    store.setState('SAVING');

    try {
      const deviceModel = Device.modelName ?? 'Unknown';
      const osVersion = `${Device.osName} ${Device.osVersion}`;
      const storedLocation = (() => {
        if (!current.location) {
          return { latitude: null, longitude: null, gpsAccuracy: null };
        }

        if (current.privacyMode === 'hidden') {
          return { latitude: null, longitude: null, gpsAccuracy: null };
        }

        if (current.privacyMode === 'fuzzed') {
          return {
            latitude: Math.round(current.location.latitude * 200) / 200,
            longitude: Math.round(current.location.longitude * 200) / 200,
            gpsAccuracy: Math.max(current.location.accuracy ?? 0, 500),
          };
        }

        return {
          latitude: current.location.latitude,
          longitude: current.location.longitude,
          gpsAccuracy: current.location.accuracy ?? null,
        };
      })();

      const recording = await createRecording({
        audioUri: current.audioUri!,
        sampleRate: 48000,
        bitDepth: 16,
        durationMs: current.durationMs,
        deviceModel,
        osVersion,
        micRoute: 'builtin',
        recordedAt: new Date().toISOString(),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        latitude: storedLocation.latitude,
        longitude: storedLocation.longitude,
        gpsAccuracy: storedLocation.gpsAccuracy,
        privacyMode: current.privacyMode,
        protocolType: current.protocolType,
        hasClipping: current.qualityFlags.hasClipping,
        hasWindHandling: current.qualityFlags.hasWindHandling,
        hasLowSNR: current.qualityFlags.hasLowSNR,
        peakDb: current.qualityFlags.peakDb,
        rmsDb: current.qualityFlags.rmsDb,
        normalizationApplied: current.normalizationApplied,
        normalizationGain: current.normalizationGain,
        acousticMetrics: current.acousticMetrics ?? undefined,
        multisensory: serializeMultisensory(current.multisensory),
        habitatType: current.habitatType ?? undefined,
        settingChips: current.settingContext ? JSON.stringify(current.settingContext) : undefined,
        sourceDominance: current.sourceDominance ? JSON.stringify(current.sourceDominance) : undefined,
        license: current.license,
        communityVisibility: current.communityVisibility,
        syncStatus: 'local',
        spectrogramUri: current.spectrogramUri ?? undefined,
        detectedSounds: current.detectedSounds ?? undefined,
        photoUri: current.photoUri ?? undefined,
        photoClassification: current.photoClassification ?? undefined,
        fieldNotes: current.fieldNotes.trim() || undefined,
        spokenDescription: current.spokenDescription.trim() || undefined,
      });

      const resolvedCircumplex = current.circumplex ?? (current.paq ? calculateCircumplexFromPAQ(current.paq) : null);

      const perception = resolvedCircumplex
        ? await createPerception(
          recording.id,
          resolvedCircumplex,
          current.paq ?? undefined
        )
        : undefined;

      libraryStore.addRecording({
        ...recording,
        perception,
      });

      await queueForUpload(recording.id);

      // Check for new badges after successful save
      const badgeResult = await badgeStore.checkAndAwardBadges(new Date());

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      // Don't show alert if we have badges to celebrate - the celebration overlay handles feedback
      if (badgeResult.newBadges.length === 0) {
        Alert.alert(
          'Recording Saved',
          current.communityVisibility === 'community'
            ? 'Your soundscape recording has been saved and queued for community publication when sync completes.'
            : 'Your soundscape recording has been saved and queued for your private cloud archive.',
          [{ text: 'OK' }]
        );
      }

      store.reset();
    } catch (err) {
      LoggingService.error('Failed to save recording', {
        error: err instanceof Error ? err.message : String(err),
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Save failed', getSaveErrorMessage(err instanceof Error ? err.message : undefined));
      store.setState('CONTEXT');
    }
  }, [getStoredLocation, store, libraryStore]);

  const handleContextConfirm = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    saveRecording();
  }, [saveRecording]);

  const handleContextSkip = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    saveRecording();
  }, [saveRecording]);

  const handleReturnHome = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Alert.alert(
      'Discard this session?',
      'This will cancel the current recording workflow and return to the start screen without saving.',
      [
        { text: 'Keep editing', style: 'cancel' },
        {
          text: 'Discard',
          style: 'destructive',
          onPress: () => {
            animateTransition(() => store.reset());
          },
        },
      ]
    );
  }, [animateTransition, store]);

  return {
    state: store.state,
    fadeAnim,
    store,
    startMeasurement,
    handleProtocolConfirm,
    handleCountdownComplete,
    handleRecordingComplete,
    handleRecordingCancel,
    handleReviewContinue,
    handleReviewRetake,
    handlePhotoCaptured,
    handlePhotoSkip,
    handleNotesConfirm,
    handleCircumplexConfirm,
    handleSensesConfirm,
    handleContextConfirm,
    handleContextSkip,
    handleReturnHome,
  };
}
