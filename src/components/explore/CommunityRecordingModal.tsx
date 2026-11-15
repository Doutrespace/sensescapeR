import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Colors } from '../../theme/colors';
import { CommunityRecording } from '../../stores/useExploreStore';
import { RecordingDetailModal } from '../library/RecordingDetailModal';
import { supabase } from '../../utils/supabase';
import { RecordingWithPerception } from '../../types/recording';
import { LoggingService } from '../../services/logging';

interface Props {
  visible: boolean;
  recording: CommunityRecording | null;
  onClose: () => void;
}

export function CommunityRecordingModal({ visible, recording, onClose }: Props) {
  const [audioUri, setAudioUri] = useState<string | null>(null);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [spectrogramUri, setSpectrogramUri] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadSignedMedia() {
      if (!visible || !recording) {
        setAudioUri(null);
        setPhotoUri(null);
        setSpectrogramUri(null);
        return;
      }

      setIsLoading(true);

      try {
        const [audioResult, photoResult, spectrogramResult] = await Promise.all([
          recording.audioPath
            ? supabase.storage.from('soundscapes').createSignedUrl(recording.audioPath, 60 * 60)
            : Promise.resolve({ data: null, error: null }),
          recording.photoPath
            ? supabase.storage.from('soundscapes').createSignedUrl(recording.photoPath, 60 * 60)
            : Promise.resolve({ data: null, error: null }),
          recording.spectrogramPath
            ? supabase.storage.from('soundscapes').createSignedUrl(recording.spectrogramPath, 60 * 60)
            : Promise.resolve({ data: null, error: null }),
        ]);

        if (!active) {
          return;
        }

        if (audioResult.error) {
          LoggingService.warn('Failed to create signed audio URL for community recording', {
            recordingId: recording.id,
            error: audioResult.error.message,
          });
        }
        if (photoResult.error) {
          LoggingService.warn('Failed to create signed photo URL for community recording', {
            recordingId: recording.id,
            error: photoResult.error.message,
          });
        }
        if (spectrogramResult.error) {
          LoggingService.warn('Failed to create signed spectrogram URL for community recording', {
            recordingId: recording.id,
            error: spectrogramResult.error.message,
          });
        }

        setAudioUri(audioResult.data?.signedUrl ?? null);
        setPhotoUri(photoResult.data?.signedUrl ?? null);
        setSpectrogramUri(spectrogramResult.data?.signedUrl ?? null);
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    }

    void loadSignedMedia();

    return () => {
      active = false;
    };
  }, [recording, visible]);

  const adaptedRecording = useMemo<RecordingWithPerception | null>(() => {
    if (!recording) {
      return null;
    }

    return {
      id: `community-${recording.id}`,
      audioUri: audioUri ?? '',
      sampleRate: recording.sampleRate || 48000,
      bitDepth: recording.bitDepth || 16,
      durationMs: recording.durationMs,
      deviceModel: recording.deviceModel,
      osVersion: recording.osVersion,
      micRoute: recording.micRoute,
      recordedAt: recording.recordedAt,
      timezone: recording.timezone,
      latitude: recording.latitude,
      longitude: recording.longitude,
      gpsAccuracy: recording.gpsAccuracy,
      privacyMode: (recording.privacyMode as any) ?? 'exact',
      protocolType: recording.protocolType as any,
      hasClipping: false,
      hasWindHandling: false,
      hasLowSNR: false,
      peakDb: undefined,
      rmsDb: undefined,
      spectrogramUri: spectrogramUri ?? undefined,
      detectedSounds: JSON.stringify(recording.detectedSounds ?? []),
      photoUri: photoUri ?? undefined,
      photoClassification: recording.photoClassification,
      fieldNotes: recording.fieldNotes ?? undefined,
      spokenDescription: recording.spokenDescription ?? undefined,
      habitatType: recording.habitatType as any,
      settingChips: undefined,
      sourceDominance: undefined,
      license: undefined,
      communityVisibility: 'community',
      syncStatus: 'uploaded',
      remoteId: recording.id,
      createdAt: recording.recordedAt,
      updatedAt: recording.recordedAt,
      perception: recording.perception
        ? {
            id: `community-perception-${recording.id}`,
            recordingId: `community-${recording.id}`,
            isoPleasant: recording.perception.isoPleasant ?? 0,
            isoEventful: recording.perception.isoEventful ?? 0,
            paqPleasant: recording.perception.paqPleasant ?? undefined,
            paqVibrant: recording.perception.paqVibrant ?? undefined,
            paqEventful: recording.perception.paqEventful ?? undefined,
            paqChaotic: recording.perception.paqChaotic ?? undefined,
            paqAnnoying: recording.perception.paqAnnoying ?? undefined,
            paqMonotonous: recording.perception.paqMonotonous ?? undefined,
            paqUneventful: recording.perception.paqUneventful ?? undefined,
            paqCalm: recording.perception.paqCalm ?? undefined,
            createdAt: recording.recordedAt,
          }
        : undefined,
    };
  }, [audioUri, photoUri, recording, spectrogramUri]);

  if (visible && !adaptedRecording && isLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={Colors.primary} />
      </View>
    );
  }

  return (
    <RecordingDetailModal
      recording={adaptedRecording}
      visible={visible}
      onClose={onClose}
      showExportButton={false}
      showSharingSection={false}
      showSyncStatusSection={false}
    />
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background,
  },
});
