import { File } from 'expo-file-system';
import { supabase, isSupabaseConfigured } from '../../utils/supabase';
import { CommunityVisibility, Recording, Perception } from '../../types/recording';
import { getRecording, updateSyncStatus } from '../database/recordings';
import { getPerceptionByRecordingId, getRatedPaq } from '../database/perceptions';
import { sanitizeFilePath, validateAudioUri, validateCoordinates } from '../../utils/validation';
import { LoggingService } from '../logging';
import { assessVisualContext } from '../../utils/visualContext';
import { extractNoteThemes } from '../../utils/noteAnalysis';
import { parseMultisensory } from '../../types/multisensory';
import {
  getQueueItem,
  updateQueueItem,
  removeFromQueue,
  calculateNextRetry,
} from './uploadQueue';

export interface UploadResult {
  success: boolean;
  remoteId?: string;
  error?: string;
}

export interface UploadProgress {
  recordingId: string;
  stage: 'audio' | 'metadata' | 'perception' | 'complete';
  progress: number; // 0-1
}

type ProgressCallback = (progress: UploadProgress) => void;

function toIntegerOrNull(value?: number | null): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return null;
  }

  return Math.round(value);
}

export async function deleteRemoteRecording(
  recording: Pick<Recording, 'remoteId'>
): Promise<{ success: boolean; error?: string }> {
  if (!recording.remoteId) {
    return { success: true };
  }

  if (!isSupabaseConfigured) {
    return {
      success: false,
      error: 'Supabase is not configured in this build.',
    };
  }

  try {
    const remoteId = recording.remoteId;
    let audioPath: string | null = null;
    let photoPath: string | null = null;
    let spectrogramPath: string | null = null;

    const { data, error: metadataError } = await supabase
      .from('recordings')
      .select('audio_path, photo_path, spectrogram_path')
      .eq('id', remoteId)
      .maybeSingle();

    if (metadataError) {
      return { success: false, error: metadataError.message };
    }

    audioPath = data?.audio_path ?? null;
    photoPath = data?.photo_path ?? null;
    spectrogramPath = data?.spectrogram_path ?? null;

    const { error: perceptionError } = await supabase
      .from('perceptions')
      .delete()
      .eq('recording_id', remoteId);

    if (perceptionError) {
      return { success: false, error: perceptionError.message };
    }

    const storagePaths = [audioPath, photoPath, spectrogramPath].filter(
      (value): value is string => !!value
    );

    if (storagePaths.length > 0) {
      const { error: storageError } = await supabase.storage
        .from('soundscapes')
        .remove(storagePaths);

      if (storageError) {
        return { success: false, error: storageError.message };
      }
    }

    const { error: recordingError } = await supabase
      .from('recordings')
      .delete()
      .eq('id', remoteId);

    if (recordingError) {
      return { success: false, error: recordingError.message };
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Remote delete failed',
    };
  }
}

export async function updateRemoteRecordingVisibility(
  recording: Pick<Recording, 'remoteId'>,
  communityVisibility: CommunityVisibility
): Promise<{ success: boolean; error?: string }> {
  if (!recording.remoteId) {
    return { success: true };
  }

  if (!isSupabaseConfigured) {
    return {
      success: false,
      error: 'Supabase is not configured in this build.',
    };
  }

  try {
    const { error } = await supabase
      .from('recordings')
      .update({ community_visibility: communityVisibility })
      .eq('id', recording.remoteId);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Remote visibility update failed',
    };
  }
}

export async function resyncRemoteRecordingMedia(
  recording: Pick<Recording, 'id' | 'remoteId' | 'photoUri' | 'spectrogramUri'>
): Promise<{ success: boolean; error?: string; updated: string[] }> {
  if (!recording.remoteId) {
    return {
      success: false,
      error: 'This recording has not been uploaded yet.',
      updated: [],
    };
  }

  if (!isSupabaseConfigured) {
    return {
      success: false,
      error: 'Supabase is not configured in this build.',
      updated: [],
    };
  }

  try {
    const mediaPaths = await uploadMediaAssets({
      id: recording.id,
      photoUri: recording.photoUri,
      spectrogramUri: recording.spectrogramUri,
    });

    const updates: Record<string, string> = {};
    const updated: string[] = [];

    if (mediaPaths.photoPath) {
      updates.photo_path = mediaPaths.photoPath;
      updated.push('photo');
    }
    if (mediaPaths.spectrogramPath) {
      updates.spectrogram_path = mediaPaths.spectrogramPath;
      updated.push('spectrogram');
    }

    if (Object.keys(updates).length === 0) {
      return {
        success: false,
        error: 'No local photo or spectrogram is available to resync.',
        updated: [],
      };
    }

    const { error } = await supabase
      .from('recordings')
      .update(updates)
      .eq('id', recording.remoteId);

    if (error) {
      return { success: false, error: error.message, updated: [] };
    }

    return { success: true, updated };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Media resync failed',
      updated: [],
    };
  }
}

