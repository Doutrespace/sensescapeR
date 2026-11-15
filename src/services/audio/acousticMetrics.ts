// Acoustic metrics computed per IEC 61672 (A-weighting) and IEC 61672-1 time
// weighting, from the raw captured PCM. These replace the previous practice of
// exporting raw RMS/peak dBFS under an "LAeqApprox" label.
//
// IMPORTANT — calibration: a phone microphone reports a relative full-scale
// level (dBFS), not an absolute sound pressure level (dB SPL). Without a
// per-device calibration offset (recorded against a reference SPL meter or
// acoustic calibrator) every value here is in dBFS and is only comparable
// between recordings made on the SAME device with the SAME mic route. Pass a
// `calibrationOffsetDb` once a calibration flow exists and `reference` flips to
// 'dB_SPL'. Until then these are honest, IEC-weighted dBFS values — not noise
// regulation grade, but directly comparable on one device and recomputable
// offline from the bundled WAV.

export type LevelReference = 'dBFS' | 'dB_SPL';

export interface AcousticMetrics {
  // Energy-averaged equivalent continuous levels over the whole recording
  laeq: number; // A-weighted Leq (the primary soundscape descriptor)
  lzeq: number; // Z-weighted (unweighted) Leq, for reference

  // Time-weighted (Fast, 125 ms) A-weighted statistics
  lafMax: number; // LAF,max
  lafMin: number; // LAF,min
  laf10: number; // exceeded 10% of the time — intrusive/foreground sounds
  laf50: number; // median level
  laf90: number; // exceeded 90% of the time — background/residual level
  laf95: number; // residual noise floor

  // Calibration / provenance
  reference: LevelReference;
  calibrationOffsetDb: number;
  calibrated: boolean;
  weighting: 'A';
  timeWeighting: 'F';
  sampleRate: number;
  windowMs: number; // percentile sampling interval
  durationMs: number;
  computedFromOriginal: boolean; // true = pre-normalization samples
}

interface DigitalBiquad {
  b0: number;
  b1: number;
  b2: number;
  a1: number;
  a2: number;
}

// Bilinear transform of one analog second-order section.
// Analog H(s) = (B2 s^2 + B1 s + B0) / (A2 s^2 + A1 s + A0), with s = c(1-z^-1)/(1+z^-1).
function analogToDigitalBiquad(
  B2: number,
  B1: number,
  B0: number,
  A2: number,
  A1: number,
  A0: number,
  fs: number
): DigitalBiquad {
  const c = 2 * fs;
  const c2 = c * c;

  const b0 = B2 * c2 + B1 * c + B0;
  const b1 = 2 * B0 - 2 * B2 * c2;
  const b2 = B2 * c2 - B1 * c + B0;

  const a0 = A2 * c2 + A1 * c + A0;
  const a1 = 2 * A0 - 2 * A2 * c2;
  const a2 = A2 * c2 - A1 * c + A0;

  return {
    b0: b0 / a0,
    b1: b1 / a0,
    b2: b2 / a0,
    a1: a1 / a0,
    a2: a2 / a0,
  };
}

// IEC 61672 A-weighting as a cascade of three biquads.
// Poles: f1 (double), f2, f3, f4 (double); +1.9997 dB normalisation so |A(1kHz)| = 0 dB.
export function designAWeighting(fs: number): DigitalBiquad[] {
  const f1 = 20.598997;
  const f2 = 107.65265;
  const f3 = 737.86223;
  const f4 = 12194.217;
  const a1000Db = 1.9997;

  const TWO_PI = 2 * Math.PI;
  const w1 = TWO_PI * f1;
  const w2 = TWO_PI * f2;
  const w3 = TWO_PI * f3;
  const w4 = TWO_PI * f4;

  const k = w4 * w4 * Math.pow(10, a1000Db / 20);

  // H(s) = k s^4 / [ (s+w1)^2 (s+w2)(s+w3) (s+w4)^2 ]
  //   biquad A: k s^2 / (s + w4)^2
  //   biquad B:   s^2 / (s + w1)^2
  //   biquad C:     1 / ((s+w2)(s+w3))  = 1 / (s^2 + (w2+w3)s + w2 w3)
  return [
    analogToDigitalBiquad(k, 0, 0, 1, 2 * w4, w4 * w4, fs),
    analogToDigitalBiquad(1, 0, 0, 1, 2 * w1, w1 * w1, fs),
    analogToDigitalBiquad(0, 0, 1, 1, w2 + w3, w2 * w3, fs),
  ];
}

// Transposed Direct Form II state for a biquad cascade.
class BiquadCascade {
  private readonly z1: number[];
  private readonly z2: number[];

