/**
 * Multisensory assessment collected after the ISO 12913 soundscape rating.
 *
 * Each module follows an established framework and is optional; a module the
 * participant did not answer is simply absent, so "not rated" is never
 * confused with a midpoint rating.
 *
 *   visual           Kaplan & Kaplan preference matrix, 1-5
 *   smell            pleasantness (-1..1) x intensity (0..1) + smell sources
 *   thermal          sensation, comfort and preference scales built on the
 *                    ISO 10551 principles (the standard gives construction
 *                    rules and examples, not one fixed scale)
 *   restorativeness  one statement per Attention Restoration Theory
 *                    component, rated 0-6 as in the Perceived
 *                    Restorativeness Scale (Hartig et al., 1997). These are
 *                    single paraphrased items, not the validated PRS.
 *   emotion          Affect Grid (Russell, Weiss & Mendelsohn, 1989):
 *                    pleasure x arousal on a 9 x 9 grid; plus the dominance
 *                    dimension of the Self-Assessment Manikin (Bradley &
 *                    Lang, 1994), 1-9. No manikin pictograms are shown.
 *   environment      Perceived Sensory Dimensions (PSD), 1-5
 */

import { TopicColors, type TopicColor } from '../theme/colors';

export type VisualKey = 'coherence' | 'complexity' | 'legibility' | 'mystery';
export type ThermalKey = 'sensation' | 'comfort' | 'preference';
export type RestorativenessKey = 'beingAway' | 'fascination' | 'extent' | 'compatibility';
export type EnvironmentKey =
  | 'serene'
  | 'nature'
  | 'richInSpecies'
  | 'space'
  | 'prospect'
  | 'refuge'
  | 'social'
  | 'culture';

export interface SmellAssessment {
  /** -1 (very unpleasant) to 1 (very pleasant) */
  pleasantness?: number;
  /** 0 (barely noticeable) to 1 (very strong) */
  intensity?: number;
  /** Keys from SMELL_SOURCES */
  sources?: string[];
}

export interface EmotionAssessment {
  /** Affect Grid pleasure, 1 (unpleasant feelings) to 9 (pleasant feelings) */
  valence?: number;
  /** Affect Grid arousal, 1 (sleepiness) to 9 (high arousal) */
  arousal?: number;
  /** SAM dominance, 1 (controlled) to 9 (in control); optional */
  dominance?: number;
}

export interface MultisensoryAssessment {
  visual?: Partial<Record<VisualKey, number>>;
  smell?: SmellAssessment;
  thermal?: Partial<Record<ThermalKey, number>>;
  restorativeness?: Partial<Record<RestorativenessKey, number>>;
  emotion?: EmotionAssessment;
  environment?: Partial<Record<EnvironmentKey, number>>;
}

export type MultisensoryModuleKey = keyof MultisensoryAssessment;

export interface ScaleItem<K extends string = string> {
  key: K;
  label: string;
  /** MaterialCommunityIcons glyph shown next to the label. */
  icon: string;
  /** Statement or question the participant rates. */
  prompt: string;
  min: number;
  max: number;
  minLabel: string;
  maxLabel: string;
  /** Verbal anchors for individual scale points (ISO 10551 wording). */
  valueLabels?: Record<number, string>;
  /** Scale runs through a neutral zero; drawn from the centre outwards. */
  bipolar?: boolean;
  /** One colour per scale point, for scales where colour carries meaning. */
  stepColors?: string[];
}

const KAPLAN_SCALE = { min: 1, max: 5 } as const;

export const VISUAL_ITEMS: ScaleItem<VisualKey>[] = [
  {
    key: 'coherence',
    icon: 'puzzle-outline',
    label: 'Coherence',
    prompt: 'The scene hangs together and is easy to take in at a glance.',
    minLabel: 'Disordered',
    maxLabel: 'Well ordered',
    ...KAPLAN_SCALE,
  },
  {
    key: 'complexity',
    icon: 'shape-outline',
    label: 'Complexity',
    prompt: 'There is a lot to look at; the scene is varied and rich in detail.',
    minLabel: 'Plain',
    maxLabel: 'Rich',
    ...KAPLAN_SCALE,
  },
  {
    key: 'legibility',
    icon: 'compass-outline',
    label: 'Legibility',
    prompt: 'I could easily find my way around here and back again.',
    minLabel: 'Confusing',
    maxLabel: 'Easy to read',
    ...KAPLAN_SCALE,
  },
  {
    key: 'mystery',
    icon: 'door-open',
    label: 'Mystery',
    prompt: 'The scene promises more to discover if I went further in.',
    minLabel: 'Nothing hidden',
    maxLabel: 'Invites exploring',
    ...KAPLAN_SCALE,
  },
];

