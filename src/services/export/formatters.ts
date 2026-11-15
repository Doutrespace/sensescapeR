import { RecordingWithPerception } from '../../types/recording';
import type { AcousticMetrics } from '../audio/acousticMetrics';
import { getProtocolLabel } from '../../constants/protocols';
import { getHabitatLabel } from '../../constants/habitats';
import {
  getIncludedImageClassifications,
  type ImageClassification,
} from '../../utils/imageClassification';
import { extractNoteThemes, type NoteTheme } from '../../utils/noteAnalysis';
import type { ResearchProfile } from '../../types/researchProfile';
import {
  MULTISENSORY_EXPORT_COLUMNS,
  parseMultisensory,
  toMultisensoryExportRow,
  type MultisensoryExportRow,
} from '../../types/multisensory';
import {
  assessVisualContext,
  formatVisualIndicatorSummary,
  type VisualContextAssessment,
} from '../../utils/visualContext';
import {
  getCircumplexQuadrantLabel,
  getIsoAxisLabel,
  getIsoAxisPercent,
} from '../database/perceptions';
import {
  getIncludedDetectedSounds,
  parseDetectedSounds as parseStoredDetectedSounds,
} from '../../utils/detectedSounds';

// Multisensory ratings are exported as flat columns (visual_*, smell_*,
// thermal_*, restor_*, emotion_*, psd_*); see types/multisensory.
export interface RecordingExportData extends MultisensoryExportRow {
  id: string;
  recordedAt: string;
  timezone: string;

  // Location
  latitude: number | null;
  longitude: number | null;
  gpsAccuracy: number | null;
  privacyMode: string;
  communityVisibility: string;
  participantAgeRange: string | null;
  participantGender: string | null;
  participantOccupation: string | null;
  participantLivingArea: string | null;
  participantProfileJson: string;

  // Recording metadata
  protocolType: string;
  durationMs: number;
  sampleRate: number;
  bitDepth: number;

  // Context
  habitatType: string | null;
  photoUri: string | null;
  photoClassification: string;
  photoClassificationCount: number;
  photoClassificationLabels: string;
  visualContextDominant: string;
  visualContextSummary: string;
  visualContextJson: string;
  fieldNotes: string | null;
  spokenDescription: string | null;
  noteKeywords: string;
  noteThemesJson: string;
  settingChips: string;
  sourceDominance: string;
  detectedSounds: string;
  detectedSoundCount: number;
  detectedSoundLabels: string;

  // Quality
  hasClipping: boolean;
  hasWindHandling: boolean;
  hasLowSNR: boolean;
  peakDb: number | null;
  rmsDb: number | null;
  normalizationApplied: boolean;
  normalizationGain: number | null;

  // Perception
  isoPleasant: number | null;
  isoEventful: number | null;
  isoPleasantDirection: string | null;
  isoEventfulDirection: string | null;
  isoPleasantPercent: number | null;
  isoEventfulPercent: number | null;
  isoQuadrant: string | null;
  paqPleasant: number | null;
  paqVibrant: number | null;
  paqEventful: number | null;
  paqChaotic: number | null;
  paqAnnoying: number | null;
  paqMonotonous: number | null;
  paqUneventful: number | null;
  paqCalm: number | null;

  // Sync
  syncStatus: string;
  remoteId: string | null;

  // Device
  deviceModel: string;
  osVersion: string;
  micRoute: string;

  // IEC-weighted acoustics (dBFS unless calibrated; see levelReference)
  laeq: number | null;
  lafMax: number | null;
  laf10: number | null;
  laf50: number | null;
  laf90: number | null;
  laf95: number | null;
  lzeq: number | null;
  levelReference: string | null;
  acousticCalibrated: boolean | null;
  calibrationOffsetDb: number | null;
}

function parseAcousticMetrics(value?: string): AcousticMetrics | null {
  if (!value) {
    return null;
  }
  try {
    const parsed = JSON.parse(value) as Partial<AcousticMetrics>;
    return typeof parsed.laeq === 'number' ? (parsed as AcousticMetrics) : null;
  } catch {
    return null;
  }
}

