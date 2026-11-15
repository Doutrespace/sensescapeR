import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { RecordingWithPerception } from '../../types/recording';
import { LoggingService } from '../logging';
import { getActiveResearchProfile } from '../researchProfile';
import {
  formatAsJSON,
  formatAsCSV,
  formatAsGeoJSON,
  formatRecordingSummary,
} from './formatters';
import { formatAsSoundscapyCSV } from './soundscapyExport';

export type ExportFormat =
  | 'audio'
  | 'spectrogram'
  | 'json'
  | 'csv'
  | 'geojson'
  | 'soundscapy'
  | 'summary';

export interface ExportResult {
  success: boolean;
  error?: string;
}

export class ExportService {
  /**
   * Check if sharing is available on the device
   */
  static async isAvailable(): Promise<boolean> {
    return await Sharing.isAvailableAsync();
  }

  /**
   * Share the audio file
   */
  static async shareAudio(recording: RecordingWithPerception): Promise<ExportResult> {
    try {
      const isAvailable = await Sharing.isAvailableAsync();
      if (!isAvailable) {
        return { success: false, error: 'Sharing is not available on this device' };
      }

      // Check if file exists
      if (!new File(recording.audioUri).exists) {
        return { success: false, error: 'Audio file not found' };
      }

      // Share the audio file
      await Sharing.shareAsync(recording.audioUri, {
        mimeType: 'audio/wav',
        dialogTitle: 'Share Soundscape Recording',
        UTI: 'public.audio',
      });

      return { success: true };
    } catch (error: any) {
      LoggingService.error('Failed to share audio export', {
        error: error?.message || String(error),
      });
      return { success: false, error: error.message || 'Failed to share audio' };
    }
  }

  /**
   * Share the spectrogram image
   */
  static async shareSpectrogram(recording: RecordingWithPerception): Promise<ExportResult> {
    try {
      if (!recording.spectrogramUri) {
        return { success: false, error: 'No spectrogram available for this recording' };
      }

      const isAvailable = await Sharing.isAvailableAsync();
      if (!isAvailable) {
        return { success: false, error: 'Sharing is not available on this device' };
      }

      // Check if file exists
      if (!new File(recording.spectrogramUri).exists) {
        return { success: false, error: 'Spectrogram file not found' };
      }

      await Sharing.shareAsync(recording.spectrogramUri, {
        mimeType: 'image/png',
        dialogTitle: 'Share Spectrogram',
        UTI: 'public.image',
      });

      return { success: true };
    } catch (error: any) {
      LoggingService.error('Failed to share spectrogram export', {
        error: error?.message || String(error),
      });
      return { success: false, error: error.message || 'Failed to share spectrogram' };
    }
  }

  /**
   * Export recording(s) as JSON
   */
  static async exportAsJSON(recordings: RecordingWithPerception | RecordingWithPerception[]): Promise<ExportResult> {
    try {
      const recordingsArray = Array.isArray(recordings) ? recordings : [recordings];
      const isAvailable = await Sharing.isAvailableAsync();
      if (!isAvailable) {
        return { success: false, error: 'Sharing is not available on this device' };
      }

      const researchProfile = await getActiveResearchProfile();
      const jsonContent = formatAsJSON(recordingsArray, researchProfile);
      const filename = recordingsArray.length === 1
        ? `soundscape_${recordingsArray[0].id.slice(0, 8)}.json`
        : `soundscapes_export_${Date.now()}.json`;
      const file = createCacheFile(filename, jsonContent);

      await Sharing.shareAsync(file.uri, {
        mimeType: 'application/json',
        dialogTitle: 'Export Recording Data (JSON)',
        UTI: 'public.json',
      });

      deleteFileIfPresent(file);

      return { success: true };
    } catch (error: any) {
      LoggingService.error('Failed to export JSON', {
        error: error?.message || String(error),
      });
      return { success: false, error: error.message || 'Failed to export JSON' };
    }
  }

  /**
   * Export recording(s) as CSV
   */
  static async exportAsCSV(recordings: RecordingWithPerception | RecordingWithPerception[]): Promise<ExportResult> {
    try {
      const recordingsArray = Array.isArray(recordings) ? recordings : [recordings];
      const isAvailable = await Sharing.isAvailableAsync();
      if (!isAvailable) {
        return { success: false, error: 'Sharing is not available on this device' };
      }

      const researchProfile = await getActiveResearchProfile();
      const csvContent = formatAsCSV(recordingsArray, researchProfile);
      const filename = recordingsArray.length === 1
        ? `soundscape_${recordingsArray[0].id.slice(0, 8)}.csv`
        : `soundscapes_export_${Date.now()}.csv`;
      const file = createCacheFile(filename, csvContent);

      await Sharing.shareAsync(file.uri, {
        mimeType: 'text/csv',
        dialogTitle: 'Export Recording Data (CSV)',
        UTI: 'public.comma-separated-values-text',
      });

      deleteFileIfPresent(file);

      return { success: true };
    } catch (error: any) {
      LoggingService.error('Failed to export CSV', {
        error: error?.message || String(error),
      });
      return { success: false, error: error.message || 'Failed to export CSV' };
    }
  }

