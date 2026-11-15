import { RecordingWithPerception, SourceDominance } from '../../types/recording';
import {
  getIncludedImageClassifications,
  type ImageClassification,
} from '../../utils/imageClassification';
import { extractNoteThemes } from '../../utils/noteAnalysis';
import { assessVisualContext, formatVisualIndicatorSummary } from '../../utils/visualContext';
import type { AcousticMetrics } from '../audio/acousticMetrics';
import type { ResearchProfile } from '../../types/researchProfile';

interface SoundscapyRow {
  RecordID: string;
  GroupID: string;
  SessionID: string;
  LocationID: string;
  Timestamp: string;
  pleasant: number | '';
  vibrant: number | '';
  eventful: number | '';
  chaotic: number | '';
  annoying: number | '';
  monotonous: number | '';
  uneventful: number | '';
  calm: number | '';
  ISOPleasant: number | '';
  ISOEventful: number | '';
  Quadrant: string;
  // IEC 61672 A-weighted metrics from the raw capture. LevelReference says
  // whether these are dBFS (uncalibrated, device-relative) or dB SPL (calibrated).
  LAeq: number | '';
  LAFmax: number | '';
  LAF10: number | '';
  LAF50: number | '';
  LAF90: number | '';
  LAF95: number | '';
  LZeq: number | '';
  LevelReference: string;
  Calibrated: boolean | '';
  CalibrationOffsetDb: number | '';
  // Legacy raw RMS/peak proxies, kept for backward compatibility with older exports.
  LAeqApproxDbfs: number | '';
  LAmaxApproxDbfs: number | '';
  PlaybackNormalized: boolean;
  PlaybackGain: number | '';
  HabitatType: string;
  Biophony: number | '';
  Geophony: number | '';
  Anthrophony: number | '';
  DominantScene: string;
  VisualIndicators: string;
  DetectedObjects: string;
  EnvironmentalContext: string;
  NoteKeywords: string;
  FieldNotes: string;
  SpokenDescription: string;
  DeviceModel: string;
  Latitude: number | '';
  Longitude: number | '';
  PrivacyMode: string;
  CommunityVisibility: string;
  ParticipantAgeRange: string;
  ParticipantGender: string;
  ParticipantOccupation: string;
  ParticipantLivingArea: string;
}

export function formatAsSoundscapyCSV(
  recordings: RecordingWithPerception[],
  researchProfile: ResearchProfile = {}
): string {
  if (recordings.length === 0) {
    return '';
  }

  const headers: Array<keyof SoundscapyRow> = [
    'RecordID',
    'GroupID',
    'SessionID',
    'LocationID',
    'Timestamp',
    'pleasant',
    'vibrant',
    'eventful',
    'chaotic',
    'annoying',
    'monotonous',
    'uneventful',
    'calm',
    'ISOPleasant',
    'ISOEventful',
    'Quadrant',
    'LAeq',
    'LAFmax',
    'LAF10',
    'LAF50',
    'LAF90',
    'LAF95',
    'LZeq',
    'LevelReference',
    'Calibrated',
    'CalibrationOffsetDb',
    'LAeqApproxDbfs',
    'LAmaxApproxDbfs',
    'PlaybackNormalized',
    'PlaybackGain',
    'HabitatType',
    'Biophony',
    'Geophony',
    'Anthrophony',
    'DominantScene',
    'VisualIndicators',
    'DetectedObjects',
    'EnvironmentalContext',
    'NoteKeywords',
    'FieldNotes',
    'SpokenDescription',
    'DeviceModel',
    'Latitude',
    'Longitude',
    'PrivacyMode',
    'CommunityVisibility',
    'ParticipantAgeRange',
    'ParticipantGender',
    'ParticipantOccupation',
    'ParticipantLivingArea',
  ];

  const rows = recordings.map((recording) => {
    const row = toSoundscapyRow(recording, researchProfile);
    return headers.map((header) => escapeCSV(String(row[header] ?? ''))).join(',');
  });

  return [headers.join(','), ...rows].join('\n');
}