export function formatRecordingForExport(
  recording: RecordingWithPerception,
  researchProfile: ResearchProfile = {}
): RecordingExportData {
  const photoClassification = getIncludedImageClassifications(recording.photoClassification ?? []);
  const detectedSounds = parseDetectedSounds(recording.detectedSounds);
  const isoPleasant = recording.perception?.isoPleasant ?? null;
  const isoEventful = recording.perception?.isoEventful ?? null;
  const visualContext = assessVisualContext(photoClassification);
  const noteThemes = extractNoteThemes(recording.fieldNotes, recording.spokenDescription);
  const metrics = parseAcousticMetrics(recording.acousticMetrics);

  return {
    id: recording.id,
    recordedAt: recording.recordedAt,
    timezone: recording.timezone,

    latitude: recording.latitude,
    longitude: recording.longitude,
    gpsAccuracy: recording.gpsAccuracy,
    privacyMode: recording.privacyMode,
    communityVisibility: recording.communityVisibility,
    participantAgeRange: researchProfile.ageRange ?? null,
    participantGender: researchProfile.gender ?? null,
    participantOccupation: researchProfile.occupation ?? null,
    participantLivingArea: researchProfile.livingArea ?? null,
    participantProfileJson: JSON.stringify(researchProfile),

    protocolType: recording.protocolType,
    durationMs: recording.durationMs,
    sampleRate: recording.sampleRate,
    bitDepth: recording.bitDepth,

    habitatType: recording.habitatType || null,
    photoUri: recording.photoUri || null,
    photoClassification: JSON.stringify(photoClassification),
    photoClassificationCount: photoClassification.length,
    photoClassificationLabels: formatImageClassificationLabels(photoClassification),
    visualContextDominant: visualContext.dominantContext,
    visualContextSummary: formatVisualIndicatorSummary(visualContext),
    visualContextJson: JSON.stringify(visualContext),
    fieldNotes: recording.fieldNotes || null,
    spokenDescription: recording.spokenDescription || null,
    noteKeywords: noteThemes.map((theme) => theme.label).join(', '),
    noteThemesJson: JSON.stringify(noteThemes),
    settingChips: recording.settingChips ?? '',
    sourceDominance: recording.sourceDominance ?? '',
    detectedSounds: JSON.stringify(detectedSounds),
    detectedSoundCount: detectedSounds.length,
    detectedSoundLabels: formatDetectedSoundLabels(detectedSounds),

    hasClipping: recording.hasClipping,
    hasWindHandling: recording.hasWindHandling,
    hasLowSNR: recording.hasLowSNR,
    peakDb: recording.peakDb ?? null,
    rmsDb: recording.rmsDb ?? null,
    normalizationApplied: recording.normalizationApplied ?? false,
    normalizationGain: recording.normalizationGain ?? null,

    isoPleasant,
    isoEventful,
    isoPleasantDirection: typeof isoPleasant === 'number'
      ? getIsoAxisLabel(isoPleasant, 'Pleasant', 'Annoying')
      : null,
    isoEventfulDirection: typeof isoEventful === 'number'
      ? getIsoAxisLabel(isoEventful, 'Eventful', 'Uneventful')
      : null,
    isoPleasantPercent: typeof isoPleasant === 'number'
      ? getIsoAxisPercent(isoPleasant)
      : null,
    isoEventfulPercent: typeof isoEventful === 'number'
      ? getIsoAxisPercent(isoEventful)
      : null,
    isoQuadrant: typeof isoPleasant === 'number' && typeof isoEventful === 'number'
      ? getCircumplexQuadrantLabel(isoPleasant, isoEventful)
      : null,
    paqPleasant: recording.perception?.paqPleasant ?? null,
    paqVibrant: recording.perception?.paqVibrant ?? null,
    paqEventful: recording.perception?.paqEventful ?? null,
    paqChaotic: recording.perception?.paqChaotic ?? null,
    paqAnnoying: recording.perception?.paqAnnoying ?? null,
    paqMonotonous: recording.perception?.paqMonotonous ?? null,
    paqUneventful: recording.perception?.paqUneventful ?? null,
    paqCalm: recording.perception?.paqCalm ?? null,

    syncStatus: recording.syncStatus,
    remoteId: recording.remoteId || null,

    deviceModel: recording.deviceModel,
    osVersion: recording.osVersion,
    micRoute: recording.micRoute,

    laeq: metrics?.laeq ?? null,
    lafMax: metrics?.lafMax ?? null,
    laf10: metrics?.laf10 ?? null,
    laf50: metrics?.laf50 ?? null,
    laf90: metrics?.laf90 ?? null,
    laf95: metrics?.laf95 ?? null,
    lzeq: metrics?.lzeq ?? null,
    levelReference: metrics?.reference ?? null,
    acousticCalibrated: metrics ? metrics.calibrated : null,
    calibrationOffsetDb: metrics?.calibrationOffsetDb ?? null,

    ...toMultisensoryExportRow(parseMultisensory(recording.multisensory)),
  };
}

