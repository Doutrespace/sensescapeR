/**
 * Questionnaire building blocks.
 *
 * Every questionnaire in the app that is not a bespoke screen (the personal
 * details asked once, and the question sets of the project groups) is plain
 * data built from these types. The app renders the inputs, stores the
 * answers, and derives the export columns and the codebook from the same
 * definition, so a question only ever has to be described in one place.
 *
 * IMPORTANT: `key` values become column names in the exported data. Do not
 * rename a key once data collection has started.
 */
import { getLanguage } from '../i18n';

export interface LocalizedText {
  de: string;
  en: string;
}

/** Text in the active app language (German is the source wording). */
export function tx(text: LocalizedText | null | undefined): string {
  if (!text) {
    return '';
  }
  return getLanguage() === 'de' ? text.de : text.en || text.de;
}

export type AnswerValue = number | string | string[] | boolean;
export type Answers = Record<string, AnswerValue>;

/** `<key>__na` = true: "does not apply" was chosen instead of a value. */
export const NA_SUFFIX = '__na';
/** `<key>__no_answer` = true: "keine Angabe" (prefer not to say) was chosen. */
export const NO_ANSWER_SUFFIX = '__no_answer';
export const NO_ANSWER_LABEL: LocalizedText = { de: 'keine Angabe', en: 'Prefer not to say' };
/** `<key>__other`: free text belonging to the "other" option. */
export const OTHER_SUFFIX = '__other';
export const OTHER_KEY = 'other';

export interface ChoiceOption {
  /** Stable code written to the data for nominal questions. */
  key: string;
  label: LocalizedText;
  /** Numeric code for ordered answer categories; written instead of `key`. */
  value?: number;
  /** Multi-select only: choosing this option clears all others. */
  exclusive?: boolean;
}

interface BaseItem {
  key: string;
  /** Short name, used as heading in the app and in the codebook. */
  label?: LocalizedText;
  /** The question exactly as it is put to the participant. */
  prompt: LocalizedText;
  /** Small helper text under the question. */
  hint?: LocalizedText;
  required?: boolean;
  /** Only shown when another item on the same questionnaire has this answer. */
  showIf?: { key: string; equals: string | number };
}

/** Rating with labelled end points, e.g. 1 (not at all) to 5 (very much). */
export interface ScaleItem extends BaseItem {
  type: 'scale';
  min: number;
  max: number;
  minLabel: LocalizedText;
  maxLabel: LocalizedText;
  /** Extra button such as "no smell noticed"; stored separately, never as a scale value. */
  notApplicable?: LocalizedText;
}

/** One answer out of a list. With `value`s set, the categories are ordered. */
export interface ChoiceItem extends BaseItem {
  type: 'choice';
  options: ChoiceOption[];
  /** Adds an "other" option with a free-text field. */
  other?: LocalizedText;
  notApplicable?: LocalizedText;
  /** Offers "keine Angabe"; stored as `<key>__no_answer`, never as a value. */
  noAnswer?: boolean;
}

/** Any number of answers out of a list. */
export interface MultiItem extends BaseItem {
  type: 'multi';
  options: ChoiceOption[];
  other?: LocalizedText;
}

export interface TextItem extends BaseItem {
  type: 'text';
  multiline?: boolean;
  placeholder?: LocalizedText;
  maxLength?: number;
  numeric?: boolean;
}

export interface NumberItem extends BaseItem {
  type: 'number';
  min: number;
  max: number;
  unit?: LocalizedText;
  placeholder?: LocalizedText;
  maxLength?: number;
  notApplicable?: LocalizedText;
  /** Offers "keine Angabe"; stored as `<key>__no_answer`, never as a value. */
  noAnswer?: boolean;
}

export type PaqAttribute =
  | 'pleasant'
  | 'vibrant'
  | 'eventful'
  | 'chaotic'
  | 'annoying'
  | 'monotonous'
  | 'uneventful'
  | 'calm';