  constructor(private readonly sections: DigitalBiquad[]) {
    this.z1 = new Array(sections.length).fill(0);
    this.z2 = new Array(sections.length).fill(0);
  }

  process(input: number): number {
    let x = input;
    for (let i = 0; i < this.sections.length; i++) {
      const s = this.sections[i];
      const y = s.b0 * x + this.z1[i];
      this.z1[i] = s.b1 * x - s.a1 * y + this.z2[i];
      this.z2[i] = s.b2 * x - s.a2 * y;
      x = y;
    }
    return x;
  }
}

const LEVEL_FLOOR_DB = -120; // guards log10(0) and 16-bit quantisation noise

function toDb(meanSquare: number): number {
  if (!(meanSquare > 0)) {
    return LEVEL_FLOOR_DB;
  }
  return Math.max(LEVEL_FLOOR_DB, 10 * Math.log10(meanSquare));
}

// Value exceeded N% of the time, from an ascending-sorted level array.
// L10 = high (foreground), L90 = low (background).
function levelExceeded(sortedAsc: number[], n: number): number {
  if (sortedAsc.length === 0) {
    return LEVEL_FLOOR_DB;
  }
  const fraction = Math.min(1, Math.max(0, 1 - n / 100));
  const index = Math.round(fraction * (sortedAsc.length - 1));
  return sortedAsc[index];
}

export interface AcousticMetricsOptions {
  // dBFS -> dB SPL offset from device calibration. Omit while uncalibrated.
  calibrationOffsetDb?: number;
  computedFromOriginal?: boolean;
  // Fast-detector sampling interval for percentile statistics (ms).
  windowMs?: number;
}

const FAST_TIME_CONSTANT_S = 0.125; // IEC 61672 "Fast"

/**
 * Compute IEC-weighted acoustic metrics from captured 16-bit PCM chunks.
 * Returns null when there is no audio. Levels are in dBFS unless a
 * calibration offset is supplied, in which case they are in dB SPL.
 */
export function computeAcousticMetrics(
  chunks: Int16Array[],
  sampleRate: number,
  options: AcousticMetricsOptions = {}
): AcousticMetrics | null {
  let totalSamples = 0;
  for (const chunk of chunks) {
    totalSamples += chunk.length;
  }
  if (totalSamples === 0 || sampleRate <= 0) {
    return null;
  }

  const windowMs = options.windowMs ?? 50;
  const sampleInterval = Math.max(1, Math.round((sampleRate * windowMs) / 1000));
  const fastAlpha = 1 - Math.exp(-1 / (sampleRate * FAST_TIME_CONSTANT_S));

  const aWeight = new BiquadCascade(designAWeighting(sampleRate));

  let sumSquaresZ = 0; // unweighted energy
  let sumSquaresA = 0; // A-weighted energy
  let fastMeanSquare = 0; // A-weighted Fast detector state
  const fastLevels: number[] = [];

  let sampleCounter = 0;
  for (const chunk of chunks) {
    for (let i = 0; i < chunk.length; i++) {
      const x = chunk[i] / 0x8000; // 16-bit -> full-scale [-1, 1)
      const a = aWeight.process(x);

      sumSquaresZ += x * x;
      sumSquaresA += a * a;

      fastMeanSquare += fastAlpha * (a * a - fastMeanSquare);
      if (sampleCounter % sampleInterval === 0) {
        fastLevels.push(toDb(fastMeanSquare));
      }
      sampleCounter++;
    }
  }

  fastLevels.sort((p, q) => p - q);

  const offset = options.calibrationOffsetDb ?? 0;
  const calibrated = typeof options.calibrationOffsetDb === 'number';
  const adj = (v: number) => Math.round((v + offset) * 10) / 10;

  return {
    laeq: adj(toDb(sumSquaresA / totalSamples)),
    lzeq: adj(toDb(sumSquaresZ / totalSamples)),
    lafMax: adj(fastLevels[fastLevels.length - 1] ?? LEVEL_FLOOR_DB),
    lafMin: adj(fastLevels[0] ?? LEVEL_FLOOR_DB),
    laf10: adj(levelExceeded(fastLevels, 10)),
    laf50: adj(levelExceeded(fastLevels, 50)),
    laf90: adj(levelExceeded(fastLevels, 90)),
    laf95: adj(levelExceeded(fastLevels, 95)),
    reference: calibrated ? 'dB_SPL' : 'dBFS',
    calibrationOffsetDb: offset,
    calibrated,
    weighting: 'A',
    timeWeighting: 'F',
    sampleRate,
    windowMs,
    durationMs: Math.round((totalSamples / sampleRate) * 1000),
    computedFromOriginal: options.computedFromOriginal ?? true,
  };
}
