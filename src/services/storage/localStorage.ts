import { File } from 'expo-file-system';
import { clearAllData } from '../database';
import { deleteRecording, getRecordings } from '../database/recordings';
import type { Recording } from '../../types/recording';
import { LoggingService } from '../logging';

export interface LocalStorageUsage {
  recordingCount: number;
  fileCount: number;
  audioBytes: number;
  photoBytes: number;
  spectrogramBytes: number;
  totalBytes: number;
}

export interface ClearLocalDataResult {
  deletedRecordings: number;
  deletedFiles: number;
  freedBytes: number;
}

export interface RetentionCleanupOptions {
  retentionDays: number;
  uploadedOnly?: boolean;
}

function getFileSize(uri?: string): number {
  if (!uri) {
    return 0;
  }

  try {
    const file = new File(uri);
    return file.exists ? file.info().size ?? 0 : 0;
  } catch {
    return 0;
  }
}

function deleteFile(uri?: string): boolean {
  if (!uri) {
    return false;
  }

  try {
    const file = new File(uri);
    if (!file.exists) {
      return false;
    }

    file.delete();
    return true;
  } catch {
    return false;
  }
}

export async function getLocalStorageUsage(): Promise<LocalStorageUsage> {
  const recordings = await getRecordings();
  const seen = new Set<string>();

  let audioBytes = 0;
  let photoBytes = 0;
  let spectrogramBytes = 0;
  let fileCount = 0;

  for (const recording of recordings) {
    const mediaEntries = [
      { uri: recording.audioUri, kind: 'audio' as const },
      { uri: recording.photoUri, kind: 'photo' as const },
      { uri: recording.spectrogramUri, kind: 'spectrogram' as const },
    ];

    for (const entry of mediaEntries) {
      if (!entry.uri || seen.has(entry.uri)) {
        continue;
      }

      seen.add(entry.uri);
      const size = getFileSize(entry.uri);
      if (size <= 0) {
        continue;
      }

      fileCount += 1;
      if (entry.kind === 'audio') {
        audioBytes += size;
      } else if (entry.kind === 'photo') {
        photoBytes += size;
      } else {
        spectrogramBytes += size;
      }
    }
  }

  return {
    recordingCount: recordings.length,
    fileCount,
    audioBytes,
    photoBytes,
    spectrogramBytes,
    totalBytes: audioBytes + photoBytes + spectrogramBytes,
  };
}

export async function clearLocalRecordingData(): Promise<ClearLocalDataResult> {
  const recordings = await getRecordings();
  const seen = new Set<string>();

  let deletedFiles = 0;
  let freedBytes = 0;

  for (const recording of recordings) {
    for (const uri of [recording.audioUri, recording.photoUri, recording.spectrogramUri]) {
      if (!uri || seen.has(uri)) {
        continue;
      }

      seen.add(uri);
      freedBytes += getFileSize(uri);
      if (deleteFile(uri)) {
        deletedFiles += 1;
      }
    }
  }

  await clearAllData();

  return {
    deletedRecordings: recordings.length,
    deletedFiles,
    freedBytes,
  };
}

function shouldDeleteByRetention(
  recording: Recording,
  cutoffMs: number,
  uploadedOnly: boolean
): boolean {
  const recordedAtMs = Date.parse(recording.recordedAt);
  if (!Number.isFinite(recordedAtMs) || recordedAtMs > cutoffMs) {
    return false;
  }

  if (uploadedOnly && recording.syncStatus !== 'uploaded') {
    return false;
  }

  return true;
}

export async function cleanupExpiredLocalRecordingData(
  options: RetentionCleanupOptions
): Promise<ClearLocalDataResult> {
  const { retentionDays, uploadedOnly = true } = options;
  if (!Number.isFinite(retentionDays) || retentionDays <= 0) {
    return {
      deletedRecordings: 0,
      deletedFiles: 0,
      freedBytes: 0,
    };
  }

  const recordings = await getRecordings();
  const cutoffMs = Date.now() - (retentionDays * 24 * 60 * 60 * 1000);
  const cleanupTargets = recordings.filter((recording) => (
    shouldDeleteByRetention(recording, cutoffMs, uploadedOnly)
  ));

  if (cleanupTargets.length === 0) {
    return {
      deletedRecordings: 0,
      deletedFiles: 0,
      freedBytes: 0,
    };
  }

  const seen = new Set<string>();
  let deletedFiles = 0;
  let freedBytes = 0;

  for (const recording of cleanupTargets) {
    for (const uri of [recording.audioUri, recording.photoUri, recording.spectrogramUri]) {
      if (!uri || seen.has(uri)) {
        continue;
      }

      seen.add(uri);
      freedBytes += getFileSize(uri);
      if (deleteFile(uri)) {
        deletedFiles += 1;
      }
    }

    await deleteRecording(recording.id);
  }

  LoggingService.info('Completed local retention cleanup', {
    deletedRecordings: cleanupTargets.length,
    deletedFiles,
    freedBytes,
    retentionDays,
    uploadedOnly,
  });

  return {
    deletedRecordings: cleanupTargets.length,
    deletedFiles,
    freedBytes,
  };
}

export function formatStorageSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return '0 B';
  }

  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  const digits = value >= 100 || unitIndex === 0 ? 0 : value >= 10 ? 1 : 2;
  return `${value.toFixed(digits)} ${units[unitIndex]}`;
}
