import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Animated, Alert, Platform } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';

import { Colors } from '../../src/theme/colors';
import { useRecordingFlow } from '../../src/hooks/useRecordingFlow';

import StepProgress from '../../src/components/ui/StepProgress';
import EnhancedRecorder from '../../src/components/recording/EnhancedRecorder';
import { CountdownOverlay } from '../../src/components/recording/CountdownOverlay';
import ReviewScreen from '../../src/components/review/ReviewScreen';
import PhotoCaptureScreen from '../../src/components/photo/PhotoCaptureScreen';
import FieldNotesScreen from '../../src/components/notes/FieldNotesScreen';
import CircumplexInput from '../../src/components/perception/CircumplexInput';
import MultisensoryScreen from '../../src/components/multisensory/MultisensoryScreen';
import ContextScreen from '../../src/components/context/ContextScreen';
import SaveVisibilitySheet from '../../src/components/context/SaveVisibilitySheet';
import GroupSelectScreen from '../../src/components/study/GroupSelectScreen';
import GroupQuestionnaire from '../../src/components/study/GroupQuestionnaire';
import DoneScreen from '../../src/components/study/DoneScreen';
import { STUDY_GROUPS, getStudyGroup } from '../../src/study/groups';
import { useParticipantStore } from '../../src/stores/useParticipantStore';
import { toParticipantCode } from '../../src/utils/ids';
import { getRecordingsWithPerceptions } from '../../src/services/database/recordings';
import { ExportService } from '../../src/services/export';
import { HomeScreen, SavingScreen } from '../../src/components/home';
import { useSyncStore } from '../../src/stores/useSyncStore';
import { usePreferencesStore } from '../../src/stores/usePreferencesStore';
import { useBadgeStore } from '../../src/stores/useBadgeStore';
import { InlineSyncStatus } from '../../src/components/sync/InlineSyncStatus';
import { BadgeCelebration } from '../../src/components/badges';
import { supabase, isSupabaseConfigured } from '../../src/utils/supabase';
import { LoggingService } from '../../src/services/logging/LoggingService';
import { parseDetectedSounds, serializeDetectedSounds } from '../../src/utils/detectedSounds';
import {
  cancelSpokenDescriptionTranscription,
  isSpokenDescriptionTranscriptionAvailable,
  stopSpokenDescriptionTranscription,
  transcribeSpokenDescription,
} from '../../src/services/transcription/spokenDescriptionTranscriber';
import { t } from '../../src/i18n';

const FLOW_STEPS = [
  { key: 'RECORDING', label: 'Recording' },
  { key: 'REVIEW', label: 'Review' },
  { key: 'PHOTO_CAPTURE', label: 'Photo' },
  { key: 'NOTES', label: 'Notes' },
  { key: 'CIRCUMPLEX', label: 'Perception' },
  { key: 'SENSES', label: 'Senses' },
  { key: 'CONTEXT', label: 'Context' },
  { key: 'GROUP', label: 'Project group' },
];

const STEP_STATES = ['REVIEW', 'PHOTO_CAPTURE', 'NOTES', 'CIRCUMPLEX', 'SENSES', 'CONTEXT', 'GROUP_SELECT', 'GROUP'];