/** Several statements rated on the same scale (e.g. eight sound attributes). */
export interface MatrixItem extends BaseItem {
  type: 'matrix';
  rows: Array<{ key: string; label: LocalizedText }>;
  min: number;
  max: number;
  /** One label per scale point, shown as a legend above the rows. */
  pointLabels: LocalizedText[];
  /**
   * When the rows are the eight ISO/TS 12913-2 attributes: which row is which.
   * The export then adds the ISO/TS 12913-3 pleasantness / eventfulness
   * coordinates calculated from the eight ratings.
   */
  paq?: Record<PaqAttribute, string>;
}

export type StudyItem = ScaleItem | ChoiceItem | MultiItem | TextItem | NumberItem | MatrixItem;

export interface StudySection {
  key: string;
  title: LocalizedText;
  intro?: LocalizedText;
  /**
   * 'person': about the participant, asked once and reused for later
   * measurements. 'run' (default): asked at every measurement.
   */
  scope?: 'run' | 'person';
  items: StudyItem[];
}

export interface StudyGroup {
  /**
   * Stable id; prefix of this group's export columns. Named after the topic:
   * no student names anywhere in the app, the repository or the data.
   */
  id: string;
  topic: LocalizedText;
  /** MaterialCommunityIcons glyph. Groups share the app's accent colour. */
  icon: string;
  sections: StudySection[];
}

// ---------------------------------------------------------------------------
// Answer helpers
// ---------------------------------------------------------------------------

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function nonEmptyText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

export function matrixRowKey(item: MatrixItem, rowKey: string): string {
  return `${item.key}__${rowKey}`;
}

export function isItemVisible(item: StudyItem, answers: Answers): boolean {
  if (!item.showIf) {
    return true;
  }
  return answers[item.showIf.key] === item.showIf.equals;
}

export function visibleItems(items: StudyItem[], answers: Answers): StudyItem[] {
  return items.filter((item) => isItemVisible(item, answers));
}

/** A number typed into a number item that lies inside the allowed range. */
export function isNumberInRange(item: NumberItem, value: unknown): value is number {
  return isFiniteNumber(value) && Number.isInteger(value) && value >= item.min && value <= item.max;
}

/** "keine Angabe" was chosen for an item that offers it. */
export function isNoAnswer(item: StudyItem, answers: Answers): boolean {
  return (item.type === 'number' || item.type === 'choice')
    && !!item.noAnswer
    && answers[item.key + NO_ANSWER_SUFFIX] === true;
}

export function isItemAnswered(item: StudyItem, answers: Answers): boolean {
  const value = answers[item.key];

  switch (item.type) {
    case 'scale':
      return isFiniteNumber(value) || answers[item.key + NA_SUFFIX] === true;
    case 'number':
      return isNumberInRange(item, value)
        || answers[item.key + NA_SUFFIX] === true
        || isNoAnswer(item, answers);
    case 'choice':
      if (answers[item.key + NA_SUFFIX] === true || isNoAnswer(item, answers)) {
        return true;
      }
      if (item.other && value === OTHER_KEY) {
        return nonEmptyText(answers[item.key + OTHER_SUFFIX]);
      }
      return isFiniteNumber(value) || nonEmptyText(value);
    case 'multi':
      return Array.isArray(value) && value.length > 0;
    case 'text':
      return nonEmptyText(value);
    case 'matrix':
      return item.rows.every((row) => isFiniteNumber(answers[matrixRowKey(item, row.key)]));
    default:
      return false;
  }
}

/** True once at least one part of the item has been filled in. */
export function isItemTouched(item: StudyItem, answers: Answers): boolean {
  if (item.type === 'matrix') {
    return item.rows.some((row) => isFiniteNumber(answers[matrixRowKey(item, row.key)]));
  }
  if (item.type === 'choice' && item.other && answers[item.key] === OTHER_KEY) {
    return true;
  }
  return isItemAnswered(item, answers);
}

