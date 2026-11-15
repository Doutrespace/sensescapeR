// `blob:` covers the web build, where media lives in the browser instead of on disk.
const FILE_URI_PATTERN = /^((file|content):\/\/|blob:)/i;

export function validateCoordinates(latitude: number, longitude: number): boolean {
  return Number.isFinite(latitude)
    && Number.isFinite(longitude)
    && latitude >= -90
    && latitude <= 90
    && longitude >= -180
    && longitude <= 180;
}

export function validateAudioUri(uri: string): boolean {
  if (typeof uri !== 'string') {
    return false;
  }

  const sanitized = sanitizeFilePath(uri);
  return sanitized.length > 0 && (FILE_URI_PATTERN.test(sanitized) || sanitized.startsWith('/'));
}

export function sanitizeFilePath(path: string): string {
  if (typeof path !== 'string') {
    return '';
  }

  const sanitized = path
    .replace(/\0/g, '')
    .replace(/\\/g, '/')
    .trim();

  if (FILE_URI_PATTERN.test(sanitized)) {
    return sanitized;
  }

  return sanitized.replace(/\/{2,}/g, '/');
}

export function sanitizeOptionalText(value?: string | null): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const sanitized = value.replace(/\0/g, '').trim();
  return sanitized.length > 0 ? sanitized : null;
}
