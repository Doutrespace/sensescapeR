/**
 * Makes sure a measurement that was just saved is really on disk.
 *
 * Native: SQLite and the file system write synchronously, nothing to do.
 * The browser version waits for IndexedDB (see flushStorage.web.ts).
 */
export async function flushStorage(): Promise<void> {
  // Nothing to wait for.
}