export function countAnswered(items: StudyItem[], answers: Answers): { answered: number; total: number } {
  const visible = visibleItems(items, answers);
  return {
    answered: visible.filter((item) => isItemAnswered(item, answers)).length,
    total: visible.length,
  };
}

export function missingRequiredItems(items: StudyItem[], answers: Answers): StudyItem[] {
  return visibleItems(items, answers).filter((item) => item.required && !isItemAnswered(item, answers));
}

/** Every answer key an item can write. */
export function itemAnswerKeys(item: StudyItem): string[] {
  switch (item.type) {
    case 'matrix':
      return item.rows.map((row) => matrixRowKey(item, row.key));
    case 'scale':
      return item.notApplicable ? [item.key, item.key + NA_SUFFIX] : [item.key];
    case 'number':
      return [
        item.key,
        ...(item.notApplicable ? [item.key + NA_SUFFIX] : []),
        ...(item.noAnswer ? [item.key + NO_ANSWER_SUFFIX] : []),
      ];
    case 'choice':
      return [
        item.key,
        ...(item.other ? [item.key + OTHER_SUFFIX] : []),
        ...(item.notApplicable ? [item.key + NA_SUFFIX] : []),
        ...(item.noAnswer ? [item.key + NO_ANSWER_SUFFIX] : []),
      ];
    case 'multi':
      return item.other ? [item.key, item.key + OTHER_SUFFIX] : [item.key];
    default:
      return [item.key];
  }
}

/**
 * Answers ready to be stored: only keys that belong to the given items,
 * nothing from questions that are currently hidden, no empty text, and no
 * out-of-range numbers.
 */
export function sanitizeAnswers(items: StudyItem[], answers: Answers): Answers {
  const result: Answers = {};

  for (const item of items) {
    if (!isItemVisible(item, answers)) {
      continue;
    }

    for (const key of itemAnswerKeys(item)) {
      const value = answers[key];

      if (typeof value === 'string') {
        const trimmed = value.trim();
        if (trimmed.length > 0) {
          result[key] = trimmed;
        }
      } else if (Array.isArray(value)) {
        if (value.length > 0) {
          result[key] = [...value];
        }
      } else if (value === true) {
        result[key] = true;
      } else if (isFiniteNumber(value)) {
        if (item.type !== 'number' || isNumberInRange(item, value)) {
          result[key] = value;
        }
      }
    }

    // Free text of an "other" option only counts while that option is chosen.
    if (item.type === 'choice' && result[item.key] !== OTHER_KEY) {
      delete result[item.key + OTHER_SUFFIX];
    }
    if (item.type === 'multi') {
      const selected = result[item.key];
      if (!Array.isArray(selected) || !selected.includes(OTHER_KEY)) {
        delete result[item.key + OTHER_SUFFIX];
      }
    }
    // "keine Angabe" stands instead of every other answer to the item.
    if (isNoAnswer(item, result)) {
      delete result[item.key];
      delete result[item.key + NA_SUFFIX];
      delete result[item.key + OTHER_SUFFIX];
    }
  }

  return result;
}

export function allItems(sections: StudySection[]): StudyItem[] {
  return sections.flatMap((section) => section.items);
}

/** A change to some answers; `undefined` removes the answer. */
export type AnswerPatch = Record<string, AnswerValue | undefined>;

/**
 * A change, or a function that derives the change from the latest answers.
 * The function form is for inputs whose new value depends on the old one
 * (multiple choice): two taps in quick succession must both count.
 */
export type AnswerPatchInput = AnswerPatch | ((answers: Answers) => AnswerPatch);

export function applyAnswerPatch(answers: Answers, input: AnswerPatchInput): Answers {
  const patch = typeof input === 'function' ? input(answers) : input;
  const next: Answers = { ...answers };
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) {
      delete next[key];
    } else {
      next[key] = value;
    }
  }
  return next;
}

/**
 * Visible questions with fixed answer options that are still unanswered.
 * Free-text questions are left out: an empty text field is a valid answer.
 */
