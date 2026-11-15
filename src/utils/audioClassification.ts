export interface RankedClassification {
  label: string;
  score: number;
  adjustedScore: number;
  emoji: string;
}

export interface MacroClassification {
  label: string;
  score: number;
  emoji: string;
}

export type MacroFamily = 'Anthrophony' | 'Biophony' | 'Geophony' | 'Other';

export interface MacroFamilyTheme {
  tint: string;
  softTint: string;
  track: string;
  text: string;
}

interface MacroRule {
  label: MacroFamily;
  emoji: string;
  pattern: RegExp;
}

const DISPLAY_LABEL_OVERRIDES: Array<[RegExp, string]> = [
  [/^Bird vocalization, bird call, bird song$/i, 'Bird song / call'],
  [/^Child speech, kid speaking$/i, 'Child speech'],
  [/^Narration, monologue$/i, 'Narration'],
  [/^Hubbub, speech noise, speech babble$/i, 'Speech babble'],
  [/^Walk, footsteps$/i, 'Footsteps'],
  [/^Livestock, farm animals, working animals$/i, 'Livestock'],
  [/^Domestic sounds, home sounds$/i, 'Domestic sounds'],
  [/^Vehicle$/i, 'Vehicle noise'],
  [/^Crying, sobbing$/i, 'Crying'],
  [/^Baby cry, infant cry$/i, 'Baby crying'],
  [/^Chuckle, chortle$/i, 'Chuckle'],
  [/^Engine$/i, 'Engine noise'],
];

const MACRO_RULES: MacroRule[] = [
  {
    label: 'Biophony',
    emoji: '🐦',
    pattern: /bird|bird vocalization|bird call|bird song|chirp|tweet|squawk|coo|crow|caw|dog|bark|cat|meow|purr|animal|insect|cricket|frog|livestock|horse|cow|goat|sheep|duck|goose|rooster|wild animals/i,
  },
  {
    label: 'Geophony',
    emoji: '🌧️',
    pattern: /wind|rain|thunder|water|ocean|wave|stream|river|fire|crackle|eruption|avalanche|rustling leaves/i,
  },
  {
    label: 'Anthrophony',
    emoji: '🏙️',
    pattern: /human sounds|speech|conversation|narration|monologue|babbling|whisper|shout|bellow|whoop|yell|screaming|laughter|giggle|chuckle|cry|cough|sneeze|breathing|snoring|voice|chatter|crowd|hubbub|speech babble|male speech|female speech|child speech|kid speaking|music|musical instrument|piano|guitar|drum|violin|flute|song|choir|harp|bell|synthesizer|engine|motor|mechanical|vehicle|fan|vacuum|drill|tool|air conditioning|machine|radio|television|traffic|siren|alarm|door|typing|clapping|applause|footsteps/i,
  },
];

const BROAD_HIERARCHY_PATTERNS = [
  /^Speech$/i,
  /^Animal$/i,
  /^Bird$/i,
  /^Music$/i,
  /^Vehicle$/i,
  /^Engine$/i,
  /^Domestic sounds, home sounds$/i,
  /^Noise$/i,
  /^Environmental noise$/i,
  /^Sound effect$/i,
  /^Field recording$/i,
  /^Silence \/ quiet$/i,
  /^Inside, /i,
  /^Outside, /i,
  /^Wind$/i,
  /^Rain$/i,
  /^Thunderstorm$/i,
  /^Water$/i,
];

function getEmoji(label: string): string {
  const normalized = label.toLowerCase();
  if (normalized.includes('bird') || normalized.includes('chirp') || normalized.includes('tweet')) return '🐦';
  if (normalized.includes('dog') || normalized.includes('bark')) return '🐕';
  if (normalized.includes('cat') || normalized.includes('meow') || normalized.includes('purr')) return '🐱';
  if (normalized.includes('speech') || normalized.includes('voice') || normalized.includes('conversation') || normalized.includes('crowd') || normalized.includes('babble')) return '🗣️';
  if (normalized.includes('music') || normalized.includes('song') || normalized.includes('instrument') || normalized.includes('guitar') || normalized.includes('piano') || normalized.includes('drum') || normalized.includes('flute')) return '🎵';
  if (normalized.includes('car') || normalized.includes('traffic') || normalized.includes('engine') || normalized.includes('vehicle') || normalized.includes('truck') || normalized.includes('horn') || normalized.includes('motor')) return '🚗';
  if (normalized.includes('rain') || normalized.includes('thunder') || normalized.includes('water') || normalized.includes('ocean') || normalized.includes('wave') || normalized.includes('stream')) return '🌊';
  if (normalized.includes('wind')) return '🌬️';
  if (normalized.includes('silence') || normalized.includes('background') || normalized.includes('static') || normalized.includes('noise')) return '🔇';
  if (normalized.includes('alarm') || normalized.includes('siren')) return '🚨';
  if (normalized.includes('aircraft') || normalized.includes('airplane') || normalized.includes('helicopter') || normalized.includes('jet')) return '✈️';
  if (normalized.includes('train') || normalized.includes('rail')) return '🚂';
  if (normalized.includes('child') || normalized.includes('baby') || normalized.includes('laughter')) return '👶';
  if (normalized.includes('insect') || normalized.includes('cricket') || normalized.includes('frog')) return '🦟';
  if (normalized.includes('fire') || normalized.includes('crackl')) return '🔥';
  if (normalized.includes('explosion') || normalized.includes('gunshot')) return '💥';
  return '🔊';
}

