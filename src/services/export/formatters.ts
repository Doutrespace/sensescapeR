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
  getIsoAxisPercent, getRatedPaq } from '../database/perceptions';
import {
  getIncludedDetectedSounds,
  parseDetectedSounds as parseStoredDetectedSounds,
} from '../../utils/detectedSounds';
import { buildStudyRow, formatAsStudyCSV, type ParticipantFallback } from './studyExport';

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
  const ratedPaq = getRatedPaq(recording.perception);

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
    // Rated PAQ only; scores derived from the circumplex point are left out.
    paqPleasant: ratedPaq?.pleasant ?? null,
    paqVibrant: ratedPaq?.vibrant ?? null,
    paqEventful: ratedPaq?.eventful ?? null,
    paqChaotic: ratedPaq?.chaotic ?? null,
    paqAnnoying: ratedPaq?.annoying ?? null,
    paqMonotonous: ratedPaq?.monotonous ?? null,
    paqUneventful: ratedPaq?.uneventful ?? null,
    paqCalm: ratedPaq?.calm ?? null,

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
  researchProfile: ResearchProfile = {},
  participant?: ParticipantFallback | null
): string {
  const data = recordings.map((recording) => ({
    ...formatRecordingForExport(recording, researchProfile),
    // The same variables as in the CSV table (IDs, person, group answers).
    study: buildStudyRow(recording, participant),
  }));
  return JSON.stringify({
    exportDate: new Date().toISOString(),
    version: '2.0',
    count: data.length,
    recordings: data,
  }, null, 2);
}

export function formatAsGeoJSON(
  recordings: RecordingWithPerception[],
  participant?: ParticipantFallback | null
): string {
  const features = recordings.map((recording) => {
    // Flat attributes, identical to the columns of the CSV table.
    const data = buildStudyRow(recording, participant);
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

/**
 * The study data table (one row per measurement). Same columns for every
 * export; see studyExport.ts.
 */
export function formatAsCSV(
  recordings: RecordingWithPerception[],
  participant?: ParticipantFallback | null
): string {
  return formatAsStudyCSV(recordings, participant);
}

export function formatRecordingSummary(recording: RecordingWithPerception): string {
  const lines = [
    `Sensescape measurement - ${new Date(recording.recordedAt).toLocaleString()}`,
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
    const summaryPaq = getRatedPaq(recording.perception);
    lines.push(
      '--- Perception Assessment ---',
      `ISO Pleasantness: ${getIsoAxisLabel(recording.perception.isoPleasant, 'Pleasant', 'Annoying')} ${getIsoAxisPercent(recording.perception.isoPleasant)}%`,
      `ISO Eventfulness: ${getIsoAxisLabel(recording.perception.isoEventful, 'Eventful', 'Uneventful')} ${getIsoAxisPercent(recording.perception.isoEventful)}%`,
      `Quadrant: ${getCircumplexQuadrantLabel(recording.perception.isoPleasant, recording.perception.isoEventful)}`,
      ...(summaryPaq
        ? [`PAQ (rated): pleasant ${summaryPaq.pleasant}, vibrant ${summaryPaq.vibrant}, eventful ${summaryPaq.eventful}, chaotic ${summaryPaq.chaotic}, annoying ${summaryPaq.annoying}, monotonous ${summaryPaq.monotonous}, uneventful ${summaryPaq.uneventful}, calm ${summaryPaq.calm}`]
        : []),
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
    'Recorded with Sensescape Explorer',
    'Soundscape assessment based on ISO 12913',
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
