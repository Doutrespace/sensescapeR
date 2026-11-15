export type DetectedSoundReviewStatus = 'included' | 'excluded';

export interface StoredDetectedSound {
  label: string;
  hierarchy?: 'specific' | 'broad';
  score?: number;
  adjustedScore?: number;
  occurrenceCount?: number;
  reviewStatus?: DetectedSoundReviewStatus;
}

export function parseDetectedSounds(value?: string | null): StoredDetectedSound[] {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.flatMap((item) => {
      if (!item || typeof item !== 'object') {
        return [];
      }

      const candidate = item as Record<string, unknown>;
      if (typeof candidate.label !== 'string') {
        return [];
      }

      return [{
        label: candidate.label,
        hierarchy: candidate.hierarchy === 'broad' ? 'broad' : 'specific',
        score: typeof candidate.score === 'number' ? candidate.score : undefined,
        adjustedScore: typeof candidate.adjustedScore === 'number' ? candidate.adjustedScore : undefined,
        occurrenceCount: typeof candidate.occurrenceCount === 'number' ? candidate.occurrenceCount : undefined,
        reviewStatus: candidate.reviewStatus === 'excluded' ? 'excluded' : 'included',
      }];
    });
  } catch {
    return [];
  }
}

export function getIncludedDetectedSounds(sounds: StoredDetectedSound[]): StoredDetectedSound[] {
  return sounds.filter((sound) => sound.reviewStatus !== 'excluded');
}

export function serializeDetectedSounds(sounds: StoredDetectedSound[]): string {
  return JSON.stringify(sounds);
}
