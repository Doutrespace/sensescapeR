/**
 * Multisensory assessment collected after the ISO 12913 soundscape rating.
 *
 * Each module follows an established framework and is optional; a module the
 * participant did not answer is simply absent, so "not rated" is never
 * confused with a midpoint rating.
 *
 *   visual           Kaplan & Kaplan preference matrix, 1-5
 *   smell            pleasantness (-1..1) x intensity (0..1) + smell sources
 *   thermal          ISO 10551 judgement scales
 *   restorativeness  Perceived Restorativeness (ART components), 0-6
 *   emotion          Self-Assessment Manikin (SAM), 1-9
 *   environment      Perceived Sensory Dimensions (PSD), 1-5
 */

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
  /** SAM valence, 1 (unhappy) to 9 (happy) */
  valence?: number;
  /** SAM arousal, 1 (calm) to 9 (excited) */
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
  /** Small pictogram shown next to the label. */
  emoji: string;
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
    emoji: '🧩',
    label: 'Coherence',
    prompt: 'The scene hangs together and is easy to take in at a glance.',
    minLabel: 'Disordered',
    maxLabel: 'Well ordered',
    ...KAPLAN_SCALE,
  },
  {
    key: 'complexity',
    emoji: '🎨',
    label: 'Complexity',
    prompt: 'There is a lot to look at; the scene is varied and rich in detail.',
    minLabel: 'Plain',
    maxLabel: 'Rich',
    ...KAPLAN_SCALE,
  },
  {
    key: 'legibility',
    emoji: '🧭',
    label: 'Legibility',
    prompt: 'I could easily find my way around here and back again.',
    minLabel: 'Confusing',
    maxLabel: 'Easy to read',
    ...KAPLAN_SCALE,
  },
  {
    key: 'mystery',
    emoji: '🗝️',
    label: 'Mystery',
    prompt: 'The scene promises more to discover if I went further in.',
    minLabel: 'Nothing hidden',
    maxLabel: 'Invites exploring',
    ...KAPLAN_SCALE,
  },
];

/** Cold-to-hot ramp for the 7-point thermal scales (index 0 = -3). */
export const THERMAL_RAMP = ['#3B6E8C', '#6C9AB5', '#A3C0D0', '#B8B2A4', '#E0AE86', '#D0834F', '#B5483A'];
/** Comfortable-to-uncomfortable ramp for the 5-point comfort scale. */
export const COMFORT_RAMP = ['#4B7A58', '#9AA85A', '#D3A64A', '#C97A45', '#B5483A'];

export const THERMAL_ITEMS: ScaleItem<ThermalKey>[] = [
  {
    key: 'sensation',
    emoji: '🌡️',
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
    emoji: '😌',
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
    emoji: '🎚️',
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
    emoji: '🏝️',
    label: 'Being away',
    prompt: 'Being here is an escape from my everyday demands.',
    ...PRS_SCALE,
  },
  {
    key: 'fascination',
    emoji: '✨',
    label: 'Fascination',
    prompt: 'This place holds my attention without effort.',
    ...PRS_SCALE,
  },
  {
    key: 'extent',
    emoji: '🌍',
    label: 'Extent',
    prompt: 'This place feels like a world of its own with plenty to explore.',
    ...PRS_SCALE,
  },
  {
    key: 'compatibility',
    emoji: '🤝',
    label: 'Compatibility',
    prompt: 'I can do the things I like here; the place suits me.',
    ...PRS_SCALE,
  },
];

const PSD_SCALE = { min: 1, max: 5, minLabel: 'Not at all', maxLabel: 'Very much' } as const;

export const ENVIRONMENT_ITEMS: ScaleItem<EnvironmentKey>[] = [
  { key: 'serene', emoji: '🤫', label: 'Serene', prompt: 'Quiet, calm and undisturbed.', ...PSD_SCALE },
  { key: 'nature', emoji: '🌿', label: 'Nature', prompt: 'Wild and untouched, shaped by nature itself.', ...PSD_SCALE },
  { key: 'richInSpecies', emoji: '🦋', label: 'Rich in species', prompt: 'Many different plants and animals.', ...PSD_SCALE },
  { key: 'space', emoji: '🌌', label: 'Space', prompt: 'Spacious and connected, like entering another world.', ...PSD_SCALE },
  { key: 'prospect', emoji: '🔭', label: 'Prospect', prompt: 'Open, with wide views over the surroundings.', ...PSD_SCALE },
  { key: 'refuge', emoji: '🛖', label: 'Refuge', prompt: 'Enclosed and safe; a sheltered place to retreat to.', ...PSD_SCALE },
  { key: 'social', emoji: '👥', label: 'Social', prompt: 'A place for meeting people and activities.', ...PSD_SCALE },
  { key: 'culture', emoji: '🏛️', label: 'Culture', prompt: 'Marked by history, art or human craft.', ...PSD_SCALE },
];

export const SMELL_SOURCES: Array<{ key: string; label: string; emoji: string }> = [
  { key: 'none', emoji: '🚫', label: 'No noticeable smell' },
  { key: 'vegetation', emoji: '🌿', label: 'Plants / soil' },
  { key: 'water', emoji: '💧', label: 'Water / damp' },
  { key: 'food', emoji: '🍞', label: 'Food / drink' },
  { key: 'traffic', emoji: '🚗', label: 'Traffic / exhaust' },
  { key: 'smoke', emoji: '🚬', label: 'Smoke / tobacco' },
  { key: 'waste', emoji: '🗑️', label: 'Waste / sewage' },
  { key: 'industry', emoji: '🏭', label: 'Industry / chemicals' },
  { key: 'cleaning', emoji: '🧴', label: 'Cleaning / perfume' },
  { key: 'animals', emoji: '🐾', label: 'Animals' },
  { key: 'other', emoji: '❔', label: 'Other' },
];

export const SAM_SCALE = { min: 1, max: 9 } as const;

export interface MultisensoryModuleInfo {
  key: MultisensoryModuleKey;
  title: string;
  framework: string;
  emoji: string;
  /** Accent colour (dark enough for white text) and its soft background. */
  color: string;
  softColor: string;
  /** Number of items needed for the module to count as complete. */
  requiredItems: number;
}

export const MULTISENSORY_MODULES: MultisensoryModuleInfo[] = [
  { key: 'visual', emoji: '👀', color: '#3B6E8C', softColor: '#D6E3EC', title: 'Visualscape', framework: 'Kaplan preference matrix', requiredItems: 4 },
  { key: 'smell', emoji: '👃', color: '#7A5C9C', softColor: '#E4DBEE', title: 'Smellscape', framework: 'Smellscape assessment', requiredItems: 2 },
  { key: 'thermal', emoji: '🌡️', color: '#B0602F', softColor: '#F3DFCF', title: 'Thermal perception', framework: 'ISO 10551', requiredItems: 3 },
  { key: 'restorativeness', emoji: '🧘', color: '#4B7A58', softColor: '#D7E6DA', title: 'Restorativeness', framework: 'PRS / Attention Restoration Theory', requiredItems: 4 },
  { key: 'emotion', emoji: '💭', color: '#B04A5C', softColor: '#F2D6DB', title: 'Emotional response', framework: 'Self-Assessment Manikin (SAM)', requiredItems: 2 },
  { key: 'environment', emoji: '🌳', color: '#69782F', softColor: '#E4E8CD', title: 'Environmental qualities', framework: 'Perceived Sensory Dimensions', requiredItems: 8 },
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
