/**
 * Study metadata stored with every saved measurement ("run"): who answered,
 * which questionnaire version they saw, and the answers that do not have a
 * column of their own in the local database (visit mode, measuring point,
 * the questions of the project group).
 *
 * It is kept as one JSON document per measurement (column `study_data`), so
 * a measurement stays complete and self-describing even when the personal
 * details on the device are changed later.
 */
import type { VisitMode } from './core';
import type { Answers } from './types';

export const RUN_DATA_SCHEMA = 1;

export type RespondentType = 'self' | 'other';

export interface RunStudyData {
  schema: number;
  /** Participant ID of this device (the person collecting the data). */
  collectorId: string;
  /** Who answered: the device owner, or another person who was interviewed. */
  respondent: RespondentType;
  /** ID of the person who answered; equals collectorId for 'self'. */
  respondentId: string;
  /** Teil 1 answers of the person who answered, as they were at that time. */
  person: Answers;
  consentVersion: string | null;
  consentAt: string | null;
  visitMode: VisitMode | null;
  /** Free label of the measuring point, e.g. "M1". */
  siteCode: string | null;
  groupId: string | null;
  /** Answers to the questions of the project group (personal ones included). */
  groupAnswers: Answers;
  /** Sequential number of the measurement on this device. */
  runNumber: number | null;
  questionnaireVersion: string;
  appVersion: string;
  appLanguage: string;
  platform: string;
  userAgent: string | null;
  /** When the questionnaire was saved (the recording time is `recordedAt`). */
  savedAt: string;
  /** Microphone processing actually applied by the browser, if known. */
  capture: Record<string, string | number | boolean | null> | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

export function serializeRunStudyData(data: RunStudyData): string {
  return JSON.stringify(data);
}

/** Null when nothing usable is stored (e.g. measurements from older versions). */
export function parseRunStudyData(value: string | null | undefined): RunStudyData | null {
  if (!value) {
    return null;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    return null;
  }

  if (!isRecord(parsed)) {
    return null;
  }

  const collectorId = asString(parsed.collectorId);
  if (!collectorId) {
    return null;
  }

  const respondent: RespondentType = parsed.respondent === 'other' ? 'other' : 'self';
  const visitMode = parsed.visitMode === 'passing' || parsed.visitMode === 'staying'
    ? parsed.visitMode
    : null;

  return {
    schema: typeof parsed.schema === 'number' ? parsed.schema : RUN_DATA_SCHEMA,
    collectorId,
    respondent,
    respondentId: asString(parsed.respondentId) ?? collectorId,
    person: isRecord(parsed.person) ? (parsed.person as Answers) : {},
    consentVersion: asString(parsed.consentVersion),
    consentAt: asString(parsed.consentAt),
    visitMode,
    siteCode: asString(parsed.siteCode),
    groupId: asString(parsed.groupId),
    groupAnswers: isRecord(parsed.groupAnswers) ? (parsed.groupAnswers as Answers) : {},
    runNumber: typeof parsed.runNumber === 'number' ? parsed.runNumber : null,
    questionnaireVersion: asString(parsed.questionnaireVersion) ?? '',
    appVersion: asString(parsed.appVersion) ?? '',
    appLanguage: asString(parsed.appLanguage) ?? '',
    platform: asString(parsed.platform) ?? '',
    userAgent: asString(parsed.userAgent),
    savedAt: asString(parsed.savedAt) ?? '',
    capture: isRecord(parsed.capture)
      ? (parsed.capture as Record<string, string | number | boolean | null>)
      : null,
  };
}
