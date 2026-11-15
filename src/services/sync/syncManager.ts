import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import { Platform } from 'react-native';
import { useSyncStore } from '../../stores/useSyncStore';
import { useLibraryStore } from '../../stores/useLibraryStore';
import { usePreferencesStore } from '../../stores/usePreferencesStore';
import { isSupabaseConfigured } from '../../utils/supabase';
import { LoggingService } from '../logging';
import {
  getReadyItems,
  addToQueue,
  getQueueItems,
  getQueueItem,
  resetQueueRetryTimes,
} from './uploadQueue';
import { uploadRecording, UploadProgress } from './uploader';
import { getRecordingsBySyncStatus } from '../database/recordings';
import { t } from '../../i18n';

let isProcessing = false;
let unsubscribeNetInfo: (() => void) | null = null;

// Initialize the sync manager
export function initSyncManager(): void {
  // Subscribe to network state changes
  unsubscribeNetInfo = NetInfo.addEventListener(handleNetworkChange);

  // Initial network check
  NetInfo.fetch().then(handleNetworkChange);
  getQueueItems()
    .then((items) => {
      useSyncStore.getState().setQueue(items);
    })
    .catch((error) => {
      LoggingService.warn('Failed to hydrate sync queue from local database', {
        error: error instanceof Error ? error.message : String(error),
      });
    });

  // Start processing queue
  processQueue();
}

// Cleanup
export function cleanupSyncManager(): void {
  if (unsubscribeNetInfo) {
    unsubscribeNetInfo();
    unsubscribeNetInfo = null;
  }
}

// Handle network state changes
function handleNetworkChange(state: NetInfoState): void {
  const store = useSyncStore.getState();
  const wasOnline = store.isOnline;

  store.setNetworkState(
    state.isConnected ?? false,
    // Browsers do not reliably report the connection type, so the Wi-Fi-only
    // preference cannot be enforced on web; treat any connection as usable.
    state.type === 'wifi' || Platform.OS === 'web'
  );

  if (wasOnline !== (state.isConnected ?? false)) {
    store.setLastSyncActivity(
      state.isConnected ? t('Network restored. Queued recordings can sync again.') : t('Offline. New recordings stay local until the network returns.'),
      state.isConnected ? 'info' : 'warning'
    );
  }

  // Try processing queue when we come online
  if (state.isConnected) {
    processQueue();
  }
}

