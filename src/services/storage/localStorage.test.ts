const mockGetRecordings = jest.fn();
const mockClearAllData = jest.fn();
const mockDeleteRecording = jest.fn();

const mockFileRegistry = new Map<string, { exists: boolean; size: number }>();
const mockDeletedFiles: string[] = [];

jest.mock('expo-file-system', () => ({
  File: class MockFile {
    uri: string;

    constructor(uri: string) {
      this.uri = uri;
    }

    get exists() {
      return mockFileRegistry.get(this.uri)?.exists ?? false;
    }

    info() {
      return { size: mockFileRegistry.get(this.uri)?.size ?? 0 };
    }

    delete() {
      mockDeletedFiles.push(this.uri);
      const current = mockFileRegistry.get(this.uri);
      if (current) {
        mockFileRegistry.set(this.uri, { ...current, exists: false });
      }
    }
  },
}));

jest.mock('../database', () => ({
  clearAllData: jest.fn(async () => mockClearAllData()),
}));

jest.mock('../database/recordings', () => ({
  getRecordings: jest.fn(async () => mockGetRecordings()),
  deleteRecording: jest.fn(async (...args) => mockDeleteRecording(...args)),
}));

import {
  cleanupExpiredLocalRecordingData,
  clearLocalRecordingData,
  formatStorageSize,
  getLocalStorageUsage,
} from './localStorage';

describe('localStorage service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFileRegistry.clear();
    mockDeletedFiles.length = 0;
  });

  it('aggregates local storage usage without double-counting shared files', async () => {
    mockFileRegistry.set('file:///audio-1.wav', { exists: true, size: 1200 });
    mockFileRegistry.set('file:///photo-1.jpg', { exists: true, size: 500 });
    mockFileRegistry.set('file:///spectrogram-1.png', { exists: true, size: 300 });

    mockGetRecordings.mockResolvedValueOnce([
      {
        id: 'rec-1',
        audioUri: 'file:///audio-1.wav',
        photoUri: 'file:///photo-1.jpg',
        spectrogramUri: 'file:///spectrogram-1.png',
      },
      {
        id: 'rec-2',
        audioUri: 'file:///audio-1.wav',
        photoUri: undefined,
        spectrogramUri: undefined,
      },
    ]);

    const usage = await getLocalStorageUsage();

    expect(usage).toEqual({
      recordingCount: 2,
      fileCount: 3,
      audioBytes: 1200,
      photoBytes: 500,
      spectrogramBytes: 300,
      totalBytes: 2000,
    });
  });

  it('clears local media files and database rows', async () => {
    mockFileRegistry.set('file:///audio-1.wav', { exists: true, size: 1200 });
    mockFileRegistry.set('file:///photo-1.jpg', { exists: true, size: 500 });
    mockFileRegistry.set('file:///spectrogram-1.png', { exists: true, size: 300 });

    mockGetRecordings.mockResolvedValueOnce([
      {
        id: 'rec-1',
        audioUri: 'file:///audio-1.wav',
        photoUri: 'file:///photo-1.jpg',
        spectrogramUri: 'file:///spectrogram-1.png',
      },
      {
        id: 'rec-2',
        audioUri: 'file:///audio-1.wav',
        photoUri: undefined,
        spectrogramUri: undefined,
      },
    ]);

    const result = await clearLocalRecordingData();

    expect(result).toEqual({
      deletedRecordings: 2,
      deletedFiles: 3,
      freedBytes: 2000,
    });
    expect(mockDeletedFiles).toEqual([
      'file:///audio-1.wav',
      'file:///photo-1.jpg',
      'file:///spectrogram-1.png',
    ]);
    expect(mockClearAllData).toHaveBeenCalledTimes(1);
  });

  it('cleans up only expired uploaded recordings when retention cleanup is limited', async () => {
    mockFileRegistry.set('file:///audio-old.wav', { exists: true, size: 1200 });
    mockFileRegistry.set('file:///photo-old.jpg', { exists: true, size: 500 });
    mockFileRegistry.set('file:///audio-new.wav', { exists: true, size: 900 });

    const now = Date.now();
    mockGetRecordings.mockResolvedValueOnce([
      {
        id: 'uploaded-old',
        recordedAt: new Date(now - (120 * 24 * 60 * 60 * 1000)).toISOString(),
        syncStatus: 'uploaded',
        audioUri: 'file:///audio-old.wav',
        photoUri: 'file:///photo-old.jpg',
        spectrogramUri: undefined,
      },
      {
        id: 'local-old',
        recordedAt: new Date(now - (120 * 24 * 60 * 60 * 1000)).toISOString(),
        syncStatus: 'local',
        audioUri: 'file:///audio-new.wav',
        photoUri: undefined,
        spectrogramUri: undefined,
      },
    ]);

    const result = await cleanupExpiredLocalRecordingData({
      retentionDays: 90,
      uploadedOnly: true,
    });

    expect(result).toEqual({
      deletedRecordings: 1,
      deletedFiles: 2,
      freedBytes: 1700,
    });
    expect(mockDeleteRecording).toHaveBeenCalledTimes(1);
    expect(mockDeleteRecording).toHaveBeenCalledWith('uploaded-old');
  });

  it('formats storage sizes for display', () => {
    expect(formatStorageSize(0)).toBe('0 B');
    expect(formatStorageSize(512)).toBe('512 B');
    expect(formatStorageSize(1536)).toBe('1.50 KB');
    expect(formatStorageSize(5 * 1024 * 1024)).toBe('5.00 MB');
  });
});
