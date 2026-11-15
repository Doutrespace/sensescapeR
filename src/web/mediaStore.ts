/**
 * Browser-only media store.
 *
 * The native app keeps audio, photos and spectrograms as files on disk. The
 * browser has no such filesystem, so the web build keeps them as Blobs in
 * IndexedDB and hands out `blob:` URLs for playback and display.
 *
 * `blob:` URLs only live for the current page load, so the local database
 * stores a stable `idb:<path>` reference instead (see toStoredUri /
 * toRuntimeUri), which is mapped back to a fresh `blob:` URL after a reload.
 */

const DB_NAME = 'soundscape-web';
const FILE_STORE = 'files';
const KV_STORE = 'kv';
const STORED_PREFIX = 'idb:';

interface MediaEntry {
  blob: Blob;
  url: string;
}

const entriesByPath = new Map<string, MediaEntry>();
const pathByUrl = new Map<string, string>();

let dbPromise: Promise<IDBDatabase> | null = null;
let readyPromise: Promise<void> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(FILE_STORE)) {
          db.createObjectStore(FILE_STORE);
        }
        if (!db.objectStoreNames.contains(KV_STORE)) {
          db.createObjectStore(KV_STORE);
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error('IndexedDB unavailable'));
    });
  }
  return dbPromise;
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function register(path: string, blob: Blob): string {
  const previous = entriesByPath.get(path);
  if (previous) {
    pathByUrl.delete(previous.url);
    revokeLater(previous.url);
  }

  const url = URL.createObjectURL(blob);
  entriesByPath.set(path, { blob, url });
  pathByUrl.set(url, path);
  return url;
}

function revokeLater(url: string): void {
  // A download or playback may still be reading the URL; give it time.
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/** Loads every persisted media file so lookups can stay synchronous. */
export function mediaStoreReady(): Promise<void> {
  if (!readyPromise) {
    readyPromise = (async () => {
      try {
        const db = await openDb();
        const store = db.transaction(FILE_STORE, 'readonly').objectStore(FILE_STORE);
        const [keys, values] = await Promise.all([
          requestToPromise(store.getAllKeys()),
          requestToPromise(store.getAll()),
        ]);
        keys.forEach((key, index) => {
          const blob = values[index];
          if (typeof key === 'string' && blob instanceof Blob && !entriesByPath.has(key)) {
            register(key, blob);
          }
        });
      } catch (error) {
        console.warn('[mediaStore] Could not load persisted media', error);
      }
    })();
  }
  return readyPromise;
}

/** Stores a blob under a virtual path and returns its `blob:` URL. */
export function putMedia(path: string, blob: Blob, persist = true): string {
  const url = register(path, blob);

  if (persist) {
    void openDb()
      .then((db) => requestToPromise(
        db.transaction(FILE_STORE, 'readwrite').objectStore(FILE_STORE).put(blob, path)
      ))
      .catch((error) => console.warn('[mediaStore] Could not persist media', path, error));
  }

  return url;
}

export function removeMedia(path: string): boolean {
  const entry = entriesByPath.get(path);
  if (!entry) {
    return false;
  }

  entriesByPath.delete(path);
  pathByUrl.delete(entry.url);
  revokeLater(entry.url);

  void openDb()
    .then((db) => requestToPromise(
      db.transaction(FILE_STORE, 'readwrite').objectStore(FILE_STORE).delete(path)
    ))
    .catch(() => undefined);

  return true;
}

/** Resolves a `blob:` URL, an `idb:` reference or a virtual path to its path. */
export function resolveMediaPath(uriOrPath: string): string | null {
  if (!uriOrPath) {
    return null;
  }
  if (pathByUrl.has(uriOrPath)) {
    return pathByUrl.get(uriOrPath)!;
  }
  if (uriOrPath.startsWith(STORED_PREFIX)) {
    return uriOrPath.slice(STORED_PREFIX.length);
  }
  if (entriesByPath.has(uriOrPath)) {
    return uriOrPath;
  }
  return null;
}

export function getMedia(uriOrPath: string): { path: string; blob: Blob; url: string } | null {
  const path = resolveMediaPath(uriOrPath);
  const entry = path ? entriesByPath.get(path) : undefined;
  return path && entry ? { path, ...entry } : null;
}

/** `blob:` URL -> stable reference that survives a page reload. */
export function toStoredUri(uri: string): string {
  const path = pathByUrl.get(uri);
  return path ? `${STORED_PREFIX}${path}` : uri;
}

/** Stable reference -> `blob:` URL usable by <audio>, <img> and fetch. */
export function toRuntimeUri(stored: string): string {
  if (!stored.startsWith(STORED_PREFIX)) {
    return stored;
  }
  return entriesByPath.get(stored.slice(STORED_PREFIX.length))?.url ?? stored;
}

// --- small key/value area in the same database (used for the SQLite image) ---

export async function kvGet<T>(key: string): Promise<T | undefined> {
  const db = await openDb();
  return requestToPromise<T | undefined>(
    db.transaction(KV_STORE, 'readonly').objectStore(KV_STORE).get(key)
  );
}

export async function kvSet(key: string, value: unknown): Promise<void> {
  const db = await openDb();
  await requestToPromise(
    db.transaction(KV_STORE, 'readwrite').objectStore(KV_STORE).put(value, key)
  );
}

/** Triggers a normal browser download for a blob. */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = 'noopener';
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  revokeLater(url);
}

/** Static files copied to the site root by scripts/prepare-web.js. */
export function publicAssetUrl(relativePath: string): string {
  const base = (process.env.EXPO_BASE_URL ?? '').replace(/\/+$/, '');
  return `${base}/${relativePath.replace(/^\/+/, '')}`;
}
