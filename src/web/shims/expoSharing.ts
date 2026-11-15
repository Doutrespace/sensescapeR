/**
 * Web replacement for `expo-sharing`: "sharing" a file downloads it.
 */
import { downloadBlob, getMedia } from '../mediaStore';

const EXTENSION_BY_MIME: Record<string, string> = {
  'audio/wav': 'wav',
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'application/json': 'json',
  'application/geo+json': 'geojson',
  'text/csv': 'csv',
  'text/plain': 'txt',
};

export async function isAvailableAsync(): Promise<boolean> {
  return true;
}

export async function shareAsync(
  uri: string,
  options: { mimeType?: string; dialogTitle?: string; UTI?: string } = {}
): Promise<void> {
  const entry = getMedia(uri);
  const blob = entry?.blob ?? await (await fetch(uri)).blob();
  const fallbackExtension = EXTENSION_BY_MIME[(options.mimeType ?? blob.type).split(';')[0]] ?? 'bin';
  const filename = entry?.path.split('/').pop() || `soundscape_${Date.now()}.${fallbackExtension}`;
  downloadBlob(blob, filename);
}