export function formatAsJSON(
  recordings: RecordingWithPerception[],
  researchProfile: ResearchProfile = {}
): string {
  const data = recordings.map((recording) => formatRecordingForExport(recording, researchProfile));
  return JSON.stringify({
    exportDate: new Date().toISOString(),
    version: '1.0',
    count: data.length,
    recordings: data,
  }, null, 2);
}

export function formatAsGeoJSON(
  recordings: RecordingWithPerception[],
  researchProfile: ResearchProfile = {}
): string {
  const features = recordings.map((recording) => {
    const data = formatRecordingForExport(recording, researchProfile);
    const hasCoordinates =
      typeof data.latitude === 'number' &&
      typeof data.longitude === 'number';

    return {
      type: 'Feature',
      geometry: hasCoordinates
        ? {
            type: 'Point',
            coordinates: [data.longitude, data.latitude],
          }
        : null,
      properties: {
        ...data,
      },
    };
  });

  return JSON.stringify({
    type: 'FeatureCollection',
    exportDate: new Date().toISOString(),
    count: features.length,
    features,
  }, null, 2);
}

export function formatAsCSV(
  recordings: RecordingWithPerception[],
  researchProfile: ResearchProfile = {}
): string {
  if (recordings.length === 0) return '';

  const headers = [
    'id',
    'recorded_at',
    'timezone',
    'latitude',
    'longitude',
    'gps_accuracy',
    'privacy_mode',
    'community_visibility',
    'participant_age_range',
    'participant_gender',
    'participant_occupation',
    'participant_living_area',
    'participant_profile_json',
    'protocol_type',
    'duration_ms',
    'sample_rate',
    'bit_depth',
    'habitat_type',
    'photo_uri',
    'photo_classification',
    'photo_classification_count',
    'photo_classification_labels',
    'visual_context_dominant',
    'visual_context_summary',
    'visual_context_json',
    'field_notes',
    'spoken_description',
    'note_keywords',
    'note_themes_json',
    'setting_chips',
    'source_dominance',
    'detected_sounds',
    'detected_sound_count',
    'detected_sound_labels',
    'has_clipping',
    'has_wind_handling',
    'has_low_snr',
    'peak_db',
    'rms_db',
    'normalization_applied',
    'normalization_gain',
    'iso_pleasant',
    'iso_eventful',
    'iso_pleasant_direction',
    'iso_eventful_direction',
    'iso_pleasant_percent',
    'iso_eventful_percent',
    'iso_quadrant',
    'paq_pleasant',
    'paq_vibrant',
    'paq_eventful',
    'paq_chaotic',
    'paq_annoying',
    'paq_monotonous',
    'paq_uneventful',
    'paq_calm',
    'sync_status',
    'remote_id',
    'device_model',
    'os_version',
    'mic_route',
    'laeq',
    'laf_max',
    'laf10',
    'laf50',
    'laf90',
    'laf95',
    'lzeq',
    'level_reference',
    'acoustic_calibrated',
    'calibration_offset_db',
    ...MULTISENSORY_EXPORT_COLUMNS,
  ];

  const rows = recordings.map(recording => {
    const data = formatRecordingForExport(recording, researchProfile);
    return [
      data.id,
      data.recordedAt,
      data.timezone,
      data.latitude,
      data.longitude,
      data.gpsAccuracy,
      data.privacyMode,
      data.communityVisibility,
      escapeCSV(data.participantAgeRange ?? ''),
      escapeCSV(data.participantGender ?? ''),
      escapeCSV(data.participantOccupation ?? ''),
      escapeCSV(data.participantLivingArea ?? ''),
      escapeCSV(data.participantProfileJson),
      data.protocolType,
      data.durationMs,
      data.sampleRate,
      data.bitDepth,
      data.habitatType ?? '',
      escapeCSV(data.photoUri ?? ''),
      escapeCSV(data.photoClassification),
      data.photoClassificationCount,
      escapeCSV(data.photoClassificationLabels),
      escapeCSV(data.visualContextDominant),
      escapeCSV(data.visualContextSummary),
      escapeCSV(data.visualContextJson),
      escapeCSV(data.fieldNotes ?? ''),
      escapeCSV(data.spokenDescription ?? ''),
      escapeCSV(data.noteKeywords),
      escapeCSV(data.noteThemesJson),
      escapeCSV(data.settingChips),
      escapeCSV(data.sourceDominance),
      escapeCSV(data.detectedSounds),
      data.detectedSoundCount,
      escapeCSV(data.detectedSoundLabels),
      data.hasClipping,
      data.hasWindHandling,
      data.hasLowSNR,
      data.peakDb ?? '',
      data.rmsDb ?? '',
      data.normalizationApplied,
      data.normalizationGain ?? '',
      data.isoPleasant ?? '',
      data.isoEventful ?? '',
      data.isoPleasantDirection ?? '',
      data.isoEventfulDirection ?? '',
      data.isoPleasantPercent ?? '',
      data.isoEventfulPercent ?? '',
      data.isoQuadrant ?? '',
      data.paqPleasant ?? '',
      data.paqVibrant ?? '',
      data.paqEventful ?? '',
      data.paqChaotic ?? '',
      data.paqAnnoying ?? '',
      data.paqMonotonous ?? '',
      data.paqUneventful ?? '',
      data.paqCalm ?? '',
      data.syncStatus,
      data.remoteId ?? '',
      escapeCSV(data.deviceModel),
      escapeCSV(data.osVersion),
      escapeCSV(data.micRoute),
      data.laeq ?? '',
      data.lafMax ?? '',
      data.laf10 ?? '',
      data.laf50 ?? '',
      data.laf90 ?? '',
      data.laf95 ?? '',
      data.lzeq ?? '',
      data.levelReference ?? '',
      data.acousticCalibrated ?? '',
      data.calibrationOffsetDb ?? '',
      ...MULTISENSORY_EXPORT_COLUMNS.map((column) => {
        const value = data[column];
        return typeof value === 'string' ? escapeCSV(value) : value ?? '';
      }),
    ].join(',');
  });

  return [headers.join(','), ...rows].join('\n');
}