/** Cold-to-hot ramp for the 7-point thermal scales (index 0 = -3), muted. */
export const THERMAL_RAMP = ['#4F6F86', '#7D97A8', '#ABBCC6', '#C4BEB3', '#D2AE8E', '#BC8763', '#A35F48'];
/** Comfortable-to-uncomfortable ramp for the 5-point comfort scale, muted. */
export const COMFORT_RAMP = ['#5E8068', '#97A07A', '#C6A66C', '#BC8763', '#A35F48'];

/** Each section has its own cool pastel topic colour (see theme/colors). */
function sectionColors({ color, soft }: TopicColor) {
  return { color, softColor: soft };
}

export const THERMAL_ITEMS: ScaleItem<ThermalKey>[] = [
  {
    key: 'sensation',
    icon: 'thermometer',
    label: 'Thermal sensation',
    prompt: 'How do you feel right now?',
    min: -3,
    max: 3,
    minLabel: 'Cold',
    maxLabel: 'Hot',
    bipolar: true,
    stepColors: THERMAL_RAMP,
    valueLabels: {
      [-3]: 'Cold',
      [-2]: 'Cool',
      [-1]: 'Slightly cool',
      0: 'Neutral',
      1: 'Slightly warm',
      2: 'Warm',
      3: 'Hot',
    },
  },
  {
    key: 'comfort',
    icon: 'sofa-outline',
    label: 'Thermal comfort',
    prompt: 'Do you find this…?',
    min: 0,
    max: 4,
    minLabel: 'Comfortable',
    maxLabel: 'Extremely uncomfortable',
    stepColors: COMFORT_RAMP,
    valueLabels: {
      0: 'Comfortable',
      1: 'Slightly uncomfortable',
      2: 'Uncomfortable',
      3: 'Very uncomfortable',
      4: 'Extremely uncomfortable',
    },
  },
  {
    key: 'preference',
    icon: 'tune-variant',
    label: 'Thermal preference',
    prompt: 'How would you prefer to be right now?',
    min: -3,
    max: 3,
    minLabel: 'Much cooler',
    maxLabel: 'Much warmer',
    bipolar: true,
    stepColors: THERMAL_RAMP,
    valueLabels: {
      [-3]: 'Much cooler',
      [-2]: 'Cooler',
      [-1]: 'Slightly cooler',
      0: 'No change',
      1: 'Slightly warmer',
      2: 'Warmer',
      3: 'Much warmer',
    },
  },
];

const PRS_SCALE = { min: 0, max: 6, minLabel: 'Not at all', maxLabel: 'Completely' } as const;

export const RESTORATIVENESS_ITEMS: ScaleItem<RestorativenessKey>[] = [
  {
    key: 'beingAway',
    icon: 'island',
    label: 'Being away',
    prompt: 'Being here is an escape from my everyday demands.',
    ...PRS_SCALE,
  },
  {
    key: 'fascination',
    icon: 'creation',
    label: 'Fascination',
    prompt: 'This place holds my attention without effort.',
    ...PRS_SCALE,
  },
  {
    key: 'extent',
    icon: 'earth',
    label: 'Extent',
    prompt: 'This place feels like a world of its own with plenty to explore.',
    ...PRS_SCALE,
  },
  {
    key: 'compatibility',
    icon: 'handshake-outline',
    label: 'Compatibility',
    prompt: 'I can do the things I like here; the place suits me.',
    ...PRS_SCALE,
  },
];

const PSD_SCALE = { min: 1, max: 5, minLabel: 'Not at all', maxLabel: 'Very much' } as const;

