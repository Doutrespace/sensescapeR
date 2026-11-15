import { Audio } from 'expo-av';

// Audio level thresholds
export const DB_MIN = -60;
export const DB_MAX = 0;
export const CLIP_THRESHOLD_DB = -3;
export const LOW_LEVEL_THRESHOLD_DB = -50;

// Quality detection thresholds
export const CLIP_COUNT_THRESHOLD = 5;
export const LOW_SNR_RATIO_THRESHOLD = 0.92;

// High-quality recording preset for soundscape research
export const RECORDING_OPTIONS_HIGH_QUALITY: Audio.RecordingOptions = {
  isMeteringEnabled: true,
  android: {
    extension: '.m4a',
    outputFormat: Audio.AndroidOutputFormat.MPEG_4,
    audioEncoder: Audio.AndroidAudioEncoder.AAC,
    sampleRate: 48000,
    numberOfChannels: 2,
    bitRate: 256000,
  },
  ios: {
    extension: '.m4a',
    audioQuality: Audio.IOSAudioQuality.MAX,
    sampleRate: 48000,
    numberOfChannels: 2,
    bitRate: 256000,
    linearPCMBitDepth: 16,
    linearPCMIsBigEndian: false,
    linearPCMIsFloat: false,
  },
  web: {
    mimeType: 'audio/webm',
    bitsPerSecond: 256000,
  },
};

// Convert dB to normalized level (0-1)
export function dbToNormalized(db: number): number {
  const normalized = (db - DB_MIN) / (DB_MAX - DB_MIN);
  return Math.max(0, Math.min(1, normalized));
}