  /**
   * Export recording(s) as GeoJSON
   */
  static async exportAsGeoJSON(recordings: RecordingWithPerception | RecordingWithPerception[]): Promise<ExportResult> {
    try {
      const recordingsArray = Array.isArray(recordings) ? recordings : [recordings];
      const isAvailable = await Sharing.isAvailableAsync();
      if (!isAvailable) {
        return { success: false, error: 'Sharing is not available on this device' };
      }

      const researchProfile = await getActiveResearchProfile();
      const geoJsonContent = formatAsGeoJSON(recordingsArray, researchProfile);
      const filename = recordingsArray.length === 1
        ? `soundscape_${recordingsArray[0].id.slice(0, 8)}.geojson`
        : `soundscapes_export_${Date.now()}.geojson`;
      const file = createCacheFile(filename, geoJsonContent);

      await Sharing.shareAsync(file.uri, {
        mimeType: 'application/geo+json',
        dialogTitle: 'Export Recording Data (GeoJSON)',
        UTI: 'public.json',
      });

      deleteFileIfPresent(file);

      return { success: true };
    } catch (error: any) {
      LoggingService.error('Failed to export GeoJSON', {
        error: error?.message || String(error),
      });
      return { success: false, error: error.message || 'Failed to export GeoJSON' };
    }
  }

  /**
   * Export recording(s) as Soundscapy-compatible CSV
   */
  static async exportAsSoundscapyCSV(
    recordings: RecordingWithPerception | RecordingWithPerception[]
  ): Promise<ExportResult> {
    try {
      const recordingsArray = Array.isArray(recordings) ? recordings : [recordings];
      const isAvailable = await Sharing.isAvailableAsync();
      if (!isAvailable) {
        return { success: false, error: 'Sharing is not available on this device' };
      }

      const researchProfile = await getActiveResearchProfile();
      const csvContent = formatAsSoundscapyCSV(recordingsArray, researchProfile);
      const filename = recordingsArray.length === 1
        ? `soundscape_${recordingsArray[0].id.slice(0, 8)}_soundscapy.csv`
        : `soundscapes_soundscapy_${Date.now()}.csv`;
      const file = createCacheFile(filename, csvContent);

      await Sharing.shareAsync(file.uri, {
        mimeType: 'text/csv',
        dialogTitle: 'Export Soundscapy Dataset (CSV)',
        UTI: 'public.comma-separated-values-text',
      });

      deleteFileIfPresent(file);

      return { success: true };
    } catch (error: any) {
      LoggingService.error('Failed to export Soundscapy CSV', {
        error: error?.message || String(error),
      });
      return { success: false, error: error.message || 'Failed to export Soundscapy CSV' };
    }
  }

  /**
   * Share a text summary of the recording
   */
  static async shareSummary(recording: RecordingWithPerception): Promise<ExportResult> {
    try {
      const isAvailable = await Sharing.isAvailableAsync();
      if (!isAvailable) {
        return { success: false, error: 'Sharing is not available on this device' };
      }

      const summary = formatRecordingSummary(recording);
      const filename = `soundscape_summary_${recording.id.slice(0, 8)}.txt`;
      const file = createCacheFile(filename, summary);

      await Sharing.shareAsync(file.uri, {
        mimeType: 'text/plain',
        dialogTitle: 'Share Recording Summary',
        UTI: 'public.plain-text',
      });

      deleteFileIfPresent(file);

      return { success: true };
    } catch (error: any) {
      LoggingService.error('Failed to share summary export', {
        error: error?.message || String(error),
      });
      return { success: false, error: error.message || 'Failed to share summary' };
    }
  }
}

export {
  formatAsJSON,
  formatAsCSV,
  formatAsGeoJSON,
  formatRecordingSummary,
} from './formatters';
export { formatAsSoundscapyCSV } from './soundscapyExport';

function createCacheFile(filename: string, content: string): File {
  const file = new File(Paths.cache, filename);
  file.create({ intermediates: true, overwrite: true });
  file.write(content);
  return file;
}

function deleteFileIfPresent(file: File): void {
  if (file.exists) {
    file.delete();
  }
}