export const ENVIRONMENT_ITEMS: ScaleItem<EnvironmentKey>[] = [
  { key: 'serene', icon: 'feather', label: 'Serene', prompt: 'Quiet, calm and undisturbed.', ...PSD_SCALE },
  { key: 'nature', icon: 'leaf', label: 'Nature', prompt: 'Wild and untouched, shaped by nature itself.', ...PSD_SCALE },
  { key: 'richInSpecies', icon: 'butterfly-outline', label: 'Rich in species', prompt: 'Many different plants and animals.', ...PSD_SCALE },
  { key: 'space', icon: 'arrow-expand-all', label: 'Space', prompt: 'Spacious and connected, like entering another world.', ...PSD_SCALE },
  { key: 'prospect', icon: 'binoculars', label: 'Prospect', prompt: 'Open, with wide views over the surroundings.', ...PSD_SCALE },
  { key: 'refuge', icon: 'tent', label: 'Refuge', prompt: 'Enclosed and safe; a sheltered place to retreat to.', ...PSD_SCALE },
  { key: 'social', icon: 'account-group-outline', label: 'Social', prompt: 'A place for meeting people and activities.', ...PSD_SCALE },
  { key: 'culture', icon: 'bank-outline', label: 'Culture', prompt: 'Marked by history, art or human craft.', ...PSD_SCALE },
];

export const SMELL_SOURCES: Array<{ key: string; label: string; icon: string }> = [
  { key: 'none', icon: 'cancel', label: 'No noticeable smell' },
  { key: 'vegetation', icon: 'sprout-outline', label: 'Plants / soil' },
  { key: 'water', icon: 'water-outline', label: 'Water / damp' },
  { key: 'food', icon: 'food-outline', label: 'Food / drink' },
  { key: 'traffic', icon: 'car-outline', label: 'Traffic / exhaust' },
  { key: 'smoke', icon: 'smoking', label: 'Smoke / tobacco' },
  { key: 'waste', icon: 'trash-can-outline', label: 'Waste / sewage' },
  { key: 'industry', icon: 'factory', label: 'Industry / chemicals' },
  { key: 'cleaning', icon: 'spray-bottle', label: 'Cleaning / perfume' },
  { key: 'animals', icon: 'paw-outline', label: 'Animals' },
  { key: 'other', icon: 'dots-horizontal', label: 'Other' },
];

export const SAM_SCALE = { min: 1, max: 9 } as const;

export interface MultisensoryModuleInfo {
  key: MultisensoryModuleKey;
  title: string;
  framework: string;
  /** MaterialCommunityIcons glyph for the section. */
  icon: string;
  /** Accent colour (dark enough for white text) and its soft background. */
  color: string;
  softColor: string;
  /** Number of items needed for the module to count as complete. */
  requiredItems: number;
}

export const MULTISENSORY_MODULES: MultisensoryModuleInfo[] = [
  { key: 'visual', icon: 'eye-outline', ...sectionColors(TopicColors.mist), title: 'Visualscape', framework: 'Kaplan preference matrix', requiredItems: 4 },
  { key: 'smell', icon: 'scent', ...sectionColors(TopicColors.lavender), title: 'Smellscape', framework: 'Pleasantness × intensity', requiredItems: 2 },
  { key: 'thermal', icon: 'thermometer', ...sectionColors(TopicColors.glacier), title: 'Thermal perception', framework: 'Scales after ISO 10551', requiredItems: 3 },
  { key: 'restorativeness', icon: 'meditation', ...sectionColors(TopicColors.periwinkle), title: 'Restorativeness', framework: 'Attention Restoration Theory', requiredItems: 4 },
  { key: 'emotion', icon: 'heart-pulse', ...sectionColors(TopicColors.heather), title: 'Emotional response', framework: 'Affect Grid · SAM dominance', requiredItems: 2 },
  { key: 'environment', icon: 'tree-outline', ...sectionColors(TopicColors.sage), title: 'Environmental qualities', framework: 'Perceived Sensory Dimensions', requiredItems: 8 },
];

function isNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/** How many of a module's required items have been answered. */
export function countAnsweredItems(
  assessment: MultisensoryAssessment | null | undefined,
  moduleKey: MultisensoryModuleKey
): number {
  const moduleValue = assessment?.[moduleKey];
  if (!moduleValue) {
    return 0;
  }

  if (moduleKey === 'smell') {
    const smell = moduleValue as SmellAssessment;
    return (isNumber(smell.pleasantness) ? 1 : 0) + (isNumber(smell.intensity) ? 1 : 0);
  }

  if (moduleKey === 'emotion') {
    const emotion = moduleValue as EmotionAssessment;
    return (isNumber(emotion.valence) ? 1 : 0) + (isNumber(emotion.arousal) ? 1 : 0);
  }

  return Object.values(moduleValue as Record<string, unknown>).filter(isNumber).length;
}

