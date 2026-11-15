import {
  applyHighPassFilter,
  computeAudioLevelStats,
  logMeanExpPoolScores,
} from './audioInference';

describe('audioInference', () => {
  it('reduces DC offset with the high-pass filter', () => {
    const constant = new Float32Array(512).fill(0.2);
    const filtered = applyHighPassFilter(
      constant,
      48000,
      200,
      { previousInput: 0, previousOutput: 0 }
    );
    const stats = computeAudioLevelStats(filtered);

    expect(stats.rms).toBeLessThan(0.05);
    expect(stats.mean).toBeLessThan(0.02);
  });

  it('log-mean-exp pooling keeps a class stable across recent windows', () => {
    const history = [
      new Float32Array([0.7, 0.1]),
      new Float32Array([0.6, 0.2]),
      new Float32Array([0.65, 0.15]),
    ];
    const pooled = logMeanExpPoolScores(history);

    expect(pooled[0]).toBeGreaterThan(pooled[1]);
    expect(pooled[0]).toBeGreaterThan(0.6);
  });
});
