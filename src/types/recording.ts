import type { ImageClassification } from '../utils/imageClassification';

// Protocol types for ISO 12913 compliance
export type ProtocolType = 'opportunistic' | 'stationary_60s' | 'soundwalk';

// Sync status for offline-first architecture
export type SyncStatus = 'local' | 'queued' | 'uploading' | 'uploaded' | 'failed';

// Privacy modes for location data
export type PrivacyMode = 'exact' | 'fuzzed' | 'hidden';

// License types for uploaded recordings
export type LicenseType = 'CC-BY' | 'CC-BY-NC' | 'CC0';
export type CommunityVisibility = 'private' | 'community';

// Habitat types from ISO 12913
export type HabitatType =
  | 'urban_park'
  | 'residential'
  | 'commercial'
  | 'industrial'
  | 'forest'
  | 'water_body'
  | 'rural'
  | 'transport_hub'
  | 'mixed_use'
  | 'other';

// Quality flags for recording assessment
export interface QualityFlags {
  hasClipping: boolean;
  hasWindHandling: boolean;
  hasLowSNR: boolean;
  peakDb: number;
  rmsDb: number;
}

// Source dominance breakdown (should sum to 100)
export interface SourceDominance {
  biophony: number;   // Natural biological sounds
  geophony: number;   // Natural non-biological sounds (wind, water)
  anthrophony: number; // Human-made sounds
}

// Setting chips for context
export interface SettingContext {
  indoor: boolean;
  outdoor: boolean;
  alone: boolean;
  inGroup: boolean;
  purpose?: string;
}

// Device metadata
export interface DeviceMetadata {
  model: string;
  osVersion: string;
  micRoute: string;
}

// Location data
export interface LocationData {
  latitude: number;
  longitude: number;
  accuracy: number;
  altitude?: number;
}

// Recording interface - main entity
export interface Recording {
  id: string;
  audioUri: string;

  // Audio metadata
  sampleRate: number;
  bitDepth: number;
  durationMs: number;

  // Device info
  deviceModel: string;
  osVersion: string;
  micRoute: string;

  // Timestamp
  recordedAt: string;
  timezone: string;

  // Location
  latitude: number | null;
  longitude: number | null;
  gpsAccuracy: number | null;
  privacyMode: PrivacyMode;

  // Protocol
  protocolType: ProtocolType;
  projectId?: string;

  // Quality
  hasClipping: boolean;
  hasWindHandling: boolean;
  hasLowSNR: boolean;
  peakDb?: number;
  rmsDb?: number;
  normalizationApplied?: boolean;
  normalizationGain?: number | null;
  // IEC-weighted acoustic metrics (LAeq, LAFmax, percentiles).
  // JSON string of AcousticMetrics from services/audio/acousticMetrics.
  acousticMetrics?: string;

  // Spectrogram
  spectrogramUri?: string;

  // AI-detected sound classes (JSON string: [{label, score, emoji}])
  detectedSounds?: string;

  // Photo
  photoUri?: string;
  photoClassification?: ImageClassification[];

  // Notes
  fieldNotes?: string;
  spokenDescription?: string;

  // Context
  habitatType?: HabitatType;
  settingChips?: string; // JSON string of SettingContext
  sourceDominance?: string; // JSON string of SourceDominance

  // Upload
  license?: LicenseType;
  communityVisibility: CommunityVisibility;
  syncStatus: SyncStatus;
  remoteId?: string;

  // Timestamps
  createdAt: string;
  updatedAt: string;
}

// Circumplex perception (2D plane)
export interface CircumplexPerception {
  pleasant: number; // -1 to 1 (annoying to pleasant)
  eventful: number; // -1 to 1 (uneventful to eventful)
}

// PAQ perception (8 attributes, 1-5 scale)
export interface PAQPerception {
  pleasant: number;
  vibrant: number;
  eventful: number;
  chaotic: number;
  annoying: number;
  monotonous: number;
  uneventful: number;
  calm: number;
}

// Full perception data
export interface Perception {
  id: string;
  recordingId: string;

  // Circumplex values (-1 to 1)
  isoPleasant: number;
  isoEventful: number;

  // PAQ values (1-5)
  paqPleasant?: number;
  paqVibrant?: number;
  paqEventful?: number;
  paqChaotic?: number;
  paqAnnoying?: number;
  paqMonotonous?: number;
  paqUneventful?: number;
  paqCalm?: number;

  createdAt: string;
}

// Upload queue item
export interface UploadQueueItem {
  id: string;
  recordingId: string;
  attempts: number;
  nextRetryAt: string;
  lastError?: string;
}

// Filter options for My Map
export interface RecordingFilters {
  dateRange?: {
    start: string;
    end: string;
  };
  timeOfDay?: {
    start: number; // hour 0-23
    end: number;
  };
  protocols?: ProtocolType[];
  habitats?: HabitatType[];
  dominantSource?: 'biophony' | 'geophony' | 'anthrophony';
  syncStatus?: SyncStatus[];
  hasQualityIssues?: boolean;
}

// Recording with perception for display
export interface RecordingWithPerception extends Recording {
  perception?: Perception;
}
