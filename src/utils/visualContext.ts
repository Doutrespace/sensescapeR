import type { ImageClassification } from './imageClassification';

export type VisualIndicatorKey =
  | 'natural_presence'
  | 'built_presence'
  | 'traffic_presence'
  | 'pedestrian_presence'
  | 'green_visibility'
  | 'water_visibility'
  | 'indoor_likelihood'
  | 'outdoor_likelihood';

export interface VisualIndicator {
  key: VisualIndicatorKey;
  label: string;
  score: number;
  level: 'low' | 'moderate' | 'high';
}

export interface VisualContextAssessment {
  dominantContext: string;
  indicators: VisualIndicator[];
}

const INDICATOR_LABELS: Record<VisualIndicatorKey, string> = {
  natural_presence: 'Natural',
  built_presence: 'Built',
  traffic_presence: 'Traffic',
  pedestrian_presence: 'Pedestrians',
  green_visibility: 'Green',
  water_visibility: 'Water',
  indoor_likelihood: 'Indoor',
  outdoor_likelihood: 'Outdoor',
};

const KEYWORDS = {
  natural: ['tree', 'grass', 'plant', 'flower', 'forest', 'mountain', 'sky', 'water', 'river', 'lake', 'park', 'bush'],
  built: ['wall', 'building', 'house', 'window', 'windowpane', 'floor', 'ceiling', 'road', 'sidewalk', 'bridge', 'room', 'table'],
  traffic: ['car', 'truck', 'bus', 'vehicle', 'train', 'motorcycle', 'bicycle', 'traffic', 'road'],
  pedestrian: ['person', 'people', 'crowd', 'bench', 'chair', 'walker', 'footpath'],
  green: ['tree', 'grass', 'plant', 'flower', 'forest', 'bush', 'leaf'],
  water: ['water', 'river', 'lake', 'sea', 'ocean', 'pond', 'fountain'],
  indoor: ['wall', 'floor', 'ceiling', 'table', 'chair', 'sofa', 'book', 'windowpane', 'lamp', 'bed', 'shelf', 'room'],
  outdoor: ['sky', 'tree', 'grass', 'road', 'building', 'water', 'mountain', 'sidewalk', 'car', 'house'],
};

function classifyLevel(score: number): 'low' | 'moderate' | 'high' {
  if (score >= 0.5) return 'high';
  if (score >= 0.28) return 'moderate';
  return 'low';
}

function getMetric(item: ImageClassification): number {
  return item.source === 'environment'
    ? (item.coverage ?? item.confidence)
    : item.confidence;
}

function scoreForKeywords(classifications: ImageClassification[], keywords: string[]): number {
  if (classifications.length === 0) {
    return 0;
  }

  let score = 0;
  for (const item of classifications) {
    const label = item.label.toLowerCase();
    if (keywords.some((keyword) => label.includes(keyword))) {
      const metric = getMetric(item);
      score += item.source === 'environment' ? metric : metric * 0.75;
    }
  }

  return Math.max(0, Math.min(1, score));
}

export function assessVisualContext(classifications: ImageClassification[]): VisualContextAssessment {
  const indicators: VisualIndicator[] = ([
    {
      key: 'natural_presence' as const,
      label: INDICATOR_LABELS.natural_presence,
      score: scoreForKeywords(classifications, KEYWORDS.natural),
      level: 'low',
    },
    {
      key: 'built_presence' as const,
      label: INDICATOR_LABELS.built_presence,
      score: scoreForKeywords(classifications, KEYWORDS.built),
      level: 'low',
    },
    {
      key: 'traffic_presence' as const,
      label: INDICATOR_LABELS.traffic_presence,
      score: scoreForKeywords(classifications, KEYWORDS.traffic),
      level: 'low',
    },
    {
      key: 'pedestrian_presence' as const,
      label: INDICATOR_LABELS.pedestrian_presence,
      score: scoreForKeywords(classifications, KEYWORDS.pedestrian),
      level: 'low',
    },
    {
      key: 'green_visibility' as const,
      label: INDICATOR_LABELS.green_visibility,
      score: scoreForKeywords(classifications, KEYWORDS.green),
      level: 'low',
    },
    {
      key: 'water_visibility' as const,
      label: INDICATOR_LABELS.water_visibility,
      score: scoreForKeywords(classifications, KEYWORDS.water),
      level: 'low',
    },
    {
      key: 'indoor_likelihood' as const,
      label: INDICATOR_LABELS.indoor_likelihood,
      score: scoreForKeywords(classifications, KEYWORDS.indoor),
      level: 'low',
    },
    {
      key: 'outdoor_likelihood' as const,
      label: INDICATOR_LABELS.outdoor_likelihood,
      score: scoreForKeywords(classifications, KEYWORDS.outdoor),
      level: 'low',
    },
  ]).map((indicator) => ({
    ...indicator,
    level: classifyLevel(indicator.score),
  }));

  return {
    dominantContext: inferDominantContext(indicators),
    indicators: indicators.sort((a, b) => b.score - a.score),
  };
}

function inferDominantContext(indicators: VisualIndicator[]): string {
  const byKey = Object.fromEntries(indicators.map((item) => [item.key, item])) as Record<VisualIndicatorKey, VisualIndicator>;

  if (byKey.indoor_likelihood.score >= 0.45 && byKey.outdoor_likelihood.score < 0.35) {
    return byKey.green_visibility.score >= 0.25 ? 'Indoor edge with greenery' : 'Indoor room';
  }
  if (byKey.water_visibility.score >= 0.4) {
    return 'Waterside setting';
  }
  if (byKey.traffic_presence.score >= 0.4 && byKey.built_presence.score >= 0.35) {
    return byKey.pedestrian_presence.score >= 0.2 ? 'Active urban street' : 'Urban traffic corridor';
  }
  if (byKey.green_visibility.score >= 0.4 && byKey.outdoor_likelihood.score >= 0.35) {
    return byKey.built_presence.score >= 0.25 ? 'Green urban edge' : 'Green outdoor space';
  }
  if (byKey.built_presence.score >= 0.45) {
    return byKey.outdoor_likelihood.score >= byKey.indoor_likelihood.score ? 'Built outdoor setting' : 'Built interior setting';
  }
  return 'Mixed visual context';
}

export function formatVisualIndicatorSummary(assessment: VisualContextAssessment): string {
  const prominent = assessment.indicators
    .filter((item) => item.level !== 'low')
    .slice(0, 4)
    .map((item) => `${item.label} ${item.level}`)
    .join(', ');

  return prominent || 'No dominant visual indicator';
}
