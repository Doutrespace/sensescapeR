import {
  sanitizeFilePath,
  sanitizeOptionalText,
  validateAudioUri,
  validateCoordinates,
} from './validation';

describe('validation utilities', () => {
  it('validates realistic coordinates', () => {
    expect(validateCoordinates(49.7913, 9.9534)).toBe(true);
    expect(validateCoordinates(-91, 9)).toBe(false);
    expect(validateCoordinates(49, 181)).toBe(false);
  });

  it('validates supported audio uri schemes', () => {
    expect(validateAudioUri('file:///data/user/0/app/audio.wav')).toBe(true);
    expect(validateAudioUri('content://media/external/audio/123')).toBe(true);
    expect(validateAudioUri('https://example.com/audio.wav')).toBe(false);
  });

  it('sanitizes file paths conservatively', () => {
    expect(sanitizeFilePath('file:///data//user//0//app\0/test.wav')).toBe('file:///data//user//0//app/test.wav');
    expect(sanitizeFilePath('/tmp//foo///bar.wav')).toBe('/tmp/foo/bar.wav');
  });

  it('normalizes optional text values', () => {
    expect(sanitizeOptionalText('  hello world  ')).toBe('hello world');
    expect(sanitizeOptionalText('   ')).toBeNull();
    expect(sanitizeOptionalText(undefined)).toBeNull();
  });
});