export default function RecordScreen() {
  const flow = useRecordingFlow();
  const { isOnline, isUploading, queue } = useSyncStore();
  const { audioLevelingMode } = usePreferencesStore();
  const pendingCelebration = useBadgeStore((state) => state.pendingCelebration);
  const dismissCelebration = useBadgeStore((state) => state.dismissCelebration);
  const [communityCount, setCommunityCount] = useState<number | null>(null);
  const [isTranscribingSpokenDescription, setIsTranscribingSpokenDescription] = useState(false);
  const [showVisibilitySheet, setShowVisibilitySheet] = useState(false);
  const router = useRouter();
  const participantId = useParticipantStore((state) => state.participantId);
  const lastGroupId = useParticipantStore((state) => state.lastGroupId);
  const groupPersonAnswers = useParticipantStore((state) => state.groupPersonAnswers);
  const runCounter = useParticipantStore((state) => state.runCounter);
  const showStepProgress = STEP_STATES.includes(flow.state);
  // Choosing the group and answering its questions are one step in the bar.
  const progressStep = flow.state === 'GROUP_SELECT' ? 'GROUP' : flow.state;
  const queuedCount = queue.length;
  const failedCount = queue.filter((item) => !!item.lastError || item.attempts >= 5).length;
  const showSyncStatus = flow.state !== 'RECORDING'
    && flow.state !== 'SAVING'
    && (!isOnline || isUploading || queuedCount > 0 || failedCount > 0);
  const showReturnHome = flow.state !== 'IDLE' && flow.state !== 'SAVING' && flow.state !== 'DONE';

  const refreshCommunityCount = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setCommunityCount(null);
      return;
    }

    try {
      const { count, error } = await supabase
        .from('recordings')
        .select('id', { count: 'exact', head: true })
        .eq('community_visibility', 'community');

      if (error) {
        throw error;
      }

      setCommunityCount(count ?? 0);
    } catch (error) {
      LoggingService.warn('Failed to refresh community count for home screen', {
        error: error instanceof Error ? error.message : String(error),
      });
      setCommunityCount(null);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    void refreshCommunityCount();
  }, [refreshCommunityCount]));

  useEffect(() => {
    if (flow.store.pendingShortcutAction === 'START_RECORDING' && flow.state === 'IDLE') {
      flow.store.consumeShortcutAction();
      flow.startMeasurement();
    }
  }, [flow.startMeasurement, flow.state, flow.store]);

  useEffect(() => {
    return () => {
      cancelSpokenDescriptionTranscription();
    };
  }, []);

  // Browser: leaving the page (reload, back gesture, closing the tab) would
  // discard a measurement in progress, so ask first.
  const hasUnsavedSession = flow.state !== 'IDLE' && flow.state !== 'DONE';
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined' || !hasUnsavedSession) {
      return;
    }
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [hasUnsavedSession]);

  const handleRecordSpokenDescription = useCallback(() => {
    if (isTranscribingSpokenDescription) {
      stopSpokenDescriptionTranscription();
      return;
    }

    setIsTranscribingSpokenDescription(true);

    const locale = Intl.DateTimeFormat().resolvedOptions().locale;

    void transcribeSpokenDescription(locale, 600)
      .then((transcript) => {
        flow.store.setSpokenDescription(transcript.trim());
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      })
      .catch((error) => {
        const message = error instanceof Error ? error.message : String(error);

        if (!message.includes('CANCELLED')) {
          LoggingService.warn('Spoken description transcription failed', { error: message });
          Alert.alert(t('Transcription failed'), message);
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        }
      })
      .finally(() => {
        setIsTranscribingSpokenDescription(false);
      });
  }, [flow.store, isTranscribingSpokenDescription]);

  const handleClearSpokenDescription = useCallback(() => {
    if (isTranscribingSpokenDescription) {
      cancelSpokenDescriptionTranscription();
      setIsTranscribingSpokenDescription(false);
      return;
    }

    flow.store.setSpokenDescription('');
  }, [flow.store, isTranscribingSpokenDescription]);

  // With cloud sync, ask once more whether the measurement is private or public.
  const requestSave = useCallback(() => {
    if (isSupabaseConfigured) {
      setShowVisibilitySheet(true);
    } else {
      void flow.saveRecording();
    }
  }, [flow.saveRecording]);

  const handleExportAll = useCallback(async () => {
    try {
      const recordings = await getRecordingsWithPerceptions();
      if (recordings.length === 0) {
        return;
      }
      const result = await ExportService.exportAsCSV(recordings);
      if (!result.success) {
        Alert.alert(t('Export failed'), result.error ?? t('The data could not be exported.'));
      }
    } catch (error) {
      LoggingService.warn('Export from the completion screen failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      Alert.alert(t('Export failed'), t('The data could not be exported.'));
    }
  }, []);

  const renderContent = () => {
    switch (flow.state) {
      case 'IDLE':
        return (
          <HomeScreen
            onStartMeasurement={flow.startMeasurement}
            communityCount={communityCount}
            participantCode={toParticipantCode(participantId)}
            measurementCount={runCounter}
          />
        );

      case 'COUNTDOWN':
        return <CountdownOverlay onComplete={flow.handleCountdownComplete} />;

      case 'RECORDING':
        return (
          <EnhancedRecorder
            targetDuration={flow.store.targetDuration}
            audioLevelingMode={audioLevelingMode}
            location={flow.store.location}
            onRecordingComplete={flow.handleRecordingComplete}
            onCancel={flow.handleRecordingCancel}
          />
        );

      case 'REVIEW':
        const reviewedDetectedSounds = parseDetectedSounds(flow.store.detectedSounds);
        return (
          <ReviewScreen
            audioUri={flow.store.audioUri!}
            duration={flow.store.durationMs}
            qualityFlags={flow.store.qualityFlags}
            spectrogramUri={flow.store.spectrogramUri}
            normalizationApplied={flow.store.normalizationApplied}
            normalizationGain={flow.store.normalizationGain}
            detectedSounds={reviewedDetectedSounds}
            onContinue={(sounds) => flow.handleReviewContinue(serializeDetectedSounds(sounds))}
            onRetake={flow.handleReviewRetake}
          />
        );

      case 'PHOTO_CAPTURE':
        return (
          <PhotoCaptureScreen
            onPhotoCaptured={flow.handlePhotoCaptured}
            onSkip={flow.handlePhotoSkip}
          />
        );

      case 'NOTES':
        return (
          <FieldNotesScreen
            fieldNotes={flow.store.fieldNotes}
            spokenDescription={flow.store.spokenDescription}
            onFieldNotesChange={flow.store.setFieldNotes}
            onSpokenDescriptionChange={flow.store.setSpokenDescription}
            voiceTranscriptionSupported={isSpokenDescriptionTranscriptionAvailable()}
            isTranscribingSpokenDescription={isTranscribingSpokenDescription}
            onRecordSpokenDescription={handleRecordSpokenDescription}
            onClearSpokenDescription={handleClearSpokenDescription}
            onContinue={flow.handleNotesConfirm}
          />
        );

      case 'CIRCUMPLEX':
        return (
          <CircumplexInput
            value={flow.store.circumplex ?? { pleasant: 0, eventful: 0 }}
            hasSelection={flow.store.circumplex !== null}
            onChange={flow.store.setCircumplex}
            onConfirm={flow.handleCircumplexConfirm}
            onBack={flow.handleBack}
          />
        );

      case 'SENSES':
        return (
          <MultisensoryScreen
            value={flow.store.multisensory}
            onChange={flow.store.setMultisensory}
            onConfirm={flow.handleSensesConfirm}
            onBack={flow.handleBack}
          />
        );

      case 'CONTEXT':
        return (
          <ContextScreen
            habitatType={flow.store.habitatType}
            settingContext={flow.store.settingContext}
            visitMode={flow.store.visitMode}
            siteCode={flow.store.siteCode}
            respondent={flow.store.respondent}
            respondentPerson={flow.store.respondentPerson}
            respondentConsent={flow.store.respondentConsent}
            locationError={flow.store.location ? null : flow.store.locationError}
            onHabitatChange={flow.store.setHabitatType}
            onSettingContextChange={flow.store.setSettingContext}
            onVisitModeChange={flow.store.setVisitMode}
            onSiteCodeChange={flow.store.setSiteCode}
            onRespondentChange={flow.store.setRespondent}
            onRespondentPersonChange={flow.store.setRespondentPerson}
            onRespondentConsentChange={flow.store.setRespondentConsent}
            onConfirm={flow.handleContextConfirm}
            onBack={flow.handleBack}
          />
        );

      case 'GROUP_SELECT':
        return (
          <GroupSelectScreen
            groups={STUDY_GROUPS}
            lastGroupId={lastGroupId}
            onSelect={flow.handleGroupSelect}
            onSaveWithoutGroup={() => {
              flow.store.setGroup(null);
              requestSave();
            }}
            onBack={flow.handleBack}
          />
        );

      case 'GROUP': {
        const group = getStudyGroup(flow.store.groupId);
        if (!group) {
          return null;
        }
        return (
          <GroupQuestionnaire
            // A different group starts with its own first page.
            key={group.id}
            group={group}
            answers={flow.store.groupAnswers}
            onChange={flow.store.setGroupAnswers}
            personAlreadyAnswered={
              flow.store.respondent === 'self' && groupPersonAnswers[group.id] !== undefined
            }
            onBack={flow.handleBack}
            onSave={requestSave}
          />
        );
      }

      case 'DONE':
        return flow.store.lastSaved ? (
          <DoneScreen
            summary={flow.store.lastSaved}
            participantCode={toParticipantCode(participantId)}
            cloudConfigured={isSupabaseConfigured}
            onNewMeasurement={flow.startMeasurement}
            onOpenMap={() => {
              flow.handleDoneClose();
              router.push('/(tabs)/my-map');
            }}
            onExport={handleExportAll}
            onGoHome={flow.handleDoneClose}
          />
        ) : null;

      case 'SAVING':
        return <SavingScreen />;

      default:
        return null;
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style="dark" />

      {showStepProgress && (
        <StepProgress
          steps={FLOW_STEPS}
          currentStep={progressStep}
          onHomePress={showReturnHome ? flow.handleReturnHome : undefined}
        />
      )}

      {showSyncStatus && (
        <InlineSyncStatus
          isOnline={isOnline}
          isUploading={isUploading}
          queuedCount={queuedCount}
          failedCount={failedCount}
        />
      )}

      <Animated.View style={[styles.content, { opacity: flow.fadeAnim }]}>
        {renderContent()}
      </Animated.View>

      <SaveVisibilitySheet
        visible={showVisibilitySheet}
        privacyMode={flow.store.privacyMode}
        communityVisibility={flow.store.communityVisibility}
        onClose={() => setShowVisibilitySheet(false)}
        onConfirm={(visibility) => {
          flow.store.setCommunityVisibility(visibility);
          setShowVisibilitySheet(false);
          void flow.saveRecording();
        }}
      />

      {pendingCelebration && (
        <BadgeCelebration
          badge={pendingCelebration}
          onDismiss={dismissCelebration}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    flex: 1,
  },
});
