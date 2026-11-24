import { getDatabase } from '../database';
import { flushMedia } from '../../web/mediaStore';

/**
 * Browser: waits until the recording, the photo and the database image have
 * been committed to IndexedDB, and throws when one of them could not be
 * stored (for example because the browser storage is full).
 */
export async function flushStorage(): Promise<void> {
  await flushMedia();
  const database = await getDatabase();
  const flush = (database as unknown as { flushAsync?: () => Promise<void> }).flushAsync;
  if (flush) {
    await flush.call(database);
  }
}