function toSoundscapyRow(
  recording: RecordingWithPerception,
  researchProfile: ResearchProfile
): SoundscapyRow {
  const sourceDominance = parseSourceDominance(recording.sourceDominance);
  const metrics = parseAcousticMetrics(recording.acousticMetrics);
  const photoClassification = getIncludedImageClassifications(recording.photoClassification ?? []);
  const objectLabels = photoClassification
    .filter((item) => (item.source ?? 'object') === 'object')
    .map((item) => item.label);
  const environmentLabels = photoClassification
    .filter((item) => item.source === 'environment')
    .sort((a, b) => (b.coverage ?? b.confidence) - (a.coverage ?? a.confidence))
    .map((item) => `${item.label} ${Math.round((item.coverage ?? item.confidence) * 100)}%`);
  const dominantEnvironment = inferDominantScene(photoClassification);
  const visualContext = assessVisualContext(photoClassification);
  const noteThemes = extractNoteThemes(recording.fieldNotes, recording.spokenDescription);

  return {
    RecordID: recording.id,
    GroupID: recording.protocolType,
    SessionID: recording.id,
    LocationID: buildLocationId(recording),
    Timestamp: recording.recordedAt,
    pleasant: recording.perception?.paqPleasant ?? '',
    vibrant: recording.perception?.paqVibrant ?? '',
    eventful: recording.perception?.paqEventful ?? '',
    chaotic: recording.perception?.paqChaotic ?? '',
    annoying: recording.perception?.paqAnnoying ?? '',
    monotonous: recording.perception?.paqMonotonous ?? '',
    uneventful: recording.perception?.paqUneventful ?? '',
    calm: recording.perception?.paqCalm ?? '',
    ISOPleasant: recording.perception?.isoPleasant ?? '',
    ISOEventful: recording.perception?.isoEventful ?? '',
    Quadrant: recording.perception
      ? getCircumplexQuadrantLabel(recording.perception.isoPleasant, recording.perception.isoEventful)
      : '',
    LAeq: metrics?.laeq ?? '',
    LAFmax: metrics?.lafMax ?? '',
    LAF10: metrics?.laf10 ?? '',
    LAF50: metrics?.laf50 ?? '',
    LAF90: metrics?.laf90 ?? '',
    LAF95: metrics?.laf95 ?? '',
    LZeq: metrics?.lzeq ?? '',
    LevelReference: metrics?.reference ?? '',
    Calibrated: metrics ? metrics.calibrated : '',
    CalibrationOffsetDb: metrics?.calibrationOffsetDb ?? '',
    LAeqApproxDbfs: recording.rmsDb ?? '',
    LAmaxApproxDbfs: recording.peakDb ?? '',
    PlaybackNormalized: recording.normalizationApplied ?? false,
    PlaybackGain: recording.normalizationGain ?? '',
    HabitatType: recording.habitatType ?? '',
    Biophony: sourceDominance?.biophony ?? '',
    Geophony: sourceDominance?.geophony ?? '',
    Anthrophony: sourceDominance?.anthrophony ?? '',
    DominantScene: dominantEnvironment || visualContext.dominantContext,
    VisualIndicators: formatVisualIndicatorSummary(visualContext),
    DetectedObjects: objectLabels.join('; '),
    EnvironmentalContext: environmentLabels.join('; '),
    NoteKeywords: noteThemes.map((theme) => theme.label).join('; '),
    FieldNotes: recording.fieldNotes?.trim() ?? '',
    SpokenDescription: recording.spokenDescription?.trim() ?? '',
    DeviceModel: recording.deviceModel,
    Latitude: recording.latitude ?? '',
    Longitude: recording.longitude ?? '',
    PrivacyMode: recording.privacyMode,
    CommunityVisibility: recording.communityVisibility,
    ParticipantAgeRange: researchProfile.ageRange ?? '',
    ParticipantGender: researchProfile.gender ?? '',
    ParticipantOccupation: researchProfile.occupation ?? '',
    ParticipantLivingArea: researchProfile.livingArea ?? '',
  };
}

function buildLocationId(recording: RecordingWithPerception): string {
  if (recording.habitatType) {
    return recording.habitatType;
  }

  if (typeof recording.latitude === 'number' && typeof recording.longitude === 'number') {
    return `${recording.latitude.toFixed(3)}_${recording.longitude.toFixed(3)}`;
  }

  return 'unassigned';
}

function getCircumplexQuadrantLabel(pleasant: number, eventful: number): string {
  if (pleasant >= 0 && eventful >= 0) {
    return 'Vibrant';
  }
  if (pleasant >= 0 && eventful < 0) {
    return 'Calm';
  }
  if (pleasant < 0 && eventful >= 0) {
    return 'Chaotic';
  }
  return 'Monotonous';
}

function inferDominantScene(photoClassification: ImageClassification[]): string {
  const topEnvironment = photoClassification
    .filter((item) => item.source === 'environment')
    .sort((a, b) => (b.coverage ?? b.confidence) - (a.coverage ?? a.confidence))[0];

  if (topEnvironment) {
    return topEnvironment.label;
  }

  const topObject = photoClassification
    .filter((item) => (item.source ?? 'object') === 'object')
    .sort((a, b) => b.confidence - a.confidence)[0];

  return topObject?.category ?? 'unknown';
}

function parseSourceDominance(value?: string): SourceDominance | null {
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(value) as Partial<SourceDominance>;
    if (
      typeof parsed.biophony === 'number' &&
      typeof parsed.geophony === 'number' &&
      typeof parsed.anthrophony === 'number'
    ) {
      return {
        biophony: parsed.biophony,
        geophony: parsed.geophony,
        anthrophony: parsed.anthrophony,
      };
    }
  } catch {
    return null;
  }

  return null;
}

function parseAcousticMetrics(value?: string): AcousticMetrics | null {
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(value) as Partial<AcousticMetrics>;
    if (typeof parsed.laeq === 'number') {
      return parsed as AcousticMetrics;
    }
  } catch {
    return null;
  }

  return null;
}

function escapeCSV(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }

  return value;
}
