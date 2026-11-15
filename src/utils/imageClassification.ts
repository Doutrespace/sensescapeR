/**
 * Image classification utilities for environment context detection
 * Maps ImageNet labels to soundscape-relevant scene categories
 */

// Scene categories relevant for soundscape context
export type SceneCategory =
  | 'nature'      // Forests, parks, natural landscapes
  | 'water'       // Oceans, lakes, rivers, beaches
  | 'urban'       // Cities, streets, buildings
  | 'indoor'      // Interior spaces
  | 'traffic'     // Roads, vehicles
  | 'park'        // Urban parks, gardens
  | 'industrial'  // Factories, construction
  | 'residential' // Homes, neighborhoods
  | 'sky'         // Open sky, clouds
  | 'unknown';    // Unclassified

export interface ImageClassification {
  label: string;
  confidence: number;
  category: SceneCategory;
  emoji: string;
  source?: 'object' | 'environment';
  coverage?: number;
  classId?: number;
  boundingBox?: NormalizedBoundingBox;
  reviewStatus?: ImageClassificationReviewStatus;
}

export type ImageClassificationReviewStatus = 'included' | 'excluded';

export interface GroupedImageClassification {
  label: string;
  confidence: number;
  category: SceneCategory;
  emoji: string;
  source?: 'object' | 'environment';
  coverage?: number;
  count: number;
  entries: ImageClassification[];
}

export interface NormalizedBoundingBox {
  left: number;
  top: number;
  width: number;
  height: number;
}

// Mapping of ImageNet-style labels to scene categories
const CATEGORY_KEYWORDS: Record<SceneCategory, string[]> = {
  nature: [
    'tree', 'forest', 'jungle', 'mountain', 'cliff', 'valley', 'meadow', 'grass',
    'flower', 'plant', 'leaf', 'branch', 'bush', 'shrub', 'woodland', 'grove',
    'countryside', 'field', 'pasture', 'farmland', 'hill', 'landscape',
  ],
  water: [
    'ocean', 'sea', 'lake', 'river', 'stream', 'waterfall', 'pond', 'beach',
    'coast', 'shore', 'wave', 'water', 'fountain', 'pool', 'canal', 'harbor',
    'pier', 'dock', 'boat', 'ship', 'yacht', 'sailboat',
  ],
  urban: [
    'building', 'skyscraper', 'tower', 'office', 'downtown', 'city', 'street',
    'sidewalk', 'crosswalk', 'square', 'plaza', 'monument', 'statue', 'church',
    'cathedral', 'mosque', 'temple', 'castle', 'palace', 'bridge', 'overpass',
  ],
  indoor: [
    'room', 'living', 'bedroom', 'kitchen', 'bathroom', 'hallway', 'corridor',
    'lobby', 'restaurant', 'cafe', 'bar', 'shop', 'store', 'mall', 'library',
    'museum', 'theater', 'cinema', 'gym', 'studio', 'office', 'classroom',
    'hospital', 'hotel', 'furniture', 'chair', 'table', 'couch', 'bed',
    'book', 'books', 'bookshelf', 'bookcase', 'shelf',
  ],
  traffic: [
    'car', 'truck', 'bus', 'vehicle', 'automobile', 'traffic', 'road', 'highway',
    'freeway', 'intersection', 'parking', 'garage', 'motorcycle', 'bicycle',
    'scooter', 'taxi', 'ambulance', 'fire', 'police', 'train', 'railway',
    'station', 'airport', 'airplane', 'runway',
  ],
  park: [
    'park', 'garden', 'lawn', 'bench', 'playground', 'picnic', 'path', 'trail',
    'walkway', 'gazebo', 'pavilion', 'bandstand', 'botanical',
  ],
  industrial: [
    'factory', 'warehouse', 'construction', 'crane', 'scaffold', 'machinery',
    'equipment', 'container', 'cargo', 'industrial', 'plant', 'refinery',
    'powerline', 'tower', 'antenna', 'chimney', 'smokestack',
  ],
  residential: [
    'house', 'home', 'apartment', 'condo', 'neighborhood', 'suburb', 'yard',
    'driveway', 'porch', 'balcony', 'window', 'door', 'fence', 'gate',
    'mailbox', 'garage', 'roof',
  ],
  sky: [
    'sky', 'cloud', 'sunset', 'sunrise', 'dawn', 'dusk', 'horizon', 'sun',
    'moon', 'star', 'night',
  ],
  unknown: [],
};