// Upload a single recording
export async function uploadRecording(
  recordingId: string,
  onProgress?: ProgressCallback
): Promise<UploadResult> {
  if (!isSupabaseConfigured) {
    return {
      success: false,
      error: 'Supabase not configured',
    };
  }

  try {
    const session = await supabase.auth.getSession();
    const userId = session.data.session?.user?.id;
    if (!userId) {
      return {
        success: false,
        error: 'Cloud sync requires a signed-in user session.',
      };
    }

    // Get recording from local DB
    const recording = await getRecording(recordingId);
    if (!recording) {
      return {
        success: false,
        error: 'Recording not found',
      };
    }

    // Update status to uploading
    await updateSyncStatus(recordingId, 'uploading');

    // Stage 1: Upload audio file
    onProgress?.({
      recordingId,
      stage: 'audio',
      progress: 0,
    });

    const audioResult = await uploadAudioFile(recording);
    if (!audioResult.success) {
      throw new Error(audioResult.error ?? 'Audio upload failed');
    }

    onProgress?.({
      recordingId,
      stage: 'audio',
      progress: 1,
    });

    // Stage 2: Upload metadata
    onProgress?.({
      recordingId,
      stage: 'metadata',
      progress: 0,
    });

    const mediaPaths = await uploadMediaAssets(recording);
    const metadataResult = await uploadMetadata(
      recording,
      audioResult.path!,
      userId,
      mediaPaths
    );
    if (!metadataResult.success) {
      throw new Error(metadataResult.error ?? 'Metadata upload failed');
    }

    onProgress?.({
      recordingId,
      stage: 'metadata',
      progress: 1,
    });

    // Stage 3: Upload perception
    onProgress?.({
      recordingId,
      stage: 'perception',
      progress: 0,
    });

    const perception = await getPerceptionByRecordingId(recordingId);
    if (perception) {
      const perceptionResult = await uploadPerception(
        perception,
        metadataResult.remoteId!
      );
      if (!perceptionResult.success) {
        LoggingService.warn('Perception upload failed after recording metadata upload', {
          recordingId,
          error: perceptionResult.error,
        });
      }
    }

    onProgress?.({
      recordingId,
      stage: 'perception',
      progress: 1,
    });

    // Success!
    await updateSyncStatus(recordingId, 'uploaded', metadataResult.remoteId);
    await removeFromQueue(recordingId);

    onProgress?.({
      recordingId,
      stage: 'complete',
      progress: 1,
    });

    return {
      success: true,
      remoteId: metadataResult.remoteId,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    // Update queue with failure
    const queueItem = await getQueueItem(recordingId);
    if (queueItem) {
      const newAttempts = queueItem.attempts + 1;
      const nextRetry = calculateNextRetry(newAttempts);

      await updateQueueItem(recordingId, newAttempts, nextRetry, errorMessage);
    }

    // Mark as failed if too many attempts
    if (queueItem && queueItem.attempts >= 4) {
      await updateSyncStatus(recordingId, 'failed');
    } else {
      await updateSyncStatus(recordingId, 'queued');
    }

    return {
      success: false,
      error: errorMessage,
    };
  }
}

async function uploadAudioFile(
  recording: Recording
): Promise<{ success: boolean; path?: string; error?: string }> {
  try {
    const audioUri = sanitizeFilePath(recording.audioUri);
    if (!validateAudioUri(audioUri)) {
      return { success: false, error: 'Invalid audio file path' };
    }

    const file = new File(audioUri);
    if (!file.exists) {
      return { success: false, error: 'Audio file not found' };
    }

    const fileName = `recordings/${recording.id}.wav`;
    const bytes = await file.bytes();

    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from('soundscapes')
      .upload(fileName, bytes, {
        contentType: 'audio/wav',
        upsert: true,
      });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, path: data.path };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Audio upload failed',
    };
  }
}

async function uploadMediaAssets(
  recording: Pick<Recording, 'id' | 'photoUri' | 'spectrogramUri'>
): Promise<{
  photoPath: string | null;
  spectrogramPath: string | null;
}> {
  const photoResult = recording.photoUri
    ? await uploadFileToStorage(
        sanitizeFilePath(recording.photoUri),
        `photos/${recording.id}.jpg`,
        getImageContentType(recording.photoUri)
      )
    : { success: true, path: null as string | null };

  if (!photoResult.success) {
    throw new Error(photoResult.error ?? 'Photo upload failed');
  }

  const spectrogramResult = recording.spectrogramUri
    ? await uploadFileToStorage(
        sanitizeFilePath(recording.spectrogramUri),
        `spectrograms/${recording.id}.png`,
        getImageContentType(recording.spectrogramUri)
      )
    : { success: true, path: null as string | null };

  if (!spectrogramResult.success) {
    throw new Error(spectrogramResult.error ?? 'Spectrogram upload failed');
  }

  return {
    photoPath: photoResult.path ?? null,
    spectrogramPath: spectrogramResult.path ?? null,
  };
}

