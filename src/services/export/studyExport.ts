/**
 * The study data table: one row per measurement, one column per variable.
 *
 * Every export has the same columns in the same order, whichever project
 * group a measurement belongs to, so the files of all students can simply be
 * stacked (see scripts/merge-exports.mjs). The column list, the values and
 * the codebook are generated from the same definitions.
 */
import { RecordingWithPerception } from '../../types/recording';
import type { AcousticMetrics } from '../audio/acousticMetrics';
import { getCircumplexQuadrantLabel, getRatedPaq } from '../database/perceptions';
import {
  ENVIRONMENT_ITEMS,
  MULTISENSORY_EXPORT_COLUMNS,
  RESTORATIVENESS_ITEMS,
  SMELL_SOURCES,
  THERMAL_ITEMS,
  VISUAL_ITEMS,
  parseMultisensory,
  toMultisensoryExportRow,
  type MultisensoryExportRow,
  type ScaleItem as MultisensoryScaleItem,
} from '../../types/multisensory';
import { PERSON_ITEMS, VISIT_MODE_ITEM, SITE_CODE_ITEM } from '../../study/core';
import { STUDY_GROUPS, groupColumnPrefix } from '../../study/groups';
import { parseRunStudyData, type RunStudyData } from '../../study/runData';
import {
  NA_SUFFIX,
  NO_ANSWER_LABEL,
  NO_ANSWER_SUFFIX,
  allItems,
  itemCodebook,
  itemExportColumns,
  itemExportValues,
  type Answers,
  type CodebookEntry,
  type ExportCell,
  type StudyItem,
} from '../../study/types';
import { getIncludedDetectedSounds, parseDetectedSounds } from '../../utils/detectedSounds';
import { getIncludedImageClassifications } from '../../utils/imageClassification';
import { assessVisualContext } from '../../utils/visualContext';
import { toParticipantCode } from '../../utils/ids';

/** Participant of this device, used for measurements saved before IDs existed. */
export interface ParticipantFallback {
  participantId: string;
  personAnswers: Answers;
}

export type StudyRow = Record<string, ExportCell>;

interface RowContext {
  recording: RecordingWithPerception;
  study: RunStudyData | null;
  participantId: string | null;
  person: Answers;
  metrics: AcousticMetrics | null;
  multisensory: MultisensoryExportRow;
  setting: { indoor?: boolean; outdoor?: boolean; alone?: boolean; inGroup?: boolean } | null;
}

interface ColumnSpec {
  column: string;
  /** What the column holds; for questions, the wording put to the participant. */
  question: string;
  type: string;
  values: string;
  get: (context: RowContext) => ExportCell | boolean | undefined;
}

function flag(value: boolean | null | undefined): number | null {
  return typeof value === 'boolean' ? (value ? 1 : 0) : null;
}

function numberOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/** A measured value with a fixed number of decimals (no floating-point noise). */
function rounded(value: unknown, decimals: number): number | null {
  const number = numberOrNull(value);
  if (number === null) {
    return null;
  }
  const factor = 10 ** decimals;
  return Math.round(number * factor) / factor;
}

function textOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function parseJson<T>(value: string | null | undefined): T | null {
  if (!value) {
    return null;
  }
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

/** Wall-clock time at the place of recording, e.g. "2026-11-24 14:05:09". */
export function toLocalTimestamp(isoTime: string, timezone?: string | null): string | null {
  const date = new Date(isoTime);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  try {
    // The Swedish locale writes dates as YYYY-MM-DD HH:mm:ss.
    return new Intl.DateTimeFormat('sv-SE', {
      timeZone: timezone || undefined,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).format(date).replace(',', '');
  } catch {
    return null;
  }
}

function captureFlag(context: RowContext, key: string): number | null {
  const value = context.study?.capture?.[key];
  return typeof value === 'boolean' ? (value ? 1 : 0) : null;
}

function camelToSnake(value: string): string {
  return value.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

function describeScale(item: MultisensoryScaleItem): string {
  return `${item.min} = ${item.minLabel} ... ${item.max} = ${item.maxLabel}`;
}

const MULTISENSORY_DOCS: Record<string, { question: string; type: string; values: string }> = {
  smell_pleasantness: {
    question: 'Smell: pleasantness (horizontal position on the smell pad)',
    type: 'scale',
    values: '-1 = unpleasant ... 1 = pleasant',
  },
  smell_intensity: {
    question: 'Smell: intensity (vertical position on the smell pad)',
    type: 'scale',
    values: '0 = weak ... 1 = strong',
  },
  smell_sources: {
    question: 'What can you smell?',
    type: 'multiple choice',
    values: `Codes separated by "|": ${SMELL_SOURCES.map((source) => `${source.key} = ${source.label}`).join('; ')}`,
  },
  emotion_valence: {
    question: 'Affect grid: pleasure (horizontal position)',
    type: 'scale',
    values: '1 = unpleasant ... 9 = pleasant',
  },
  emotion_arousal: {
    question: 'Affect grid: arousal (vertical position)',
    type: 'scale',
    values: '1 = sleepiness ... 9 = high arousal',
  },
  emotion_dominance: {
    question: 'How much do you feel in control of the situation?',
    type: 'scale',
    values: '1 = controlled ... 9 = in control',
  },
};

for (const [prefix, items] of [
  ['visual_', VISUAL_ITEMS],
  ['thermal_', THERMAL_ITEMS],
  ['restor_', RESTORATIVENESS_ITEMS],
  ['psd_', ENVIRONMENT_ITEMS],
] as Array<[string, MultisensoryScaleItem[]]>) {
  for (const item of items) {
    MULTISENSORY_DOCS[`${prefix}${camelToSnake(item.key)}`] = {
      question: `${item.label}: ${item.prompt}`,
      type: 'scale',
      values: describeScale(item),
    };
  }
}

const PAQ_ATTRIBUTES = [
  'pleasant', 'vibrant', 'eventful', 'chaotic', 'annoying', 'monotonous', 'uneventful', 'calm',
] as const;

const [BIRTH_YEAR_ITEM, GENDER_ITEM, YEARS_ITEM] = PERSON_ITEMS;

/** 1 when "keine Angabe" was chosen for a Teil 1 question. */
function noAnswerColumn(item: StudyItem): ColumnSpec {
  const key = item.key + NO_ANSWER_SUFFIX;
  return {
    column: key,
    question: `${item.prompt.de} [${NO_ANSWER_LABEL.de}]`,
    type: 'flag',
    values: '1 = "keine Angabe"; otherwise empty',
    get: ({ person }) => (person[key] === true ? 1 : null),
  };
}

const BASE_COLUMNS: ColumnSpec[] = [
  // --- Identification ---
  {
    column: 'run_id',
    question: 'Unique ID of the measurement',
    type: 'id',
    values: 'UUID',
    get: ({ recording }) => recording.id,
  },
  {
    column: 'run_number',
    question: 'Number of the measurement on the device it was made with (1, 2, 3, ...)',
    type: 'number',
    values: '',
    get: ({ study }) => study?.runNumber ?? null,
  },
  {
    column: 'participant_id',
    question: 'ID of the person who answered (random, no name). The same person on the same device always has the same ID.',
    type: 'id',
    values: 'UUID',
    get: ({ participantId }) => participantId,
  },
  {
    column: 'participant_code',
    question: 'Short form of participant_id, as shown in the app',
    type: 'id',
    values: 'P-XXXXXX',
    get: ({ participantId }) => (participantId ? toParticipantCode(participantId) : null),
  },
  {
    column: 'respondent',
    question: 'Wer hat die Fragen dieser Messung beantwortet?',
    type: 'single choice',
    values: 'self = the person using the device; other = another person who was interviewed',
    get: ({ study }) => study?.respondent ?? null,
  },
  {
    column: 'collector_id',
    question: 'ID of the device / student who collected the measurement (equals participant_id unless respondent = other)',
    type: 'id',
    values: 'UUID',
    get: ({ study, recording }) => study?.collectorId ?? recording.participantId ?? null,
  },
  {
    column: 'group_id',
    question: 'Project group whose questions were answered after the main questionnaire',
    type: 'single choice',
    values: STUDY_GROUPS
      .map((group) => `${group.id} = ${group.topic.de}`)
      .join('; '),
    get: ({ study, recording }) => study?.groupId ?? recording.groupId ?? null,
  },
  {
    column: 'main_questionnaire_skipped',
    question: 'Shortcut taken: from the notes straight to the project group, so perception, senses and context were not shown',
    type: 'flag',
    values: '1 = skipped (iso_*, senses and context columns are then usually empty); 0 = shown',
    get: ({ study }) => (study ? flag(study.mainQuestionnaireSkipped) : null),
  },
  {
    column: 'site_code',
    question: SITE_CODE_ITEM.prompt.de,
    type: 'free text',
    values: '',
    get: ({ study }) => study?.siteCode ?? null,
  },

  // --- Time ---
  {
    column: 'recorded_at',
    question: 'Start of the sound recording',
    type: 'timestamp',
    values: 'ISO 8601, UTC',
    get: ({ recording }) => recording.recordedAt,
  },
  {
    column: 'recorded_at_local',
    question: 'Start of the sound recording in local time (see timezone)',
    type: 'timestamp',
    values: 'YYYY-MM-DD HH:MM:SS',
    get: ({ recording }) => toLocalTimestamp(recording.recordedAt, recording.timezone),
  },
  {
    column: 'timezone',
    question: 'Time zone of the device',
    type: 'text',
    values: 'IANA name, e.g. Europe/Berlin',
    get: ({ recording }) => recording.timezone ?? null,
  },
  {
    column: 'saved_at',
    question: 'Time the questionnaire was completed and the measurement saved',
    type: 'timestamp',
    values: 'ISO 8601, UTC',
    get: ({ study, recording }) => study?.savedAt || recording.createdAt || null,
  },

  // --- Teil 1: person ---
  {
    column: 'birth_year',
    question: BIRTH_YEAR_ITEM.prompt.de,
    type: 'number',
    values: 'JJJJ; empty = keine Angabe (see birth_year__no_answer)',
    get: ({ person }) => numberOrNull(person.birth_year),
  },
  noAnswerColumn(BIRTH_YEAR_ITEM),
  {
    column: 'age',
    question: 'Age in years at the time of the measurement (year of recording minus year of birth)',
    type: 'calculated',
    values: 'empty when the year of birth was not given',
    get: ({ person, recording }) => {
      const birthYear = numberOrNull(person.birth_year);
      const year = new Date(recording.recordedAt).getFullYear();
      return birthYear !== null && Number.isFinite(year) ? year - birthYear : null;
    },
  },
  {
    column: 'gender',
    question: GENDER_ITEM.prompt.de,
    type: 'single choice',
    values: `${GENDER_ITEM.type === 'choice'
      ? GENDER_ITEM.options.map((option) => `${option.key} = ${option.label.de}`).join('; ')
      : ''}; empty = keine Angabe (see gender__no_answer)`,
    get: ({ person }) => textOrNull(person.gender),
  },
  noAnswerColumn(GENDER_ITEM),
  {
    column: 'years_in_wuerzburg',
    question: YEARS_ITEM.prompt.de,
    type: 'number',
    values: 'Jahre; empty when the person does not live in Würzburg or chose keine Angabe',
    get: ({ person }) => numberOrNull(person.years_in_wuerzburg),
  },
  noAnswerColumn(YEARS_ITEM),
  {
    column: 'lives_in_wuerzburg',
    question: `${YEARS_ITEM.prompt.de} [wohne nicht in Würzburg]`,
    type: 'calculated',
    values: '1 = lives in Würzburg (years given); 0 = "wohne nicht in Würzburg"; empty = keine Angabe or not answered',
    get: ({ person }) => {
      if (person[`years_in_wuerzburg${NA_SUFFIX}`] === true) {
        return 0;
      }
      return numberOrNull(person.years_in_wuerzburg) !== null ? 1 : null;
    },
  },

  // --- Visit ---
  {
    column: 'visit_mode',
    question: VISIT_MODE_ITEM.prompt.de,
    type: 'single choice',
    values: VISIT_MODE_ITEM.options.map((option) => `${option.key} = ${option.label.de}`).join('; '),
    get: ({ study }) => study?.visitMode ?? null,
  },

  // --- Location ---
  {
    column: 'latitude',
    question: 'Latitude of the measurement (WGS 84)',
    type: 'number',
    values: 'decimal degrees; empty when no position was stored',
    get: ({ recording }) => recording.latitude,
  },
  {
    column: 'longitude',
    question: 'Longitude of the measurement (WGS 84)',
    type: 'number',
    values: 'decimal degrees; empty when no position was stored',
    get: ({ recording }) => recording.longitude,
  },
  {
    column: 'gps_accuracy',
    question: 'Accuracy of the position reported by the device',
    type: 'number',
    values: 'metres (radius)',
    get: ({ recording }) => rounded(recording.gpsAccuracy, 1),
  },
  {
    column: 'privacy_mode',
    question: 'How the position was stored',
    type: 'single choice',
    values: 'exact = as measured; fuzzed = rounded to about 500 m; hidden = not stored',
    get: ({ recording }) => recording.privacyMode,
  },

  // --- Context ---
  {
    column: 'habitat_type',
    question: 'Type of place chosen by the participant',
    type: 'single choice',
    values: 'urban_park; residential; commercial; industrial; forest; water_body; rural; transport_hub; mixed_use; other',
    get: ({ recording }) => recording.habitatType ?? null,
  },
  {
    column: 'setting_location',
    question: 'Indoor or outdoor',
    type: 'single choice',
    values: 'indoor; outdoor; empty = not stated',
    get: ({ setting }) => (setting?.indoor ? 'indoor' : setting?.outdoor ? 'outdoor' : null),
  },
  {
    column: 'setting_social',
    question: 'Alone or with others during the measurement',
    type: 'single choice',
    values: 'alone; with_others; empty = not stated',
    get: ({ setting }) => (setting?.alone ? 'alone' : setting?.inGroup ? 'with_others' : null),
  },

  // --- Soundscape (ISO/TS 12913) ---
  {
    column: 'iso_pleasant',
    question: 'Soundscape pleasantness: horizontal position chosen on the circumplex pad',
    type: 'scale',
    values: '-1 = annoying ... 1 = pleasant',
    get: ({ recording }) => rounded(recording.perception?.isoPleasant, 4),
  },
  {
    column: 'iso_eventful',
    question: 'Soundscape eventfulness: vertical position chosen on the circumplex pad',
    type: 'scale',
    values: '-1 = uneventful ... 1 = eventful',
    get: ({ recording }) => rounded(recording.perception?.isoEventful, 4),
  },
  {
    column: 'iso_quadrant',
    question: 'Quadrant of the circumplex the chosen position lies in',
    type: 'calculated',
    values: 'Vibrant; Calm; Chaotic; Monotonous',
    get: ({ recording }) => {
      const pleasant = numberOrNull(recording.perception?.isoPleasant);
      const eventful = numberOrNull(recording.perception?.isoEventful);
      return pleasant !== null && eventful !== null ? getCircumplexQuadrantLabel(pleasant, eventful) : null;
    },
  },
  ...PAQ_ATTRIBUTES.map((attribute): ColumnSpec => ({
    column: `paq_${attribute}`,
    question: `ISO/TS 12913-2 attribute rating "${attribute}" (only when the eight attributes were rated; never derived from the pad)`,
    type: 'scale',
    values: '1 = strongly disagree ... 5 = strongly agree',
    get: ({ recording }) => getRatedPaq(recording.perception)?.[attribute] ?? null,
  })),

  // --- Multisensory ratings ---
  ...MULTISENSORY_EXPORT_COLUMNS.map((column): ColumnSpec => ({
    column,
    question: MULTISENSORY_DOCS[column]?.question ?? column,
    type: MULTISENSORY_DOCS[column]?.type ?? 'scale',
    values: MULTISENSORY_DOCS[column]?.values ?? '',
    get: ({ multisensory }) => multisensory[column],
  })),

  // --- Acoustics ---
  ...([
    ['laeq', 'laeq', 'A-weighted equivalent continuous level over the recording'],
    ['laf_max', 'lafMax', 'Maximum A-weighted level, time weighting Fast'],
    ['laf10', 'laf10', 'A-weighted level exceeded for 10 % of the time'],
    ['laf50', 'laf50', 'A-weighted level exceeded for 50 % of the time'],
    ['laf90', 'laf90', 'A-weighted level exceeded for 90 % of the time (background)'],
    ['laf95', 'laf95', 'A-weighted level exceeded for 95 % of the time'],
    ['lzeq', 'lzeq', 'Unweighted equivalent continuous level over the recording'],
  ] as Array<[string, keyof AcousticMetrics, string]>).map(([column, key, question]): ColumnSpec => ({
    column,
    question,
    type: 'number',
    values: 'dB; see level_reference (dBFS is relative to digital full scale and NOT a sound pressure level)',
    get: ({ metrics }) => numberOrNull(metrics?.[key]),
  })),
  {
    column: 'level_reference',
    question: 'Reference of the level columns',
    type: 'text',
    values: 'dBFS = uncalibrated, comparable only within one device; dB SPL = calibrated',
    get: ({ metrics }) => metrics?.reference ?? null,
  },
  {
    column: 'acoustic_calibrated',
    question: 'Whether a calibration offset was applied to the levels',
    type: 'flag',
    values: '1 = yes; 0 = no',
    get: ({ metrics }) => (metrics ? flag(metrics.calibrated) : null),
  },
  {
    column: 'calibration_offset_db',
    question: 'Calibration offset applied',
    type: 'number',
    values: 'dB',
    get: ({ metrics }) => numberOrNull(metrics?.calibrationOffsetDb),
  },
  {
    column: 'peak_db',
    question: 'Highest sample peak of the recording',
    type: 'number',
    values: 'dBFS',
    get: ({ recording }) => rounded(recording.peakDb, 2),
  },
  {
    column: 'rms_db',
    question: 'Mean signal level of the recording (unweighted RMS)',
    type: 'number',
    values: 'dBFS',
    get: ({ recording }) => rounded(recording.rmsDb, 2),
  },
  {
    column: 'has_clipping',
    question: 'Quality flag: the signal reached digital full scale (levels are then underestimated)',
    type: 'flag',
    values: '1 = yes; 0 = no',
    get: ({ recording }) => flag(recording.hasClipping),
  },
  {
    column: 'has_wind_noise',
    question: 'Quality flag: wind or handling noise at the microphone was detected',
    type: 'flag',
    values: '1 = yes; 0 = no',
    get: ({ recording }) => flag(recording.hasWindHandling),
  },
  {
    column: 'has_low_level',
    question: 'Quality flag: the input level was very low',
    type: 'flag',
    values: '1 = yes; 0 = no',
    get: ({ recording }) => flag(recording.hasLowSNR),
  },

  {
    column: 'recording_interrupted',
    question: 'Quality flag: the app went to the background during the recording (screen lock, app switch); the take may have a gap',
    type: 'flag',
    values: '1 = yes; 0 = no; empty = unknown',
    get: (context) => captureFlag(context, 'interrupted'),
  },
  {
    column: 'audio_dropout_ms',
    question: 'Audio the browser failed to deliver during the recording (0 = complete)',
    type: 'number',
    values: 'milliseconds; empty = unknown',
    get: ({ study }) => numberOrNull(study?.capture?.dropoutMs),
  },
  {
    column: 'audio_gain_applied',
    question: 'Whether the stored sound file was amplified for listening. The level columns are always measured before that.',
    type: 'flag',
    values: '1 = yes; 0 = no',
    get: ({ recording }) => flag(recording.normalizationApplied ?? false),
  },
  {
    column: 'audio_gain',
    question: 'Factor by which the stored sound file was amplified (divide the file by it to get the recorded signal)',
    type: 'number',
    values: 'linear factor; empty when no gain was applied',
    get: ({ recording }) => (recording.normalizationApplied ? rounded(recording.normalizationGain, 4) : null),
  },

  // --- Recording ---
  {
    column: 'duration_ms',
    question: 'Length of the sound recording',
    type: 'number',
    values: 'milliseconds',
    get: ({ recording }) => rounded(recording.durationMs, 0),
  },
  {
    column: 'sample_rate',
    question: 'Sample rate of the stored recording',
    type: 'number',
    values: 'Hz',
    get: ({ recording }) => recording.sampleRate,
  },
  {
    column: 'bit_depth',
    question: 'Bit depth of the stored recording',
    type: 'number',
    values: 'bit',
    get: ({ recording }) => recording.bitDepth,
  },
  {
    column: 'device_model',
    question: 'Device model as reported by the device',
    type: 'text',
    values: '',
    get: ({ recording }) => textOrNull(recording.deviceModel),
  },
  {
    column: 'os_version',
    question: 'Operating system of the device',
    type: 'text',
    values: '',
    get: ({ recording }) => textOrNull(recording.osVersion),
  },
  {
    column: 'microphone_label',
    question: 'Microphone used, as named by the browser (shows e.g. a headset)',
    type: 'text',
    values: '',
    get: ({ study }) => textOrNull(study?.capture?.microphoneLabel),
  },
  {
    column: 'mic_echo_cancellation',
    question: 'Whether the browser applied echo cancellation to the microphone (requested: off)',
    type: 'flag',
    values: '1 = on; 0 = off; empty = unknown',
    get: (context) => captureFlag(context, 'echoCancellation'),
  },
  {
    column: 'mic_noise_suppression',
    question: 'Whether the browser applied noise suppression to the microphone (requested: off)',
    type: 'flag',
    values: '1 = on; 0 = off; empty = unknown',
    get: (context) => captureFlag(context, 'noiseSuppression'),
  },
  {
    column: 'mic_auto_gain',
    question: 'Whether the browser applied automatic gain control to the microphone (requested: off)',
    type: 'flag',
    values: '1 = on; 0 = off; empty = unknown',
    get: (context) => captureFlag(context, 'autoGainControl'),
  },

  // --- Content ---
  {
    column: 'detected_sound_labels',
    question: 'Sound classes detected in the recording by the YAMNet classifier, with confidence',
    type: 'text',
    values: 'e.g. "Speech (81%), Bird (40%)"',
    get: ({ recording }) => {
      const sounds = getIncludedDetectedSounds(parseDetectedSounds(recording.detectedSounds))
        .filter((sound) => typeof sound.score === 'number');
      return sounds.length > 0
        ? sounds.map((sound) => `${sound.label} (${Math.round((sound.score as number) * 100)}%)`).join(', ')
        : null;
    },
  },
  {
    column: 'photo_taken',
    question: 'Whether a photo of the place was taken',
    type: 'flag',
    values: '1 = yes; 0 = no',
    get: ({ recording }) => (recording.photoUri ? 1 : 0),
  },
  {
    column: 'photo_labels',
    question: 'What the image classifier found in the photo',
    type: 'text',
    values: '',
    get: ({ recording }) => {
      const labels = getIncludedImageClassifications(recording.photoClassification ?? []);
      return labels.length > 0 ? labels.map((item) => item.label).join(', ') : null;
    },
  },
  {
    column: 'visual_context',
    question: 'Dominant visual context derived from the photo',
    type: 'calculated',
    values: '',
    get: ({ recording }) => {
      const labels = getIncludedImageClassifications(recording.photoClassification ?? []);
      return labels.length > 0 ? assessVisualContext(labels).dominantContext : null;
    },
  },
  {
    column: 'field_notes',
    question: 'Written notes about the place',
    type: 'free text',
    values: '',
    get: ({ recording }) => textOrNull(recording.fieldNotes),
  },
  {
    column: 'spoken_description',
    question: 'Spoken description, transcribed',
    type: 'free text',
    values: '',
    get: ({ recording }) => textOrNull(recording.spokenDescription),
  },

  // --- Administration ---
  {
    column: 'questionnaire_version',
    question: 'Version of the question wording shown (see src/study/core.ts)',
    type: 'text',
    values: 'date of the version',
    get: ({ study }) => textOrNull(study?.questionnaireVersion),
  },
  {
    column: 'consent_version',
    question: 'Version of the consent text the person agreed to',
    type: 'text',
    values: 'date of the version; empty = no consent recorded',
    get: ({ study }) => study?.consentVersion ?? null,
  },
  {
    column: 'app_version',
    question: 'Version of the app',
    type: 'text',
    values: '',
    get: ({ study }) => textOrNull(study?.appVersion),
  },
  {
    column: 'app_language',
    question: 'Language the questions were shown in',
    type: 'single choice',
    values: 'de; en',
    get: ({ study }) => textOrNull(study?.appLanguage),
  },
  {
    column: 'platform',
    question: 'How the app was run',
    type: 'single choice',
    values: 'web = in the browser; android; ios',
    get: ({ study }) => textOrNull(study?.platform),
  },
  {
    column: 'user_agent',
    question: 'Browser identification (browser and system version)',
    type: 'text',
    values: '',
    get: ({ study }) => study?.userAgent ?? null,
  },
];

interface GroupColumn {
  column: string;
  get: (answers: Answers) => ExportCell;
}

const GROUP_COLUMNS: Array<{ groupId: string; columns: GroupColumn[] }> = STUDY_GROUPS.map((group) => {
  const prefix = groupColumnPrefix(group);
  const columns: GroupColumn[] = [];

  for (const item of allItems(group.sections)) {
    for (const name of itemExportColumns(item)) {
      columns.push({
        column: `${prefix}${name}`,
        get: (answers) => itemExportValues(item, answers)[name] ?? null,
      });
    }
  }

  return { groupId: group.id, columns };
});

/** All columns of the study table, in export order. */
export const STUDY_COLUMNS: string[] = [
  ...BASE_COLUMNS.map((spec) => spec.column),
  ...GROUP_COLUMNS.flatMap((group) => group.columns.map((column) => column.column)),
];

function buildContext(
  recording: RecordingWithPerception,
  fallback?: ParticipantFallback | null
): RowContext {
  const study = parseRunStudyData(recording.studyData);
  // Measurements from before participant IDs existed were made on this
  // device by its participant, so they get that person's ID and details.
  const participantId = study?.respondentId ?? recording.participantId ?? fallback?.participantId ?? null;
  const person = study ? study.person : fallback?.personAnswers ?? {};
  const metrics = parseJson<AcousticMetrics>(recording.acousticMetrics);

  return {
    recording,
    study,
    participantId,
    person,
    metrics: metrics && typeof metrics.laeq === 'number' ? metrics : null,
    multisensory: toMultisensoryExportRow(parseMultisensory(recording.multisensory)),
    setting: parseJson(recording.settingChips),
  };
}

/** One measurement as a flat record: column name -> value (null = empty). */
export function buildStudyRow(
  recording: RecordingWithPerception,
  fallback?: ParticipantFallback | null
): StudyRow {
  const context = buildContext(recording, fallback);
  const row: StudyRow = {};

  for (const spec of BASE_COLUMNS) {
    const value = spec.get(context);
    row[spec.column] = typeof value === 'boolean' ? (value ? 1 : 0) : value ?? null;
  }

  const groupId = context.study?.groupId ?? null;
  const groupAnswers = context.study?.groupAnswers ?? {};
  for (const group of GROUP_COLUMNS) {
    for (const column of group.columns) {
      // Only the columns of the group that was answered are filled.
      row[column.column] = group.groupId === groupId ? column.get(groupAnswers) : null;
    }
  }

  return row;
}

/**
 * A cell that would start a formula in a spreadsheet program gets a leading
 * apostrophe, so free text typed by participants can never run as a formula.
 */
function neutraliseFormula(value: string): string {
  return /^[=+\-@\t\r]/.test(value) && !/^[+-]?\d+([.,]\d+)?$/.test(value) ? `'${value}` : value;
}

export function toCsvCell(value: ExportCell | undefined): string {
  if (value === null || value === undefined) {
    return '';
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(value) : '';
  }

  const text = neutraliseFormula(value);
  return /[",\r\n]/.test(text) || /^\s|\s$/.test(text)
    ? `"${text.replace(/"/g, '""')}"`
    : text;
}

/** Byte order mark: lets Excel read the file as UTF-8 (umlauts). */
export const CSV_BOM = '﻿';

export function toCsv(columns: string[], rows: StudyRow[]): string {
  const lines = [
    columns.map((column) => toCsvCell(column)).join(','),
    ...rows.map((row) => columns.map((column) => toCsvCell(row[column])).join(',')),
  ];
  return `${CSV_BOM}${lines.join('\r\n')}\r\n`;
}

/** The study table as CSV; a header-only file when there are no measurements. */
export function formatAsStudyCSV(
  recordings: RecordingWithPerception[],
  fallback?: ParticipantFallback | null
): string {
  return toCsv(STUDY_COLUMNS, recordings.map((recording) => buildStudyRow(recording, fallback)));
}

/** Describes every column of the study table. */
export function buildCodebook(): CodebookEntry[] {
  const entries: CodebookEntry[] = BASE_COLUMNS.map((spec) => ({
    column: spec.column,
    question: spec.question,
    type: spec.type,
    values: spec.values,
  }));

  for (const group of STUDY_GROUPS) {
    const prefix = groupColumnPrefix(group);
    for (const item of allItems(group.sections)) {
      entries.push(...itemCodebook(item, prefix));
    }
  }

  return entries;
}

export function formatCodebookCSV(): string {
  const groupOf = (column: string): string => {
    const group = STUDY_GROUPS.find((entry) => column.startsWith(groupColumnPrefix(entry)));
    return group ? group.topic.de : 'Hauptfragebogen / App';
  };

  const rows: StudyRow[] = buildCodebook().map((entry) => ({
    column: entry.column,
    block: groupOf(entry.column),
    question: entry.question,
    type: entry.type,
    values: entry.values,
  }));

  return toCsv(['column', 'block', 'question', 'type', 'values'], rows);
}
