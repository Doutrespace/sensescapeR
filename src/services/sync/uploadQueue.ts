import { getDatabase } from '../database';
import { UploadQueueItem } from '../../types/recording';
import { updateSyncStatus } from '../database/recordings';

function generateId(): string {
  return `queue_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Add a recording to the upload queue
export async function addToQueue(recordingId: string): Promise<UploadQueueItem> {
  const db = await getDatabase();
  const now = new Date().toISOString();
  const id = generateId();

  const item: UploadQueueItem = {
    id,
    recordingId,
    attempts: 0,
    nextRetryAt: now,
  };

  await db.runAsync(
    `INSERT OR REPLACE INTO upload_queue (id, recording_id, attempts, next_retry_at)
     VALUES (?, ?, ?, ?)`,
    [item.id, item.recordingId, item.attempts, item.nextRetryAt]
  );

  // Update recording status
  await updateSyncStatus(recordingId, 'queued');

  return item;
}

// Get all items in the queue
export async function getQueueItems(): Promise<UploadQueueItem[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<any>(
    'SELECT * FROM upload_queue ORDER BY next_retry_at ASC'
  );

  return rows.map(mapRowToQueueItem);
}

// Get items ready for upload (nextRetryAt <= now)
export async function getReadyItems(): Promise<UploadQueueItem[]> {
  const db = await getDatabase();
  const now = new Date().toISOString();

  const rows = await db.getAllAsync<any>(
    'SELECT * FROM upload_queue WHERE next_retry_at <= ? ORDER BY next_retry_at ASC',
    [now]
  );

  return rows.map(mapRowToQueueItem);
}

// Get a specific queue item by recording ID
export async function getQueueItem(recordingId: string): Promise<UploadQueueItem | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<any>(
    'SELECT * FROM upload_queue WHERE recording_id = ?',
    [recordingId]
  );

  return row ? mapRowToQueueItem(row) : null;
}

export async function getLatestFailedQueueItem(): Promise<UploadQueueItem | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<any>(
    `SELECT *
     FROM upload_queue
     WHERE last_error IS NOT NULL AND TRIM(last_error) != ''
     ORDER BY attempts DESC, next_retry_at DESC
     LIMIT 1`
  );

  return row ? mapRowToQueueItem(row) : null;
}

// Update queue item after attempt
export async function updateQueueItem(
  recordingId: string,
  attempts: number,
  nextRetryAt: string,
  lastError?: string
): Promise<void> {
  const db = await getDatabase();

  await db.runAsync(
    `UPDATE upload_queue
     SET attempts = ?, next_retry_at = ?, last_error = ?
     WHERE recording_id = ?`,
    [attempts, nextRetryAt, lastError ?? null, recordingId]
  );
}

export async function resetQueueRetryTimes(recordingIds?: string[]): Promise<void> {
  const db = await getDatabase();
  const now = new Date().toISOString();

  if (!recordingIds || recordingIds.length === 0) {
    await db.runAsync(
      `UPDATE upload_queue
       SET next_retry_at = ?
       WHERE next_retry_at > ?`,
      [now, now]
    );
    return;
  }

  const placeholders = recordingIds.map(() => '?').join(',');
  await db.runAsync(
    `UPDATE upload_queue
     SET next_retry_at = ?
     WHERE recording_id IN (${placeholders})`,
    [now, ...recordingIds]
  );
}

// Remove item from queue (after successful upload)
export async function removeFromQueue(recordingId: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM upload_queue WHERE recording_id = ?', [recordingId]);
}

// Calculate next retry time with exponential backoff
export function calculateNextRetry(attempts: number): string {
  // Exponential backoff: 1min, 2min, 4min, 8min, 16min, max 30min
  const baseDelay = 60 * 1000; // 1 minute
  const maxDelay = 30 * 60 * 1000; // 30 minutes
  const delay = Math.min(baseDelay * Math.pow(2, attempts), maxDelay);

  return new Date(Date.now() + delay).toISOString();
}

// Get queue statistics
export async function getQueueStats(): Promise<{
  total: number;
  pending: number;
  failed: number;
}> {
  const db = await getDatabase();

  const total = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM upload_queue'
  );

  const now = new Date().toISOString();
  const pending = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM upload_queue WHERE next_retry_at <= ?',
    [now]
  );

  const failed = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM upload_queue WHERE attempts >= 5'
  );

  return {
    total: total?.count ?? 0,
    pending: pending?.count ?? 0,
    failed: failed?.count ?? 0,
  };
}

// Clear all items from the queue
export async function clearQueue(): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM upload_queue');
}

function mapRowToQueueItem(row: any): UploadQueueItem {
  return {
    id: row.id,
    recordingId: row.recording_id,
    attempts: row.attempts,
    nextRetryAt: row.next_retry_at,
    lastError: row.last_error,
  };
}