export function countAnsweredModules(assessment: MultisensoryAssessment | null | undefined): number {
  return MULTISENSORY_MODULES.filter((module) => countAnsweredItems(assessment, module.key) > 0).length;
}

/** Drops unanswered values and empty modules. Returns null if nothing is left. */
export function compactMultisensory(
  assessment: MultisensoryAssessment | null | undefined
): MultisensoryAssessment | null {
  if (!assessment) {
    return null;
  }

  const result: Record<string, Record<string, unknown>> = {};

  for (const [moduleKey, moduleValue] of Object.entries(assessment)) {
    if (!moduleValue || typeof moduleValue !== 'object') {
      continue;
    }

    const entries = Object.entries(moduleValue as Record<string, unknown>).filter(([, value]) => (
      isNumber(value) || (Array.isArray(value) && value.length > 0)
    ));

    if (entries.length > 0) {
      result[moduleKey] = Object.fromEntries(entries);
    }
  }

  return Object.keys(result).length > 0 ? (result as MultisensoryAssessment) : null;
}

export function serializeMultisensory(
  assessment: MultisensoryAssessment | null | undefined
): string | undefined {
  const compact = compactMultisensory(assessment);
  return compact ? JSON.stringify(compact) : undefined;
}

export function parseMultisensory(value?: string | null): MultisensoryAssessment | null {
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? compactMultisensory(parsed as MultisensoryAssessment)
      : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Flat representation for CSV / GeoJSON exports
// ---------------------------------------------------------------------------

export const MULTISENSORY_EXPORT_COLUMNS = [
  'visual_coherence',
  'visual_complexity',
  'visual_legibility',
  'visual_mystery',
  'smell_pleasantness',
  'smell_intensity',
  'smell_sources',
  'thermal_sensation',
  'thermal_comfort',
  'thermal_preference',
  'restor_being_away',
  'restor_fascination',
  'restor_extent',
  'restor_compatibility',
  'emotion_valence',
  'emotion_arousal',
  'emotion_dominance',
  'psd_serene',
  'psd_nature',
  'psd_rich_in_species',
  'psd_space',
  'psd_prospect',
  'psd_refuge',
  'psd_social',
  'psd_culture',
] as const;

export type MultisensoryExportColumn = (typeof MULTISENSORY_EXPORT_COLUMNS)[number];
export type MultisensoryExportRow = Record<MultisensoryExportColumn, number | string | null>;

export function toMultisensoryExportRow(
  assessment: MultisensoryAssessment | null | undefined
): MultisensoryExportRow {
  const numberOrNull = (value: unknown): number | null => (isNumber(value) ? value : null);
  const { visual, smell, thermal, restorativeness, emotion, environment } = assessment ?? {};

  return {
    visual_coherence: numberOrNull(visual?.coherence),
    visual_complexity: numberOrNull(visual?.complexity),
    visual_legibility: numberOrNull(visual?.legibility),
    visual_mystery: numberOrNull(visual?.mystery),
    smell_pleasantness: numberOrNull(smell?.pleasantness),
    smell_intensity: numberOrNull(smell?.intensity),
    smell_sources: smell?.sources && smell.sources.length > 0 ? smell.sources.join('|') : null,
    thermal_sensation: numberOrNull(thermal?.sensation),
    thermal_comfort: numberOrNull(thermal?.comfort),
    thermal_preference: numberOrNull(thermal?.preference),
    restor_being_away: numberOrNull(restorativeness?.beingAway),
    restor_fascination: numberOrNull(restorativeness?.fascination),
    restor_extent: numberOrNull(restorativeness?.extent),
    restor_compatibility: numberOrNull(restorativeness?.compatibility),
    emotion_valence: numberOrNull(emotion?.valence),
    emotion_arousal: numberOrNull(emotion?.arousal),
    emotion_dominance: numberOrNull(emotion?.dominance),
    psd_serene: numberOrNull(environment?.serene),
    psd_nature: numberOrNull(environment?.nature),
    psd_rich_in_species: numberOrNull(environment?.richInSpecies),
    psd_space: numberOrNull(environment?.space),
    psd_prospect: numberOrNull(environment?.prospect),
    psd_refuge: numberOrNull(environment?.refuge),
    psd_social: numberOrNull(environment?.social),
    psd_culture: numberOrNull(environment?.culture),
  };
}
