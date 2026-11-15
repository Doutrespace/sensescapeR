import React from 'react';
import { Alert } from 'react-native';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { ExportOptionsSheet } from './ExportOptionsSheet';

const mockSetLastExport = jest.fn();
const mockExportAsJSON = jest.fn();
const mockExportAsSoundscapyCSV = jest.fn();

jest.mock('../../stores/useActivityStore', () => ({
  useActivityStore: () => ({
    setLastExport: mockSetLastExport,
  }),
}));

jest.mock('../../services/export', () => ({
  ExportService: {
    shareAudio: jest.fn(),
    shareSpectrogram: jest.fn(),
    exportAsJSON: (...args: unknown[]) => mockExportAsJSON(...args),
    exportAsCSV: jest.fn(),
    exportAsGeoJSON: jest.fn(),
    exportAsSoundscapyCSV: (...args: unknown[]) => mockExportAsSoundscapyCSV(...args),
    shareSummary: jest.fn(),
  },
}));

describe('ExportOptionsSheet', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const recording = {
    id: 'rec-1',
    audioUri: 'file:///tmp/audio.wav',
    sampleRate: 48000,
    bitDepth: 16,
    durationMs: 15000,
    deviceModel: 'Phone',
    osVersion: '1',
    micRoute: 'built-in',
    recordedAt: '2026-03-07T10:00:00.000Z',
    timezone: 'Europe/Berlin',
    latitude: null,
    longitude: null,
    gpsAccuracy: null,
    privacyMode: 'hidden' as const,
    communityVisibility: 'private' as const,
    protocolType: 'opportunistic' as const,
    hasClipping: false,
    hasWindHandling: false,
    hasLowSNR: false,
    syncStatus: 'local' as const,
    createdAt: '2026-03-07T10:00:00.000Z',
    updatedAt: '2026-03-07T10:00:00.000Z',
  };

  it('records successful exports in activity history', async () => {
    mockExportAsJSON.mockResolvedValueOnce({ success: true });

    const { getByLabelText } = render(
      <ExportOptionsSheet recording={recording} visible onClose={jest.fn()} />
    );

    fireEvent.press(getByLabelText('Export as JSON'));

    await waitFor(() => {
      expect(mockExportAsJSON).toHaveBeenCalledWith(recording);
      expect(mockSetLastExport).toHaveBeenCalledWith(
        expect.objectContaining({
          format: 'json',
          status: 'success',
        })
      );
    });
  });

  it('surfaces export failures', async () => {
    mockExportAsJSON.mockResolvedValueOnce({ success: false, error: 'Disk full' });

    const { getByLabelText } = render(
      <ExportOptionsSheet recording={recording} visible onClose={jest.fn()} />
    );

    fireEvent.press(getByLabelText('Export as JSON'));

    await waitFor(() => {
      expect(mockSetLastExport).toHaveBeenCalledWith(
        expect.objectContaining({
          format: 'json',
          status: 'error',
          message: 'Disk full',
        })
      );
      expect(Alert.alert).toHaveBeenCalledWith('Export failed', 'Disk full');
    });
  });

  it('supports Soundscapy export format', async () => {
    mockExportAsSoundscapyCSV.mockResolvedValueOnce({ success: true });

    const { getByLabelText } = render(
      <ExportOptionsSheet recording={recording} visible onClose={jest.fn()} />
    );

    fireEvent.press(getByLabelText('Export for Soundscapy'));

    await waitFor(() => {
      expect(mockExportAsSoundscapyCSV).toHaveBeenCalledWith(recording);
      expect(mockSetLastExport).toHaveBeenCalledWith(
        expect.objectContaining({
          format: 'soundscapy',
          status: 'success',
        })
      );
    });
  });
});