// Queue a recording for upload
export async function queueForUpload(recordingId: string): Promise<void> {
  if (!isSupabaseConfigured) {
    LoggingService.debug('Skipping upload queue because Supabase is not configured', {
      recordingId,
    });
    useSyncStore
      .getState()
      .setLastSyncActivity(t('Cloud sync is not configured in this build.'), 'warning');
    return;
  }

  try {
    const item = await addToQueue(recordingId);
    useSyncStore.getState().addToQueue(item);
    useLibraryStore.getState().updateRecordingSyncStatus(recordingId, 'queued');

    // Trigger processing
    processQueue();
  } catch (error) {
    useSyncStore
      .getState()
      .setLastSyncActivity(t('The recording could not be added to the sync queue.'), 'error');
    LoggingService.error('Failed to queue recording for upload', {
      recordingId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

// Queue all local recordings
export async function queueAllLocal(): Promise<number> {
  const localRecordings = await getRecordingsBySyncStatus('local');
  let queued = 0;

  for (const recording of localRecordings) {
    await queueForUpload(recording.id);
    queued++;
  }

  return queued;
}

// Process the upload queue
export async function processQueue(options?: { ignoreWifiPreference?: boolean }): Promise<void> {
  if (isProcessing) {
    LoggingService.debug('Sync queue already processing');
    return;
  }

  const syncStore = useSyncStore.getState();
  const preferencesStore = usePreferencesStore.getState();

  if (!isSupabaseConfigured) {
    LoggingService.debug('Sync queue processing skipped because Supabase is not configured');
    syncStore.setLastSyncActivity(t('Cloud sync is not configured in this build.'), 'warning');
    return;
  }

  if (!syncStore.isOnline) {
    LoggingService.debug('Sync queue processing skipped because device is offline');
    syncStore.setLastSyncActivity(t('Offline. Waiting for a network connection before syncing.'), 'warning');
    return;
  }

  if (!options?.ignoreWifiPreference && preferencesStore.autoUploadWifiOnly && !syncStore.isWifi) {
    LoggingService.debug('Sync queue processing skipped because Wi-Fi-only upload is enabled');
    syncStore.setLastSyncActivity(t('Auto-upload is limited to Wi-Fi. Connect to Wi-Fi or start a manual sync later.'), 'info');
    return;
  }

  isProcessing = true;

  try {
    // Get items ready for upload
    const readyItems = await getReadyItems();

    if (readyItems.length === 0) {
      LoggingService.debug('No queued items ready for upload');
      syncStore.setLastSyncActivity(t('All queued recordings are up to date.'), 'success');
      return;
    }

    LoggingService.info('Processing sync queue', { count: readyItems.length });

    for (const item of readyItems) {
      // Check if still online
      const currentState = await NetInfo.fetch();
      if (!currentState.isConnected) {
        LoggingService.warn('Stopping sync queue because network connection was lost');
        break;
      }

      // Update store state
      syncStore.setUploading(true, item.recordingId);

      // Upload with progress tracking
      const result = await uploadRecording(item.recordingId, (progress) => {
        handleUploadProgress(progress);
      });

      if (result.success) {
        syncStore.incrementUploaded();
        syncStore.removeFromQueue(item.recordingId);
        syncStore.setLastSyncActivity(t('A recording was uploaded successfully.'), 'success');

        // Update library store
        useLibraryStore
          .getState()
          .updateRecordingSyncStatus(item.recordingId, 'uploaded', result.remoteId);
      } else {
        const updatedQueueItem = await getQueueItem(item.recordingId);
        if (updatedQueueItem) {
          syncStore.updateQueueItem(item.recordingId, {
            attempts: updatedQueueItem.attempts,
            nextRetryAt: updatedQueueItem.nextRetryAt,
            lastError: updatedQueueItem.lastError,
          });
        }
        LoggingService.warn('Queued upload failed', {
          recordingId: item.recordingId,
          error: result.error,
        });
        syncStore.setLastSyncActivity(
          t(result.error ?? 'A queued upload failed. Review the queue details and retry.'),
          'error'
        );
        syncStore.incrementFailed();
      }
    }
  } catch (error) {
    useSyncStore
      .getState()
      .setLastSyncActivity(t('Sync processing failed before the queue finished.'), 'error');
    LoggingService.error('Sync queue processing failed', {
      error: error instanceof Error ? error.message : String(error),
    });
  } finally {
    isProcessing = false;
    useSyncStore.getState().setUploading(false);
  }
}

// Handle upload progress
function handleUploadProgress(progress: UploadProgress): void {
  const stageWeights = {
    audio: 0.6,
    metadata: 0.2,
    perception: 0.1,
    complete: 0.1,
  };

  const stageOffsets = {
    audio: 0,
    metadata: 0.6,
    perception: 0.8,
    complete: 0.9,
  };

  const totalProgress =
    stageOffsets[progress.stage] +
    progress.progress * stageWeights[progress.stage];

  useSyncStore.getState().setUploadProgress(totalProgress);
}

// Get sync status summary
export async function getSyncStatus(): Promise<{
  isOnline: boolean;
  isProcessing: boolean;
  queueLength: number;
  pendingCount: number;
}> {
  const syncStore = useSyncStore.getState();
  const queueItems = await getQueueItems();
  const readyItems = await getReadyItems();

  return {
    isOnline: syncStore.isOnline,
    isProcessing,
    queueLength: queueItems.length,
    pendingCount: readyItems.length,
  };
}

// Retry all failed uploads
export async function retryFailed(): Promise<number> {
  const failedRecordings = await getRecordingsBySyncStatus('failed');
  let retried = 0;

  for (const recording of failedRecordings) {
    await queueForUpload(recording.id);
    retried++;
  }

  // Start processing
  processQueue();

  return retried;
}

// Force sync now (user-initiated)
export async function forceSyncNow(): Promise<void> {
  LoggingService.info('Manual sync requested');
  useSyncStore.getState().setLastSyncActivity(t('Manual sync started.'), 'info');

  // Queue any local recordings
  await queueAllLocal();
  await resetQueueRetryTimes();

  // Process queue
  await processQueue({ ignoreWifiPreference: true });
}