export function openClosedItems(items: StudyItem[], answers: Answers): StudyItem[] {
  return visibleItems(items, answers).filter(
    (item) => item.type !== 'text' && !isItemAnswered(item, answers)
  );
}

/** Only the answers that belong to the given items. */
export function pickAnswers(items: StudyItem[], answers: Answers): Answers {
  const keys = new Set(items.flatMap((item) => itemAnswerKeys(item)));
  const result: Answers = {};
  for (const [key, value] of Object.entries(answers)) {
    if (keys.has(key)) {
      result[key] = value;
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// ISO/TS 12913-3 coordinates from eight attribute ratings
// ---------------------------------------------------------------------------

const COS_45 = Math.cos(Math.PI / 4);

/**
 * Pleasantness and eventfulness (-1..1) from eight ratings on a 1-5 scale,
 * following ISO/TS 12913-3. Null unless all eight attributes were rated.
 */
export function isoCoordinatesFromRatings(
  ratings: Partial<Record<PaqAttribute, number>>,
  scaleMin = 1,
  scaleMax = 5
): { pleasant: number; eventful: number } | null {
  const attributes: PaqAttribute[] = [
    'pleasant', 'vibrant', 'eventful', 'chaotic', 'annoying', 'monotonous', 'uneventful', 'calm',
  ];
  if (!attributes.every((attribute) => isFiniteNumber(ratings[attribute]))) {
    return null;
  }

  const r = ratings as Record<PaqAttribute, number>;
  // Largest possible value of the projections, so the result spans -1..1.
  const range = scaleMax - scaleMin;
  const scale = range + 2 * COS_45 * range;

  const pleasant = (
    (r.pleasant - r.annoying)
    + COS_45 * (r.calm - r.chaotic)
    + COS_45 * (r.vibrant - r.monotonous)
  ) / scale;
  const eventful = (
    (r.eventful - r.uneventful)
    + COS_45 * (r.chaotic - r.calm)
    + COS_45 * (r.vibrant - r.monotonous)
  ) / scale;

  const round4 = (value: number) => Math.round(value * 10000) / 10000;
  return { pleasant: round4(pleasant), eventful: round4(eventful) };
}

export function matrixIsoCoordinates(
  item: MatrixItem,
  answers: Answers
): { pleasant: number; eventful: number } | null {
  if (!item.paq) {
    return null;
  }

  const ratings: Partial<Record<PaqAttribute, number>> = {};
  for (const [attribute, rowKey] of Object.entries(item.paq) as Array<[PaqAttribute, string]>) {
    const value = answers[matrixRowKey(item, rowKey)];
    if (isFiniteNumber(value)) {
      ratings[attribute] = value;
    }
  }

  return isoCoordinatesFromRatings(ratings, item.min, item.max);
}

// ---------------------------------------------------------------------------
// Export columns
// ---------------------------------------------------------------------------

export type ExportCell = string | number | null;

/** Column names (without group prefix) an item contributes to the export. */
export function itemExportColumns(item: StudyItem): string[] {
  if (item.type === 'matrix') {
    return [
      ...item.rows.map((row) => matrixRowKey(item, row.key)),
      ...(item.paq ? [`${item.key}__iso_pleasant`, `${item.key}__iso_eventful`] : []),
    ];
  }
  return itemAnswerKeys(item);
}

export function itemExportValues(item: StudyItem, answers: Answers): Record<string, ExportCell> {
  const cells: Record<string, ExportCell> = {};

  for (const key of itemAnswerKeys(item)) {
    const value = answers[key];
    if (Array.isArray(value)) {
      cells[key] = value.length > 0 ? value.join('|') : null;
    } else if (value === true) {
      cells[key] = 1;
    } else if (isFiniteNumber(value)) {
      cells[key] = value;
    } else if (nonEmptyText(value)) {
      cells[key] = value.trim();
    } else {
      cells[key] = null;
    }
  }

  if (item.type === 'matrix' && item.paq) {
    const iso = matrixIsoCoordinates(item, answers);
    cells[`${item.key}__iso_pleasant`] = iso ? iso.pleasant : null;
    cells[`${item.key}__iso_eventful`] = iso ? iso.eventful : null;
  }

  return cells;
}

// ---------------------------------------------------------------------------
// Codebook
// ---------------------------------------------------------------------------

export interface CodebookEntry {
  column: string;
  question: string;
  type: string;
  values: string;
}

function describeOptions(options: ChoiceOption[], other?: LocalizedText): string {
  const parts = options.map((option) => `${option.value ?? option.key} = ${option.label.de}`);
  if (other) {
    parts.push(`${OTHER_KEY} = ${other.de}`);
  }
  return parts.join('; ');
}

/** Describes every export column of an item (German wording, as asked). */
export function itemCodebook(item: StudyItem, columnPrefix = ''): CodebookEntry[] {
  const column = (name: string) => `${columnPrefix}${name}`;
  const question = item.prompt.de;
  const entries: CodebookEntry[] = [];

  switch (item.type) {
    case 'scale':
      entries.push({
        column: column(item.key),
        question,
        type: 'scale',
        values: `${item.min} = ${item.minLabel.de} ... ${item.max} = ${item.maxLabel.de}`,
      });
      break;
    case 'number':
      entries.push({
        column: column(item.key),
        question,
        type: 'number',
        values: `${item.min}-${item.max}${item.unit ? ` ${item.unit.de}` : ''}`,
      });
      break;
    case 'choice':
      entries.push({
        column: column(item.key),
        question,
        type: item.options.some((option) => typeof option.value === 'number') ? 'ordered choice' : 'single choice',
        values: describeOptions(item.options, item.other),
      });
      break;
    case 'multi':
      entries.push({
        column: column(item.key),
        question,
        type: 'multiple choice',
        values: `Codes separated by "|": ${describeOptions(item.options, item.other)}`,
      });
      break;
    case 'text':
      entries.push({ column: column(item.key), question, type: 'free text', values: '' });
      break;
    case 'matrix':
      for (const row of item.rows) {
        entries.push({
          column: column(matrixRowKey(item, row.key)),
          question: `${question} [${row.label.de}]`,
          type: 'scale',
          values: item.pointLabels.map((label, index) => `${item.min + index} = ${label.de}`).join('; '),
        });
      }
      if (item.paq) {
        entries.push({
          column: column(`${item.key}__iso_pleasant`),
          question: `${question} [calculated]`,
          type: 'calculated',
          values: 'ISO/TS 12913-3 pleasantness, -1 to 1; empty unless all eight attributes were rated',
        });
        entries.push({
          column: column(`${item.key}__iso_eventful`),
          question: `${question} [calculated]`,
          type: 'calculated',
          values: 'ISO/TS 12913-3 eventfulness, -1 to 1; empty unless all eight attributes were rated',
        });
      }
      break;
  }

  if ((item.type === 'choice' || item.type === 'multi') && item.other) {
    entries.push({
      column: column(item.key + OTHER_SUFFIX),
      question: `${question} [${item.other.de}]`,
      type: 'free text',
      values: '',
    });
  }

  if ((item.type === 'scale' || item.type === 'number' || item.type === 'choice') && item.notApplicable) {
    entries.push({
      column: column(item.key + NA_SUFFIX),
      question: `${question} [${item.notApplicable.de}]`,
      type: 'flag',
      values: '1 = chosen instead of a value; otherwise empty',
    });
  }

  if ((item.type === 'number' || item.type === 'choice') && item.noAnswer) {
    entries.push({
      column: column(item.key + NO_ANSWER_SUFFIX),
      question: `${question} [${NO_ANSWER_LABEL.de}]`,
      type: 'flag',
      values: '1 = "keine Angabe" chosen instead of an answer; otherwise empty',
    });
  }

  return entries;
}
