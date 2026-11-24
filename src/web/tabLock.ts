/**
 * Makes sure the app runs in one browser tab only.
 *
 * Each tab keeps its own copy of the local database and writes the whole
 * copy back, so two open tabs would overwrite each other's measurements
 * (scanning the QR code again opens a second tab). The first tab holds a
 * Web Lock for as long as it lives; a second tab sees that and stays out.
 */
let result: Promise<'held' | 'blocked'> | null = null;

/** Asked once per page; later calls get the same answer. */
export function acquireTabLock(): Promise<'held' | 'blocked'> {
  if (!result) {
    result = requestTabLock();
  }
  return result;
}

async function requestTabLock(): Promise<'held' | 'blocked'> {
  const locks = typeof navigator !== 'undefined'
    ? (navigator as unknown as { locks?: LockManager }).locks
    : undefined;
  if (!locks?.request) {
    // Old browser without Web Locks: nothing to check.
    return 'held';
  }

  return new Promise((resolve) => {
    locks
      .request('sensescape-explorer-tab', { ifAvailable: true }, (lock) => {
        if (!lock) {
          resolve('blocked');
          return undefined;
        }
        resolve('held');
        // Never settles: the lock is held until the tab is closed.
        return new Promise<void>(() => undefined);
      })
      .catch(() => resolve('held'));
  });
}
