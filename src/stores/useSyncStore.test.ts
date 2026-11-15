import type { UploadQueueItem } from '../types/recording';
import { useSyncStore } from './useSyncStore';

function makeQueueItem(overrides: Partial<UploadQueueItem> = {}): UploadQueueItem {
  return {
    id: 'queue-1',
    recordingId: 'recording-1',
    attempts: 0,
    nextRetryAt: '2026-03-07T12:00:00.000Z',
    lastError: undefined,
    ...overrides,
  };
}

describe('useSyncStore', () => {
  beforeEach(() => {
    useSyncStore.setState({
      isOnline: true,
      isWifi: false,
      queue: [],
      isUploading: false,
      currentUploadId: null,
      uploadProgress: 0,
      totalUploaded: 0,
      totalFailed: 0,
      lastSyncActivity: null,
      syncHistory: [],
    });
  });

  it('deduplicates queued items by recording id', () => {
    useSyncStore.getState().addToQueue(makeQueueItem({
      id: 'queue-1',
      recordingId: 'recording-1',
      attempts: 1,
    }));
    useSyncStore.getState().addToQueue(makeQueueItem({
      id: 'queue-2',
      recordingId: 'recording-1',
      attempts: 2,
      lastError: 'Retry later',
    }));

    expect(useSyncStore.getState().queue).toEqual([
      expect.objectContaining({
        id: 'queue-2',
        recordingId: 'recording-1',
        attempts: 2,
        lastError: 'Retry later',
      }),
    ]);
  });

  it('updates queue items in place', () => {
    useSyncStore.getState().setQueue([
      makeQueueItem({
        id: 'queue-1',
        recordingId: 'recording-1',
        attempts: 1,
      }),
      makeQueueItem({
        id: 'queue-2',
        recordingId: 'recording-2',
      }),
    ]);

    useSyncStore.getState().updateQueueItem('recording-1', {
      attempts: 3,
      lastError: 'Upload failed',
    });

    expect(useSyncStore.getState().queue[0]).toEqual(
      expect.objectContaining({
        recordingId: 'recording-1',
        attempts: 3,
        lastError: 'Upload failed',
      })
    );
    expect(useSyncStore.getState().queue[1]).toEqual(
      expect.objectContaining({
        recordingId: 'recording-2',
      })
    );
  });

  it('records sync activity history in reverse chronological order', () => {
    useSyncStore.getState().setLastSyncActivity('Manual sync started.', 'info');
    useSyncStore.getState().setLastSyncActivity('A recording was uploaded successfully.', 'success');

    expect(useSyncStore.getState().lastSyncActivity).toEqual(
      expect.objectContaining({
        message: 'A recording was uploaded successfully.',
        status: 'success',
      })
    );
    expect(useSyncStore.getState().syncHistory).toHaveLength(2);
    expect(useSyncStore.getState().syncHistory[0]).toEqual(
      expect.objectContaining({
        message: 'A recording was uploaded successfully.',
        status: 'success',
      })
    );
    expect(useSyncStore.getState().syncHistory[1]).toEqual(
      expect.objectContaining({
        message: 'Manual sync started.',
        status: 'info',
      })
    );
  });
});