// Category display info
export const CATEGORY_INFO: Record<SceneCategory, { emoji: string; label: string; color: string }> = {
  nature: { emoji: '🌲', label: 'Nature', color: '#22C55E' },
  water: { emoji: '🌊', label: 'Water', color: '#3B82F6' },
  urban: { emoji: '🏙️', label: 'Urban', color: '#6B7280' },
  indoor: { emoji: '🏠', label: 'Indoor', color: '#F59E0B' },
  traffic: { emoji: '🚗', label: 'Traffic', color: '#EF4444' },
  park: { emoji: '🌳', label: 'Park', color: '#84CC16' },
  industrial: { emoji: '🏭', label: 'Industrial', color: '#78716C' },
  residential: { emoji: '🏡', label: 'Residential', color: '#EC4899' },
  sky: { emoji: '☁️', label: 'Sky', color: '#06B6D4' },
  unknown: { emoji: '❓', label: 'Unknown', color: '#9CA3AF' },
};

/**
 * Determines the scene category from a label string
 */
export function getSceneCategory(label: string): SceneCategory {
  const normalizedLabel = label.toLowerCase();

  // Check each category's keywords
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (category === 'unknown') continue;

    for (const keyword of keywords) {
      if (normalizedLabel.includes(keyword)) {
        return category as SceneCategory;
      }
    }
  }

  return 'unknown';
}

/**
 * Gets emoji for a label based on its category
 */
export function getLabelEmoji(label: string): string {
  const category = getSceneCategory(label);
  return CATEGORY_INFO[category].emoji;
}

/**
 * Processes raw model output into structured classifications
 */
export function processImageClassifications(
  labels: string[],
  scores: Float32Array | number[],
  topK: number = 5,
  minConfidence: number = 0.05
): ImageClassification[] {
  const results: ImageClassification[] = [];

  // Create sorted indices
  const indices = Array.from({ length: scores.length }, (_, i) => i);
  indices.sort((a, b) => (scores[b] as number) - (scores[a] as number));

  // Take top K results above minimum confidence
  for (let i = 0; i < Math.min(topK, indices.length); i++) {
    const idx = indices[i];
    const confidence = scores[idx] as number;

    if (confidence < minConfidence) break;

    const label = labels[idx] || `Class ${idx}`;
    const category = getSceneCategory(label);

    results.push({
      label,
      confidence,
      category,
      emoji: CATEGORY_INFO[category].emoji,
    });
  }

  return results;
}

/**
 * Gets the dominant scene category from classifications
 */
export function getDominantCategory(
  classifications: ImageClassification[]
): SceneCategory {
  if (classifications.length === 0) return 'unknown';

  // Weight by confidence
  const categoryScores = new Map<SceneCategory, number>();

  for (const { category, confidence } of classifications) {
    const current = categoryScores.get(category) || 0;
    categoryScores.set(category, current + confidence);
  }

  // Find highest scoring category
  let dominantCategory: SceneCategory = 'unknown';
  let highestScore = 0;

  for (const [category, score] of categoryScores) {
    if (score > highestScore) {
      highestScore = score;
      dominantCategory = category;
    }
  }

  return dominantCategory;
}

export function groupImageClassifications(
  classifications: ImageClassification[]
): GroupedImageClassification[] {
  const groups = new Map<string, GroupedImageClassification>();

  for (const classification of classifications) {
    const source = classification.source ?? 'object';
    const key = `${source}:${classification.label.toLowerCase()}`;
    const existing = groups.get(key);

    if (existing) {
      existing.count += 1;
      existing.entries.push(classification);

      if (classification.confidence > existing.confidence) {
        existing.confidence = classification.confidence;
      }

      if ((classification.coverage ?? 0) > (existing.coverage ?? 0)) {
        existing.coverage = classification.coverage;
      }

      continue;
    }

    groups.set(key, {
      label: classification.label,
      confidence: classification.confidence,
      category: classification.category,
      emoji: classification.emoji,
      source: classification.source,
      coverage: classification.coverage,
      count: 1,
      entries: [classification],
    });
  }

  return Array.from(groups.values()).sort((left, right) => {
    if (right.count !== left.count) {
      return right.count - left.count;
    }

    const rightMetric = right.coverage ?? right.confidence;
    const leftMetric = left.coverage ?? left.confidence;
    return rightMetric - leftMetric;
  });
}

export function getIncludedImageClassifications(
  classifications: ImageClassification[]
): ImageClassification[] {
  return classifications.filter((classification) => classification.reviewStatus !== 'excluded');
}

export function withIncludedImageClassifications(
  classifications: ImageClassification[]
): ImageClassification[] {
  return classifications.map((classification) => ({
    ...classification,
    reviewStatus: classification.reviewStatus === 'excluded' ? 'excluded' : 'included',
  }));
}
