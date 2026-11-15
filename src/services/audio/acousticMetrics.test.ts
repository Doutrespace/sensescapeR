import { computeAcousticMetrics, designAWeighting } from './acousticMetrics';

const FS = 48000;

function makeSine(freqHz: number, amplitude: number, durationS: number): Int16Array {
  const n = Math.round(FS * durationS);
  const out = new Int16Array(n);
  for (let i = 0; i < n; i++) {
    const v = amplitude * Math.sin((2 * Math.PI * freqHz * i) / FS);
    out[i] = Math.max(-32768, Math.min(32767, Math.round(v * 32767)));
  }
  return out;
}

describe('computeAcousticMetrics', () => {
  it('returns null for empty input', () => {
    expect(computeAcousticMetrics([], FS)).toBeNull();
    expect(computeAcousticMetrics([new Int16Array(0)], FS)).toBeNull();
  });

  it('A-weighting is ~0 dB at 1 kHz (LAeq ≈ LZeq)', () => {
    const metrics = computeAcousticMetrics([makeSine(1000, 0.5, 2)], FS)!;
    expect(metrics).not.toBeNull();
    // |A(1kHz)| = 0 dB by definition, so the A- and Z-weighted Leq match.
    expect(Math.abs(metrics.laeq - metrics.lzeq)).toBeLessThan(0.3);
    // LZeq of a 0.5-amplitude sine = 20*log10(0.5/sqrt2) ≈ -9.0 dBFS.
    expect(metrics.lzeq).toBeCloseTo(-9.0, 0);
  });

  it('applies the standard A-weighting attenuation at 100 Hz (≈ -19 dB)', () => {
    const metrics = computeAcousticMetrics([makeSine(100, 0.5, 2)], FS)!;
    const attenuation = metrics.laeq - metrics.lzeq;
    expect(attenuation).toBeGreaterThan(-20.5);
    expect(attenuation).toBeLessThan(-17.5);
  });

  it('boosts slightly around 2-4 kHz (positive A-weighting)', () => {
    const metrics = computeAcousticMetrics([makeSine(3000, 0.4, 2)], FS)!;
    expect(metrics.laeq - metrics.lzeq).toBeGreaterThan(0.4);
  });

  it('gives near-equal percentiles for a steady tone', () => {
    const metrics = computeAcousticMetrics([makeSine(1000, 0.5, 3)], FS)!;
    expect(Math.abs(metrics.laf10 - metrics.laf90)).toBeLessThan(1.0);
    expect(metrics.lafMax).toBeGreaterThanOrEqual(metrics.laf50);
    expect(metrics.laf50).toBeGreaterThanOrEqual(metrics.lafMin);
  });

  it('separates foreground/background levels (L10 > L90) for a varying signal', () => {
    const quiet = makeSine(1000, 0.02, 2); // 2 s background
    const loud = makeSine(1000, 0.6, 1); // 1 s burst
    const metrics = computeAcousticMetrics([quiet, loud, quiet], FS)!;
    expect(metrics.laf10).toBeGreaterThan(metrics.laf90 + 5);
  });

  it('is uncalibrated (dBFS) by default and dB_SPL once an offset is supplied', () => {
    const raw = computeAcousticMetrics([makeSine(1000, 0.5, 1)], FS)!;
    expect(raw.calibrated).toBe(false);
    expect(raw.reference).toBe('dBFS');

    const cal = computeAcousticMetrics([makeSine(1000, 0.5, 1)], FS, {
      calibrationOffsetDb: 100,
    })!;
    expect(cal.calibrated).toBe(true);
    expect(cal.reference).toBe('dB_SPL');
    expect(cal.laeq).toBeCloseTo(raw.laeq + 100, 1);
  });

  it('designs a 3-section A-weighting cascade with finite coefficients', () => {
    const sections = designAWeighting(FS);
    expect(sections).toHaveLength(3);
    for (const s of sections) {
      for (const c of [s.b0, s.b1, s.b2, s.a1, s.a2]) {
        expect(Number.isFinite(c)).toBe(true);
      }
    }
  });
});
