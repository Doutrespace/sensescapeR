import { useCallback, useRef } from 'react';
import { Alert, Animated, Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Haptics from 'expo-haptics';

import { useRecordingStore, type RecordingState } from '../stores/useRecordingStore';
import { useLibraryStore } from '../stores/useLibraryStore';
import { usePreferencesStore } from '../stores/usePreferencesStore';
import { useBadgeStore } from '../stores/useBadgeStore';
import { useParticipantStore } from '../stores/useParticipantStore';
import { createRecording, deleteRecording } from '../services/database/recordings';
import { flushStorage } from '../services/storage/flushStorage';
import { createPerception, calculateCircumplexFromPAQ } from '../services/database/perceptions';
import { LoggingService } from '../services/logging/LoggingService';
import { queueForUpload } from '../services/sync/syncManager';
import { getCaptureInfo } from '../services/audio/captureInfo';
import { watchPosition, type PositionWatch } from '../services/location/positionWatcher';
import { QualityFlags } from '../types/recording';
import { serializeMultisensory } from '../types/multisensory';
import { CONSENT_VERSION, PERSON_ITEMS, QUESTIONNAIRE_VERSION } from '../study/core';
import { getStudyGroup, personSections, runSections } from '../study/groups';
import { RUN_DATA_SCHEMA, serializeRunStudyData, type RunStudyData } from '../study/runData';
import {
  allItems,
  countAnswered,
  pickAnswers,
  sanitizeAnswers,
  type StudyGroup,
} from '../study/types';
import { createUuid } from '../utils/ids';
import { getLanguage, t } from '../i18n';
import type { ImageClassification } from '../utils/imageClassification';

const APP_VERSION = Constants.expoConfig?.version ?? '';
/** Extra wait for a first fix once the recording has ended. */
const LOCATION_GRACE_MS = 3000;
/** The position is not followed any longer than this after the recording. */
const LOCATION_WATCH_LIMIT_MS = 60000;

function getLocationErrorMessage(error?: string): string {
  if (!error) {
    return t('Location could not be determined. You can still save the recording without coordinates.');
  }

  const normalized = error.toLowerCase();
  if (normalized.includes('denied')) {
    return t('Location permission was denied. You can still save the recording without coordinates.');
  }
  if (normalized.includes('timeout') || normalized.includes('timed out')) {
    return t('Location lookup timed out. Move to a more open area or save without coordinates.');
  }
  return t('Location could not be determined. You can still save the recording without coordinates.');
}

function getSaveErrorMessage(error?: string): string {
  if (!error) {
    return t('The recording could not be saved. Please try again.');
  }

  const normalized = error.toLowerCase();
  if (normalized.includes('invalid audio file path')) {
    return t('The recorded audio file could not be found anymore. Retake the recording and save again.');
  }
  if (normalized.includes('invalid coordinates')) {
    return t('The saved location data was invalid. Review the privacy settings or save without coordinates.');
  }
  if (normalized.includes('disk') || normalized.includes('space') || normalized.includes('storage') || normalized.includes('quota')) {
    return t('There is not enough local storage to save this recording. Free some space and try again.');
  }
  return t('The recording could not be saved. Please try again.');
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Screen to go back to from each questionnaire step. */
const PREVIOUS_STEP: Partial<Record<RecordingState, RecordingState>> = {
  CIRCUMPLEX: 'NOTES',
  SENSES: 'CIRCUMPLEX',
  CONTEXT: 'SENSES',
  GROUP_SELECT: 'CONTEXT',
  GROUP: 'GROUP_SELECT',
};

export function useRecordingFlow() {
  const store = useRecordingStore();
  const libraryStore = useLibraryStore();
  const preferences = usePreferencesStore();
  const badgeStore = useBadgeStore();
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const locationWatch = useRef<PositionWatch | null>(null);
  const locationStopTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Counts sessions, so a late position of an earlier session is ignored.
  const locationSession = useRef(0);
  const bestAccuracy = useRef<number | null>(null);

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

  const stopLocationWatch = useCallback(() => {
    locationWatch.current?.stop();
    locationWatch.current = null;
    if (locationStopTimer.current) {
      clearTimeout(locationStopTimer.current);
      locationStopTimer.current = null;
    }
  }, []);

  /**
   * Follows the position while the sound is recorded and keeps the most
   * accurate fix. It never blocks the flow; the fix describes where the
   * recording was made because it is taken during the recording.
   */
  const startLocationWatch = useCallback(() => {
    stopLocationWatch();
    const session = ++locationSession.current;
    bestAccuracy.current = null;

    locationWatch.current = watchPosition(
      (fix) => {
        if (session !== locationSession.current) {
          return;
        }
        if (bestAccuracy.current !== null && fix.accuracy >= bestAccuracy.current) {
          return;
        }
        bestAccuracy.current = fix.accuracy;
        const current = useRecordingStore.getState();
        current.setLocation({
          latitude: fix.latitude,
          longitude: fix.longitude,
          accuracy: fix.accuracy,
          altitude: fix.altitude,
        });
        current.setLocationError(null);
      },
      (reason) => {
        if (session !== locationSession.current) {
          return;
        }
        LoggingService.warn('Failed to capture location for recording', { reason });
        const current = useRecordingStore.getState();
        if (!current.location) {
          current.setLocationError(getLocationErrorMessage(reason));
        }
        if (reason === 'denied') {
          stopLocationWatch();
        }
      }
    );
  }, [stopLocationWatch]);

  const startMeasurement = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    store.setLicense(preferences.defaultLicense);
    store.setPrivacyMode(preferences.defaultPrivacyMode);
    store.setCommunityVisibility(preferences.defaultCommunityVisibility);
    store.setProtocol('opportunistic', 30000);
    store.setRespondent(useParticipantStore.getState().lastRespondent);
    startLocationWatch();
    animateTransition(() => store.setState('RECORDING'));
  }, [
    animateTransition,
    startLocationWatch,
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
    // The recorder reports back when the clip is finished: it started
    // `duration` earlier. This is the time stored as "recorded at".
    store.setStartedAt(new Date(Date.now() - Math.max(0, duration)).toISOString());

    // Normally the position is known by now. If not, give it a moment and go
    // on; a first fix that arrives later is still stored.
    if (!useRecordingStore.getState().location) {
      await delay(LOCATION_GRACE_MS);
    }

    if (useRecordingStore.getState().location) {
      // The recording is over: the position must not follow the user home.
      stopLocationWatch();
    } else if (locationWatch.current) {
      const session = locationSession.current;
      locationStopTimer.current = setTimeout(() => {
        if (session === locationSession.current) {
          stopLocationWatch();
        }
      }, LOCATION_WATCH_LIMIT_MS);
    }

    animateTransition(() => store.setState('REVIEW'));
  }, [animateTransition, stopLocationWatch, store]);

  const handleRecordingCancel = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Alert.alert(
      t('Cancel Recording'),
      t('Are you sure you want to cancel this recording session?'),
      [
        { text: t('Continue Recording'), style: 'cancel' },
        {
          text: t('Cancel'),
          style: 'destructive',
          onPress: () => {
            stopLocationWatch();
            locationSession.current++;
            animateTransition(() => store.reset());
          },
        },
      ]
    );
  }, [animateTransition, stopLocationWatch, store]);

  const handleReviewContinue = useCallback((detectedSounds?: string | null) => {
    if (typeof detectedSounds !== 'undefined') {
      store.setDetectedSounds(detectedSounds);
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
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
    store.setMainQuestionnaireSkipped(false);
    animateTransition(() => store.setState('CIRCUMPLEX'));
  }, [animateTransition, store]);

  /**
   * Shortcut from the notes straight to the choice of the project group,
   * past perception, senses and context. Without the context step nobody
   * records an interviewed person's consent, so the answers count as the
   * participant's own.
   */
  const handleJumpToGroups = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    store.setRespondent('self');
    store.setMainQuestionnaireSkipped(true);
    animateTransition(() => store.setState('GROUP_SELECT'));
  }, [animateTransition, store]);

  const handleReviewRetake = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    // A new take gets a new position.
    startLocationWatch();
    animateTransition(() => store.setState('RECORDING'));
  }, [animateTransition, startLocationWatch, store]);

  const handleCircumplexConfirm = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    animateTransition(() => store.setState('SENSES'));
  }, [animateTransition, store]);

  const handleSensesConfirm = useCallback(() => {
    animateTransition(() => store.setState('CONTEXT'));
  }, [animateTransition, store]);

  /** Main questionnaire finished: on to the choice of the project group. */
  const handleContextConfirm = useCallback(() => {
    animateTransition(() => store.setState('GROUP_SELECT'));
  }, [animateTransition, store]);

  const handleGroupSelect = useCallback((group: StudyGroup) => {
    const current = useRecordingStore.getState();
    if (current.groupId !== group.id) {
      // The group's personal questions are asked once per person: start from
      // the stored answers, unless somebody else is being interviewed.
      const stored = current.respondent === 'self'
        ? useParticipantStore.getState().groupPersonAnswers[group.id]
        : undefined;
      store.setGroup(group.id, stored ? { ...stored } : {});
    }
    animateTransition(() => store.setState('GROUP'));
  }, [animateTransition, store]);

  /** One step back in the questionnaire; answers given so far are kept. */
  const handleBack = useCallback(() => {
    const current = useRecordingStore.getState();
    // After the shortcut, the group choice leads back to the notes.
    const previous = current.state === 'GROUP_SELECT' && current.mainQuestionnaireSkipped
      ? 'NOTES'
      : PREVIOUS_STEP[current.state];
    if (previous) {
      animateTransition(() => store.setState(previous));
    }
  }, [animateTransition, store]);

  const saveRecording = useCallback(async () => {
    const current = useRecordingStore.getState();
    const participant = useParticipantStore.getState();
    const group = getStudyGroup(current.groupId);
    const returnState: RecordingState = group ? 'GROUP' : 'GROUP_SELECT';
    stopLocationWatch();
    store.setState('SAVING');

    try {
      const deviceModel = Device.modelName ?? t('Unknown');
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

      const savedAt = new Date().toISOString();
      const recordedAt = current.startedAt
        ?? new Date(Date.now() - current.durationMs).toISOString();
      const isInterview = current.respondent === 'other';
      const groupAnswers = group
        ? sanitizeAnswers(allItems(group.sections), current.groupAnswers)
        : {};
      const runNumber = participant.runCounter + 1;

      const studyData: RunStudyData = {
        schema: RUN_DATA_SCHEMA,
        collectorId: participant.participantId,
        respondent: current.respondent,
        respondentId: isInterview ? createUuid() : participant.participantId,
        person: isInterview
          ? sanitizeAnswers(PERSON_ITEMS, current.respondentPerson)
          : participant.personAnswers,
        consentVersion: isInterview
          ? (current.respondentConsent ? CONSENT_VERSION : null)
          : participant.consent?.version ?? null,
        consentAt: isInterview ? savedAt : participant.consent?.givenAt ?? null,
        visitMode: current.visitMode,
        siteCode: current.siteCode.trim() || null,
        groupId: group?.id ?? null,
        groupAnswers,
        mainQuestionnaireSkipped: current.mainQuestionnaireSkipped,
        runNumber,
        questionnaireVersion: QUESTIONNAIRE_VERSION,
        appVersion: APP_VERSION,
        appLanguage: getLanguage(),
        platform: Platform.OS,
        userAgent: Platform.OS === 'web' && typeof navigator !== 'undefined'
          ? navigator.userAgent
          : null,
        savedAt,
        capture: getCaptureInfo(),
      };

      const recording = await createRecording({
        audioUri: current.audioUri!,
        sampleRate: 48000,
        bitDepth: 16,
        durationMs: current.durationMs,
        deviceModel,
        osVersion,
        micRoute: 'builtin',
        recordedAt,
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
        participantId: participant.participantId,
        groupId: group?.id,
        studyData: serializeRunStudyData(studyData),
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

      // Only now is it certain that the measurement survives a reload.
      try {
        await flushStorage();
      } catch (storageError) {
        // Not on disk: take the row back out so a second attempt does not
        // leave two copies behind, and report the failure.
        await deleteRecording(recording.id).catch(() => undefined);
        throw new Error(`storage: ${storageError instanceof Error ? storageError.message : String(storageError)}`);
      }

      libraryStore.addRecording({
        ...recording,
        perception,
      });

      // The measurement is stored. What follows must not undo that.
      try {
        await participant.nextRunNumber();
        await participant.setLastRespondent(current.respondent);
        if (group) {
          await participant.setLastGroupId(group.id);
          const personItems = allItems(personSections(group));
          if (!isInterview && personItems.length > 0) {
            await participant.setGroupPersonAnswers(group.id, pickAnswers(personItems, groupAnswers));
          }
        }
        await queueForUpload(recording.id);
        await badgeStore.checkAndAwardBadges(new Date());
      } catch (followUpError) {
        LoggingService.warn('Follow-up after saving a recording failed', {
          error: followUpError instanceof Error ? followUpError.message : String(followUpError),
        });
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      const groupProgress = group
        ? countAnswered(allItems(runSections(group)), groupAnswers)
        : { answered: 0, total: 0 };

      store.finishSession({
        recordingId: recording.id,
        runNumber,
        groupId: group?.id ?? null,
        hasLocation: storedLocation.latitude !== null,
        recordedAt,
        answeredGroupItems: groupProgress.answered,
        totalGroupItems: groupProgress.total,
      });
    } catch (err) {
      LoggingService.error('Failed to save recording', {
        error: err instanceof Error ? err.message : String(err),
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert(t('Save failed'), getSaveErrorMessage(err instanceof Error ? err.message : undefined));
      store.setState(returnState);
    }
  }, [badgeStore, libraryStore, stopLocationWatch, store]);

  const handleReturnHome = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Alert.alert(
      t('Discard this session?'),
      t('This will cancel the current recording workflow and return to the start screen without saving.'),
      [
        { text: t('Keep editing'), style: 'cancel' },
        {
          text: t('Discard'),
          style: 'destructive',
          onPress: () => {
            stopLocationWatch();
            locationSession.current++;
            animateTransition(() => store.reset());
          },
        },
      ]
    );
  }, [animateTransition, stopLocationWatch, store]);

  /** Leaves the completion screen. */
  const handleDoneClose = useCallback(() => {
    animateTransition(() => store.reset());
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
    handleJumpToGroups,
    handleCircumplexConfirm,
    handleSensesConfirm,
    handleContextConfirm,
    handleGroupSelect,
    handleBack,
    saveRecording,
    handleReturnHome,
    handleDoneClose,
  };
}
