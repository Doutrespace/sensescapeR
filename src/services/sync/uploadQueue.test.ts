const mockGetAllAsync = jest.fn();
const mockGetFirstAsync = jest.fn();
const mockRunAsync = jest.fn();
const mockUpdateSyncStatus = jest.fn();

jest.mock('../database', () => ({
  getDatabase: jest.fn(async () => ({
    getAllAsync: mockGetAllAsync,
    getFirstAsync: mockGetFirstAsync,
    runAsync: mockRunAsync,
  })),
}));

jest.mock('../database/recordings', () => ({
  updateSyncStatus: jest.fn(async (...args: unknown[]) => mockUpdateSyncStatus(...args)),
}));

import {
  addToQueue,
  calculateNextRetry,
  getLatestFailedQueueItem,
  getQueueStats,
} from './uploadQueue';

describe('uploadQueue service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('queues a recording and marks it as queued in recordings', async () => {
    const item = await addToQueue('recording-1');

    expect(mockRunAsync).toHaveBeenCalledWith(
      expect.stringContaining('INSERT OR REPLACE INTO upload_queue'),
      expect.arrayContaining([item.id, 'recording-1', 0])
    );
    expect(mockUpdateSyncStatus).toHaveBeenCalledWith('recording-1', 'queued');
    expect(item.recordingId).toBe('recording-1');
  });

  it('returns the most relevant failed queue item', async () => {
    mockGetFirstAsync.mockResolvedValueOnce({
      id: 'queue-2',
      recording_id: 'recording-2',
      attempts: 3,
      next_retry_at: '2026-03-07T12:00:00.000Z',
      last_error: 'Upload failed',
    });

    const item = await getLatestFailedQueueItem();

    expect(mockGetFirstAsync).toHaveBeenCalledWith(
      expect.stringContaining('WHERE last_error IS NOT NULL'),
    );
    expect(item).toEqual({
      id: 'queue-2',
      recordingId: 'recording-2',
      attempts: 3,
      nextRetryAt: '2026-03-07T12:00:00.000Z',
      lastError: 'Upload failed',
    });
  });

  it('caps retry backoff at 30 minutes', () => {
    const now = new Date('2026-03-07T12:00:00.000Z');
    jest.useFakeTimers();
    jest.setSystemTime(now);

    expect(calculateNextRetry(0)).toBe('2026-03-07T12:01:00.000Z');
    expect(calculateNextRetry(1)).toBe('2026-03-07T12:02:00.000Z');
    expect(calculateNextRetry(10)).toBe('2026-03-07T12:30:00.000Z');

    jest.useRealTimers();
  });

  it('aggregates queue statistics from the database', async () => {
    mockGetFirstAsync
      .mockResolvedValueOnce({ count: 6 })
      .mockResolvedValueOnce({ count: 4 })
      .mockResolvedValueOnce({ count: 2 });

    const stats = await getQueueStats();

    expect(stats).toEqual({
      total: 6,
      pending: 4,
      failed: 2,
    });
    expect(mockGetFirstAsync).toHaveBeenCalledTimes(3);
  });
});