async function uploadFileToStorage(
  uri: string,
  storagePath: string,
  contentType: string
): Promise<{ success: boolean; path?: string | null; error?: string }> {
  try {
    const file = new File(uri);
    if (!file.exists) {
      return { success: false, error: 'Media file not found' };
    }

    const bytes = await file.bytes();
    const { data, error } = await supabase.storage
      .from('soundscapes')
      .upload(storagePath, bytes, {
        // Web media URLs carry no file extension; the stored blob knows its type.
        contentType: (file as { type?: string }).type || contentType,
        upsert: true,
      });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, path: data.path };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Media upload failed',
    };
  }
}

function getImageContentType(uri: string): string {
  const normalized = uri.toLowerCase();
  if (normalized.endsWith('.png')) {
    return 'image/png';
  }
  if (normalized.endsWith('.webp')) {
    return 'image/webp';
  }
  return 'image/jpeg';
}

async function uploadMetadata(
  recording: Recording,
  audioPath: string,
  userId: string,
  mediaPaths: {
    photoPath: string | null;
    spectrogramPath: string | null;
  }
): Promise<{ success: boolean; remoteId?: string; error?: string }> {
  try {
    // Parse JSON fields
    let settingChips = null;
    let sourceDominance = null;
    let photoClassification = null;
    let detectedSounds = null;
    let visualContext = null;
    let noteThemes = null;

    if (recording.settingChips) {
      try {
        settingChips = JSON.parse(recording.settingChips);
      } catch {}
    }

    if (recording.sourceDominance) {
      try {
        sourceDominance = JSON.parse(recording.sourceDominance);
      } catch {}
    }

    if (recording.photoClassification) {
      photoClassification = recording.photoClassification;
      visualContext = assessVisualContext(recording.photoClassification);
    }

    if (recording.detectedSounds) {
      try {
        detectedSounds = JSON.parse(recording.detectedSounds);
      } catch {}
    }

    noteThemes = extractNoteThemes(recording.fieldNotes, recording.spokenDescription);
    const multisensory = parseMultisensory(recording.multisensory);

    // Coordinates are already privacy-adjusted when saved locally.
    let location = null;
    if (
      typeof recording.latitude === 'number'
      && typeof recording.longitude === 'number'
      && validateCoordinates(recording.latitude, recording.longitude)
    ) {
      location = `POINT(${recording.longitude} ${recording.latitude})`;
    }

    const { data, error } = await supabase
      .from('recordings')
      .insert([
        {
          audio_path: audioPath,
          photo_path: mediaPaths.photoPath,
          spectrogram_path: mediaPaths.spectrogramPath,
          sample_rate: toIntegerOrNull(recording.sampleRate),
          bit_depth: toIntegerOrNull(recording.bitDepth),
          duration_ms: toIntegerOrNull(recording.durationMs),
          device_model: recording.deviceModel,
          os_version: recording.osVersion,
          mic_route: recording.micRoute,
          recorded_at: recording.recordedAt,
          timezone: recording.timezone,
          latitude: recording.latitude,
          longitude: recording.longitude,
          location,
          gps_accuracy: recording.gpsAccuracy,
          privacy_mode: recording.privacyMode,
          protocol_type: recording.protocolType,
          project_id: recording.projectId,
          has_clipping: recording.hasClipping,
          has_wind_handling: recording.hasWindHandling,
          has_low_snr: recording.hasLowSNR,
          peak_db: recording.peakDb,
          rms_db: recording.rmsDb,
          normalization_applied: recording.normalizationApplied ?? false,
          normalization_gain: recording.normalizationGain ?? null,
          habitat_type: recording.habitatType,
          setting_chips: settingChips,
          source_dominance: sourceDominance,
          field_notes: recording.fieldNotes ?? null,
          spoken_description: recording.spokenDescription ?? null,
          photo_classification: photoClassification,
          visual_context: visualContext,
          note_themes: noteThemes,
          detected_sounds: detectedSounds,
          license: recording.license,
          community_visibility: recording.communityVisibility,
          local_id: recording.id,
          user_id: userId,
          // Only sent when rated, so recordings without it still upload to a
          // database that has not added the `multisensory` column yet.
          ...(multisensory ? { multisensory } : {}),
        },
      ])
      .select('id')
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, remoteId: data.id };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Metadata upload failed',
    };
  }
}

async function uploadPerception(
  perception: Perception,
  remoteRecordingId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const ratedPaq = getRatedPaq(perception);
    const { error } = await supabase.from('perceptions').insert([
      {
        recording_id: remoteRecordingId,
        iso_pleasant: perception.isoPleasant,
        iso_eventful: perception.isoEventful,
        // Rated PAQ only; never scores derived from the circumplex point.
        paq_pleasant: ratedPaq?.pleasant ?? null,
        paq_vibrant: ratedPaq?.vibrant ?? null,
        paq_eventful: ratedPaq?.eventful ?? null,
        paq_chaotic: ratedPaq?.chaotic ?? null,
        paq_annoying: ratedPaq?.annoying ?? null,
        paq_monotonous: ratedPaq?.monotonous ?? null,
        paq_uneventful: ratedPaq?.uneventful ?? null,
        paq_calm: ratedPaq?.calm ?? null,
      },
    ]);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Perception upload failed',
    };
  }
}