export function getDisplayLabel(label: string): string {
  for (const [pattern, replacement] of DISPLAY_LABEL_OVERRIDES) {
    if (pattern.test(label)) {
      return replacement;
    }
  }
  return label;
}

export function getMacroFamily(label: string): MacroFamily {
  const matchedRule = MACRO_RULES.find((candidate) => candidate.pattern.test(label));
  return matchedRule?.label ?? 'Other';
}

export function getMacroFamilyTheme(family: MacroFamily): MacroFamilyTheme {
  switch (family) {
    case 'Anthrophony':
      return {
        tint: '#6C8AA7',
        softTint: '#E7EDF1',
        track: '#D4DEE6',
        text: '#3E5569',
      };
    case 'Biophony':
      return {
        tint: '#7B9A77',
        softTint: '#E8F0E4',
        track: '#D4E1CF',
        text: '#486246',
      };
    case 'Geophony':
      return {
        tint: '#8D8A74',
        softTint: '#EFEBDD',
        track: '#DDD7C8',
        text: '#5F5C4E',
      };
    default:
      return {
        tint: '#A38D7A',
        softTint: '#F0E7DE',
        track: '#E0D4C7',
        text: '#6F5A49',
      };
  }
}

export function adjustClassificationScore(label: string, score: number): number {
  void label;
  return score;
}

export function isBroadHierarchyLabel(label: string): boolean {
  return BROAD_HIERARCHY_PATTERNS.some((pattern) => pattern.test(label));
}

export function buildRankedClassifications(
  scores: Float32Array,
  labels: ArrayLike<string> | Record<number, string>,
  minAdjustedScore = 0
): RankedClassification[] {
  return Array.from(scores)
    .map((score, index) => {
      const label = labels[index] ?? `Class ${index}`;
      return {
        label,
        score,
        adjustedScore: adjustClassificationScore(label, score),
        emoji: getEmoji(label),
      };
    })
    .filter((entry) => entry.adjustedScore >= minAdjustedScore)
    .sort((left, right) => (
      right.adjustedScore - left.adjustedScore || right.score - left.score
    ));
}

export function selectDetailedDisplayClassifications(
  ranked: RankedClassification[],
  minAdjustedScore = 0,
  maxItems = 5
): RankedClassification[] {
  const eligible = ranked
    .filter((entry) => (
      entry.adjustedScore >= minAdjustedScore &&
      !isBroadHierarchyLabel(entry.label)
    ))
    .slice()
    .sort((left, right) => (
      right.adjustedScore - left.adjustedScore || right.score - left.score
    ));

  const top = eligible[0];
  if (!top) {
    return [];
  }

  const minRelativeScore = top.adjustedScore * 0.55;
  const maxGapFromTop = 0.12;

  return eligible
    .filter((entry, index) => (
      index === 0 ||
      entry.adjustedScore >= minRelativeScore ||
      top.adjustedScore - entry.adjustedScore <= maxGapFromTop
    ))
    .slice(0, maxItems);
}

export function selectBroadDisplayClassifications(
  ranked: RankedClassification[],
  minAdjustedScore = 0,
  maxItems = 4
): RankedClassification[] {
  return ranked
    .filter((entry) => (
      entry.adjustedScore >= minAdjustedScore &&
      isBroadHierarchyLabel(entry.label)
    ))
    .slice()
    .sort((left, right) => (
      right.adjustedScore - left.adjustedScore || right.score - left.score
    ))
    .slice(0, maxItems);
}

export function buildMacroClassifications(
  ranked: RankedClassification[],
  minAdjustedScore = 0.08
): MacroClassification[] {
  const macros = new Map<string, MacroClassification>();

  for (const entry of ranked) {
    if (entry.adjustedScore < minAdjustedScore) {
      continue;
    }

    const rule = MACRO_RULES.find((candidate) => candidate.pattern.test(entry.label));
    if (!rule) {
      continue;
    }

    const previous = macros.get(rule.label);
    if (!previous) {
      macros.set(rule.label, {
        label: rule.label,
        emoji: rule.emoji,
        score: entry.adjustedScore,
      });
      continue;
    }

    previous.score = Math.max(previous.score, entry.adjustedScore);
  }

  return Array.from(macros.values())
    .sort((left, right) => right.score - left.score)
    .slice(0, 3);
}
