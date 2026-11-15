import { assessVisualContext, formatVisualIndicatorSummary } from './visualContext';
import type { ImageClassification } from './imageClassification';

describe('visual context assessment', () => {
  it('identifies a green outdoor setting from trees and sky', () => {
    const classifications: ImageClassification[] = [
      { label: 'tree', confidence: 0.9, coverage: 0.34, category: 'nature', emoji: 'x', source: 'environment' },
      { label: 'sky', confidence: 0.8, coverage: 0.28, category: 'sky', emoji: 'x', source: 'environment' },
      { label: 'grass', confidence: 0.7, coverage: 0.22, category: 'nature', emoji: 'x', source: 'environment' },
    ];

    const result = assessVisualContext(classifications);

    expect(result.dominantContext).toBe('Green outdoor space');
    expect(result.indicators.find((item) => item.key === 'green_visibility')?.level).toBe('high');
    expect(result.indicators.find((item) => item.key === 'outdoor_likelihood')?.level).toBe('high');
  });

  it('identifies an urban traffic corridor from road and vehicles', () => {
    const classifications: ImageClassification[] = [
      { label: 'road', confidence: 0.7, coverage: 0.31, category: 'traffic', emoji: 'x', source: 'environment' },
      { label: 'building', confidence: 0.8, coverage: 0.29, category: 'urban', emoji: 'x', source: 'environment' },
      { label: 'car', confidence: 0.88, category: 'traffic', emoji: 'x', source: 'object' },
    ];

    const result = assessVisualContext(classifications);

    expect(result.dominantContext).toMatch(/urban/i);
    expect(formatVisualIndicatorSummary(result)).toContain('Traffic');
  });
});