function escapeCSV(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function formatRecordingSummary(recording: RecordingWithPerception): string {
  const lines = [
    `Soundscape Recording - ${new Date(recording.recordedAt).toLocaleString()}`,
    '',
    '--- Recording Info ---',
    `Protocol: ${getProtocolLabel(recording.protocolType)}`,
    `Duration: ${Math.round(recording.durationMs / 1000)}s`,
    `Sample Rate: ${recording.sampleRate / 1000} kHz`,
    `Bit Depth: ${recording.bitDepth}-bit`,
    '',
    '--- Location ---',
    `Coordinates: ${formatCoordinates(recording.latitude, recording.longitude)}`,
    `Accuracy: ${formatAccuracy(recording.gpsAccuracy)}`,
    recording.habitatType ? `Habitat: ${getHabitatLabel(recording.habitatType)}` : '',
    `Detected Objects: ${formatImageClassificationLabels(recording.photoClassification ?? [], 'none')}`,
    `Visual Context: ${assessVisualContext(recording.photoClassification ?? []).dominantContext}`,
    `Visual Indicators: ${formatVisualIndicatorSummary(assessVisualContext(recording.photoClassification ?? []))}`,
    `Detected Sounds: ${formatDetectedSoundLabels(parseDetectedSounds(recording.detectedSounds), 'none')}`,
    `Field Notes: ${recording.fieldNotes?.trim() || 'none'}`,
    `Spoken Description: ${recording.spokenDescription?.trim() || 'none'}`,
    `Note Themes: ${extractNoteThemes(recording.fieldNotes, recording.spokenDescription).map((theme) => theme.label).join(', ') || 'none'}`,
    `Playback Normalization: ${recording.normalizationApplied ? `applied (${(recording.normalizationGain ?? 1).toFixed(2)}x)` : 'not applied'}`,
    '',
  ];

  if (recording.perception) {
    lines.push(
      '--- Perception Assessment ---',
      `ISO Pleasantness: ${getIsoAxisLabel(recording.perception.isoPleasant, 'Pleasant', 'Annoying')} ${getIsoAxisPercent(recording.perception.isoPleasant)}%`,
      `ISO Eventfulness: ${getIsoAxisLabel(recording.perception.isoEventful, 'Eventful', 'Uneventful')} ${getIsoAxisPercent(recording.perception.isoEventful)}%`,
      `Quadrant: ${getCircumplexQuadrantLabel(recording.perception.isoPleasant, recording.perception.isoEventful)}`,
      `PAQ: pleasant ${recording.perception.paqPleasant ?? '-'}, vibrant ${recording.perception.paqVibrant ?? '-'}, eventful ${recording.perception.paqEventful ?? '-'}, chaotic ${recording.perception.paqChaotic ?? '-'}, annoying ${recording.perception.paqAnnoying ?? '-'}, monotonous ${recording.perception.paqMonotonous ?? '-'}, uneventful ${recording.perception.paqUneventful ?? '-'}, calm ${recording.perception.paqCalm ?? '-'}`,
      ''
    );
  }

  const multisensoryRow = toMultisensoryExportRow(parseMultisensory(recording.multisensory));
  const multisensoryLines = MULTISENSORY_EXPORT_COLUMNS
    .filter((column) => multisensoryRow[column] !== null)
    .map((column) => `${column}: ${multisensoryRow[column]}`);
  if (multisensoryLines.length > 0) {
    lines.push('--- Multisensory Assessment ---', ...multisensoryLines, '');
  }

  if (recording.hasClipping || recording.hasWindHandling || recording.hasLowSNR) {
    lines.push('--- Quality Warnings ---');
    if (recording.hasClipping) lines.push('- Audio clipping detected');
    if (recording.hasWindHandling) lines.push('- Wind noise detected');
    if (recording.hasLowSNR) lines.push('- Low signal-to-noise ratio');
    lines.push('');
  }

  lines.push(
    '--- Device ---',
    `Model: ${recording.deviceModel}`,
    `OS: ${recording.osVersion}`,
    `Microphone: ${recording.micRoute}`,
    '',
    '---',
    'Recorded with Soundscape Explorer',
    'ISO 12913 Compliant Recording',
  );

  return lines.filter(Boolean).join('\n');
}

interface ExportDetectedSound {
  label: string;
  score: number;
}

export function serializeVisualContext(assessment: VisualContextAssessment): string {
  return JSON.stringify(assessment);
}

export function serializeNoteThemes(themes: NoteTheme[]): string {
  return JSON.stringify(themes);
}

function parseDetectedSounds(value?: string | null): ExportDetectedSound[] {
  return getIncludedDetectedSounds(parseStoredDetectedSounds(value)).flatMap((item) => (
    typeof item.score === 'number'
      ? [{ label: item.label, score: item.score }]
      : []
  ));
}

function formatImageClassificationLabels(
  classifications: ImageClassification[],
  emptyValue: string = ''
): string {
  if (classifications.length === 0) {
    return emptyValue;
  }

  return classifications
    .map((item) => {
      const metric = item.source === 'environment'
        ? (item.coverage ?? item.confidence)
        : item.confidence;
      const prefix = item.source === 'environment' ? 'context' : 'object';
      return `${prefix}:${item.label} (${Math.round(metric * 100)}%)`;
    })
    .join(', ');
}

function formatDetectedSoundLabels(
  classifications: ExportDetectedSound[],
  emptyValue: string = ''
): string {
  if (classifications.length === 0) {
    return emptyValue;
  }

  return classifications
    .map((item) => `${item.label} (${Math.round(item.score * 100)}%)`)
    .join(', ');
}

function formatCoordinates(latitude: number | null, longitude: number | null): string {
  if (typeof latitude !== 'number' || typeof longitude !== 'number') {
    return 'not stored';
  }

  return `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
}

function formatAccuracy(gpsAccuracy: number | null): string {
  if (typeof gpsAccuracy !== 'number') {
    return 'not stored';
  }

  return `${gpsAccuracy.toFixed(0)}m`;
}
