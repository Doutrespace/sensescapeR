import { create } from 'zustand';
import type { ImageClassification } from '../utils/imageClassification';
import {
  ProtocolType,
  CircumplexPerception,
  PAQPerception,
  SourceDominance,
  HabitatType,
  SettingContext,
  LicenseType,
  PrivacyMode,
  CommunityVisibility,
  QualityFlags,
  LocationData,
} from '../types/recording';

// Recording session states
export type RecordingState =
  | 'IDLE'
  | 'PROTOCOL'
  | 'COUNTDOWN'
  | 'RECORDING'
  | 'REVIEW'
  | 'PHOTO_CAPTURE'
  | 'NOTES'
  | 'CIRCUMPLEX'
  | 'CONTEXT'
  | 'UPLOAD'
  | 'SAVING';

export type RecordingShortcutAction = 'START_RECORDING';

interface RecordingSession {
  // Current state
  state: RecordingState;

  // Protocol
  protocolType: ProtocolType;
  targetDuration: number; // ms

  // Recording data
  audioUri: string | null;
  durationMs: number;
  spectrogramUri: string | null;
  detectedSounds: string | null;

  // Photo data (NEW)
  photoUri: string | null;
  photoClassification: ImageClassification[] | null;

  // Notes
  fieldNotes: string;
  spokenDescription: string;

  // Quality metrics
  qualityFlags: QualityFlags;
  meterLevel: number; // Current level for meter display
  normalizationApplied: boolean;
  normalizationGain: number | null;
  acousticMetrics: string | null; // JSON string of AcousticMetrics

  // Location
  location: LocationData | null;
  locationError: string | null;

  // Perception
  circumplex: CircumplexPerception | null;
  paq: PAQPerception | null;

  // Context
  habitatType: HabitatType | null;
  settingContext: SettingContext | null;
  sourceDominance: SourceDominance | null;

  // Upload config
  license: LicenseType;
  privacyMode: PrivacyMode;
  communityVisibility: CommunityVisibility;

  // External launch actions
  pendingShortcutAction: RecordingShortcutAction | null;
}

interface RecordingStoreState extends RecordingSession {
  // Actions
  setState: (state: RecordingState) => void;
  setProtocol: (protocol: ProtocolType, duration: number) => void;
  setAudioUri: (
    uri: string,
    duration: number,
    spectrogramUri?: string,
    detectedSounds?: string,
    normalizationApplied?: boolean,
    normalizationGain?: number | null,
    acousticMetrics?: string,
  ) => void;
  setSpectrogramUri: (uri: string | null) => void;
  setDetectedSounds: (detectedSounds: string | null) => void;
  setPhotoData: (uri: string | null, classification?: ImageClassification[]) => void;
  setFieldNotes: (notes: string) => void;
  setSpokenDescription: (text: string) => void;
  setMeterLevel: (level: number) => void;
  updateQualityFlags: (flags: Partial<QualityFlags>) => void;
  setLocation: (location: LocationData) => void;
  setLocationError: (error: string | null) => void;
  setCircumplex: (perception: CircumplexPerception) => void;
  setPAQ: (perception: PAQPerception) => void;
  setHabitatType: (habitat: HabitatType) => void;
  setSettingContext: (context: SettingContext) => void;
  setSourceDominance: (dominance: SourceDominance) => void;
  setLicense: (license: LicenseType) => void;
  setPrivacyMode: (mode: PrivacyMode) => void;
  setCommunityVisibility: (value: CommunityVisibility) => void;
  queueShortcutAction: (action: RecordingShortcutAction) => void;
  consumeShortcutAction: () => void;
  reset: () => void;
}

const initialQualityFlags: QualityFlags = {
  hasClipping: false,
  hasWindHandling: false,
  hasLowSNR: false,
  peakDb: -60,
  rmsDb: -60,
};

const initialState: RecordingSession = {
  state: 'IDLE',
  protocolType: 'opportunistic',
  targetDuration: 30000, // 30s default
  audioUri: null,
  durationMs: 0,
  spectrogramUri: null,
  detectedSounds: null,
  photoUri: null,
  photoClassification: null,
  fieldNotes: '',
  spokenDescription: '',
  qualityFlags: initialQualityFlags,
  meterLevel: 0,
  normalizationApplied: false,
  normalizationGain: null,
  acousticMetrics: null,
  location: null,
  locationError: null,
  circumplex: null,
  paq: null,
  habitatType: null,
  settingContext: null,
  sourceDominance: null,
  license: 'CC-BY',
  privacyMode: 'exact',
  communityVisibility: 'community',
  pendingShortcutAction: null,
};

export const useRecordingStore = create<RecordingStoreState>((set) => ({
  ...initialState,

  setState: (state) => set({ state }),

  setProtocol: (protocolType, targetDuration) =>
    set({ protocolType, targetDuration }),

  setAudioUri: (
    audioUri,
    durationMs,
    spectrogramUri,
    detectedSounds,
    normalizationApplied,
    normalizationGain,
    acousticMetrics,
  ) =>
    set({
      audioUri,
      durationMs,
      spectrogramUri: spectrogramUri ?? null,
      detectedSounds: detectedSounds ?? null,
      normalizationApplied: normalizationApplied ?? false,
      normalizationGain: normalizationGain ?? null,
      acousticMetrics: acousticMetrics ?? null,
    }),

  setSpectrogramUri: (spectrogramUri) =>
    set({ spectrogramUri }),

  setDetectedSounds: (detectedSounds) =>
    set({ detectedSounds }),

  setPhotoData: (photoUri, photoClassification) =>
    set({ photoUri, photoClassification: photoClassification ?? null }),

  setFieldNotes: (fieldNotes) =>
    set({ fieldNotes }),

  setSpokenDescription: (spokenDescription) =>
    set({ spokenDescription }),

  setMeterLevel: (meterLevel) =>
    set({ meterLevel }),

  updateQualityFlags: (flags) =>
    set((state) => ({
      qualityFlags: { ...state.qualityFlags, ...flags },
    })),

  setLocation: (location) =>
    set({ location }),

  setLocationError: (locationError) =>
    set({ locationError }),

  setCircumplex: (circumplex) =>
    set({ circumplex }),

  setPAQ: (paq) =>
    set({ paq }),

  setHabitatType: (habitatType) =>
    set({ habitatType }),

  setSettingContext: (settingContext) =>
    set({ settingContext }),

  setSourceDominance: (sourceDominance) =>
    set({ sourceDominance }),

  setLicense: (license) =>
    set({ license }),

  setPrivacyMode: (privacyMode) =>
    set({ privacyMode }),

  setCommunityVisibility: (communityVisibility) =>
    set({ communityVisibility }),

  queueShortcutAction: (pendingShortcutAction) =>
    set({ pendingShortcutAction }),

  consumeShortcutAction: () =>
    set({ pendingShortcutAction: null }),

  reset: () => set(initialState),
}));
