export interface HighPassFilterState {
  previousInput: number;
  previousOutput: number;
}

export interface AudioLevelStats {
  rms: number;
  peak: number;
  mean: number;
}

export function computeAudioLevelStats(samples: Float32Array): AudioLevelStats {
  let sum = 0;
  let sumSquares = 0;
  let peak = 0;
  for (let index = 0; index < samples.length; index++) {
    const value = samples[index];
    sum += value;
    sumSquares += value * value;
    peak = Math.max(peak, Math.abs(value));
  }

  return {
    rms: Math.sqrt(sumSquares / Math.max(1, samples.length)),
    peak,
    mean: sum / Math.max(1, samples.length),
  };
}

export function applyHighPassFilter(
  samples: Float32Array,
  sampleRate: number,
  cutoffHz: number,
  state: HighPassFilterState
): Float32Array {
  if (cutoffHz <= 0) {
    return new Float32Array(samples);
  }

  const dt = 1 / sampleRate;
  const rc = 1 / (2 * Math.PI * cutoffHz);
  const alpha = rc / (rc + dt);
  const filtered = new Float32Array(samples.length);

  let previousInput = state.previousInput;
  let previousOutput = state.previousOutput;

  for (let index = 0; index < samples.length; index++) {
    const input = samples[index];
    const output = alpha * (previousOutput + input - previousInput);
    filtered[index] = output;
    previousInput = input;
    previousOutput = output;
  }

  state.previousInput = previousInput;
  state.previousOutput = previousOutput;
  return filtered;
}

export function probabilityToLogit(probability: number): number {
  const epsilon = 1e-8;
  const clipped = Math.min(1 - epsilon, Math.max(epsilon, probability));
  return Math.log(clipped / (1 - clipped));
}

export function logitToProbability(logit: number): number {
  return 1 / (1 + Math.exp(-logit));
}

export function logMeanExpPoolScores(history: Float32Array[]): Float32Array {
  if (history.length === 0) {
    return new Float32Array(0);
  }

  if (history.length === 1) {
    return new Float32Array(history[0]);
  }

  const scoreCount = history[0].length;
  const pooled = new Float32Array(scoreCount);

  for (let classIndex = 0; classIndex < scoreCount; classIndex++) {
    let maxLogit = Number.NEGATIVE_INFINITY;
    const logits = new Float32Array(history.length);
    for (let historyIndex = 0; historyIndex < history.length; historyIndex++) {
      const logit = probabilityToLogit(history[historyIndex][classIndex]);
      logits[historyIndex] = logit;
      maxLogit = Math.max(maxLogit, logit);
    }

    let sumExp = 0;
    for (let historyIndex = 0; historyIndex < logits.length; historyIndex++) {
      sumExp += Math.exp(logits[historyIndex] - maxLogit);
    }

    pooled[classIndex] = logitToProbability(
      maxLogit + Math.log(sumExp / Math.max(1, logits.length))
    );
  }

  return pooled;
}
