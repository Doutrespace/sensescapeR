/**
 * Web replacement for `expo-sharing`.
 *
 * On phones the file is handed to the system share sheet (mail, messenger,
 * AirDrop, "Save to Files"), which is how students pass their data on. Where
 * that is not available, or the browser refuses it, the file is downloaded.
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

function isPhoneOrTablet(): boolean {
  if (typeof navigator === 'undefined') {
    return false;
  }
  const agent = navigator.userAgent ?? '';
  // iPadOS identifies itself as a Mac, but has a touch screen.
  return /Android|iPhone|iPad|iPod/i.test(agent)
    || (/Macintosh/i.test(agent) && (navigator.maxTouchPoints ?? 0) > 1);
}

export async function shareAsync(
  uri: string,
  options: { mimeType?: string; dialogTitle?: string; UTI?: string } = {}
): Promise<void> {
  const entry = getMedia(uri);
  const blob = entry?.blob ?? await (await fetch(uri)).blob();
  const mimeType = (options.mimeType ?? blob.type).split(';')[0];
  const fallbackExtension = EXTENSION_BY_MIME[mimeType] ?? 'bin';
  const filename = entry?.path.split('/').pop() || `sensescape_${Date.now()}.${fallbackExtension}`;

  if (isPhoneOrTablet() && typeof navigator.share === 'function' && typeof File === 'function') {
    try {
      const file = new File([blob], filename, { type: mimeType || 'application/octet-stream' });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: filename });
        return;
      }
    } catch (error) {
      // Closing the share sheet is a decision, not a failure.
      if ((error as { name?: string } | null)?.name === 'AbortError') {
        return;
      }
      // Anything else (e.g. the tap is too long ago): fall back to a download.
    }
  }

  downloadBlob(blob, filename);
}
