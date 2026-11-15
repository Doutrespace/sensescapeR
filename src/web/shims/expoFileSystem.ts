/**
 * Web replacement for the parts of `expo-file-system` this app uses
 * (File / Directory / Paths). Files live in the browser media store
 * (IndexedDB + blob URLs) instead of on disk.
 */
import { getMedia, putMedia, removeMedia, resolveMediaPath } from '../mediaStore';

const MIME_BY_EXTENSION: Record<string, string> = {
  wav: 'audio/wav',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  json: 'application/json',
  geojson: 'application/geo+json',
  csv: 'text/csv;charset=utf-8',
  txt: 'text/plain;charset=utf-8',
};

function joinPath(parts: Array<string | Directory | File>): string {
  return parts
    .map((part) => (typeof part === 'string' ? part : part.path))
    .join('/')
    .replace(/\/{2,}/g, '/');
}

function isExternalUri(value: string): boolean {
  return /^(blob:|data:|https?:)/i.test(value);
}

export class Directory {
  readonly path: string;

  constructor(...parts: Array<string | Directory>) {
    this.path = joinPath(parts);
  }

  get uri(): string {
    return this.path;
  }

  get exists(): boolean {
    return true;
  }

  create(): void {}

  delete(): void {}
}

export class File {
  path: string;
  /** Set when the file wraps a URL that is not (yet) in the media store. */
  private externalUri: string | null = null;

  constructor(...parts: Array<string | Directory | File>) {
    const first = parts[0];
    if (parts.length === 1 && typeof first === 'string') {
      const knownPath = resolveMediaPath(first);
      if (knownPath) {
        this.path = knownPath;
      } else if (isExternalUri(first)) {
        this.path = first;
        this.externalUri = first;
      } else {
        this.path = first;
      }
    } else {
      this.path = joinPath(parts);
    }
  }

  get uri(): string {
    return getMedia(this.path)?.url ?? this.externalUri ?? this.path;
  }

  get name(): string {
    return this.path.split('/').pop() ?? '';
  }

  get extension(): string {
    const match = /\.([a-z0-9]+)$/i.exec(this.name);
    return match ? `.${match[1]}` : '';
  }

  get exists(): boolean {
    return !!getMedia(this.path) || !!this.externalUri;
  }

  get size(): number {
    return getMedia(this.path)?.blob.size ?? 0;
  }

  get type(): string {
    return getMedia(this.path)?.blob.type ?? '';
  }

  info(): { exists: boolean; size: number; uri: string } {
    return { exists: this.exists, size: this.size, uri: this.uri };
  }

  create(): void {}

  write(content: string | Uint8Array | ArrayBuffer): void {
    const extension = this.extension.slice(1).toLowerCase();
    const blob = new Blob([content as BlobPart], {
      type: MIME_BY_EXTENSION[extension] ?? 'application/octet-stream',
    });
    // Cache files (exports) are short-lived and never written to IndexedDB.
    putMedia(this.path, blob, !this.path.startsWith(Paths.cache));
  }

  private async readBlob(): Promise<Blob> {
    const entry = getMedia(this.path);
    if (entry) {
      return entry.blob;
    }
    if (this.externalUri) {
      const response = await fetch(this.externalUri);
      return response.blob();
    }
    throw new Error(`File not found: ${this.path}`);
  }

  async bytes(): Promise<Uint8Array> {
    return new Uint8Array(await (await this.readBlob()).arrayBuffer());
  }

  async text(): Promise<string> {
    return (await this.readBlob()).text();
  }

  delete(): void {
    removeMedia(this.path);
    this.externalUri = null;
  }

  async copy(destination: File | Directory): Promise<void> {
    const targetPath = destination instanceof Directory
      ? joinPath([destination, this.name])
      : destination.path;
    const blob = await this.readBlob();
    const extension = (/\.([a-z0-9]+)$/i.exec(targetPath)?.[1] ?? '').toLowerCase();
    const typed = blob.type
      ? blob
      : new Blob([blob], { type: MIME_BY_EXTENSION[extension] ?? 'application/octet-stream' });
    putMedia(targetPath, typed, !targetPath.startsWith(Paths.cache));
  }

  async move(destination: File | Directory): Promise<void> {
    await this.copy(destination);
    const targetPath = destination instanceof Directory
      ? joinPath([destination, this.name])
      : destination.path;
    if (targetPath !== this.path) {
      removeMedia(this.path);
    }
    this.externalUri = null;
    this.path = targetPath;
  }
}

export const Paths = {
  document: '/document',
  cache: '/cache',
  join: (...parts: string[]) => parts.join('/').replace(/\/{2,}/g, '/'),
};
