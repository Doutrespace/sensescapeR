import { clampDecibels } from './colorMapping';

export interface MelFilter {
  startBin: number;
  weights: Float32Array;
}

export interface AgcConfig {
  floorDb: number;
  ceilDb: number;
  windowDb: number;
  headroomDb: number;
  releaseDbPerSecond: number;
}

export function hzToMel(hz: number): number {
  return 2595 * Math.log10(1 + hz / 700);
}

export function melToHz(mel: number): number {
  return 700 * (Math.pow(10, mel / 2595) - 1);
}

export function createHannWindow(size: number): Float32Array {
  const window = new Float32Array(size);
  for (let index = 0; index < size; index++) {
    window[index] = 0.5 - 0.5 * Math.cos((2 * Math.PI * index) / Math.max(1, size - 1));
  }
  return window;
}

export function buildMelFilterBank(
  sampleRate: number,
  fftSize: number,
  melBandCount: number,
  minFrequency: number,
  maxFrequency: number
): MelFilter[] {
  const frequencyBinCount = fftSize / 2;
  const nyquist = sampleRate / 2;
  const maxHz = Math.min(maxFrequency, nyquist);
  const melMin = hzToMel(minFrequency);
  const melMax = hzToMel(maxHz);
  const melPoints = Array.from({ length: melBandCount + 2 }, (_, index) => (
    melMin + ((melMax - melMin) * index) / (melBandCount + 1)
  ));
  const binPoints = melPoints.map((mel) => {
    const hz = melToHz(mel);
    return Math.max(
      0,
      Math.min(
        frequencyBinCount - 1,
        Math.round((hz / nyquist) * (frequencyBinCount - 1))
      )
    );
  });

  return Array.from({ length: melBandCount }, (_, bandIndex) => {
    const leftBin = binPoints[bandIndex];
    const centerBin = Math.max(leftBin + 1, binPoints[bandIndex + 1]);
    const rightBin = Math.max(centerBin + 1, binPoints[bandIndex + 2]);
    const startBin = Math.max(0, leftBin);
    const endBin = Math.min(frequencyBinCount - 1, rightBin);
    const weights = new Float32Array(endBin - startBin + 1);

    for (let bin = startBin; bin <= endBin; bin++) {
      let weight = 0;
      if (bin <= centerBin) {
        weight = (bin - leftBin) / Math.max(1, centerBin - leftBin);
      } else {
        weight = (rightBin - bin) / Math.max(1, rightBin - centerBin);
      }
      weights[bin - startBin] = Math.max(0, weight);
    }

    return { startBin, weights };
  });
}

function reverseBits(value: number, bits: number): number {
  let reversed = 0;
  for (let bit = 0; bit < bits; bit++) {
    reversed = (reversed << 1) | (value & 1);
    value >>= 1;
  }
  return reversed;
}

export function computePowerSpectrum(
  samples: Float32Array,
  window: Float32Array
): Float32Array {
  const size = samples.length;
  const bits = Math.round(Math.log2(size));
  const real = new Float32Array(size);
  const imag = new Float32Array(size);

  for (let index = 0; index < size; index++) {
    real[index] = samples[index] * window[index];
  }

  for (let index = 0; index < size; index++) {
    const reversed = reverseBits(index, bits);
    if (reversed > index) {
      const tempReal = real[index];
      real[index] = real[reversed];
      real[reversed] = tempReal;
    }
  }

  for (let blockSize = 2; blockSize <= size; blockSize <<= 1) {
    const halfBlock = blockSize >> 1;
    const delta = (-2 * Math.PI) / blockSize;
    for (let blockStart = 0; blockStart < size; blockStart += blockSize) {
      for (let offset = 0; offset < halfBlock; offset++) {
        const evenIndex = blockStart + offset;
        const oddIndex = evenIndex + halfBlock;
        const angle = delta * offset;
        const twiddleReal = Math.cos(angle);
        const twiddleImag = Math.sin(angle);
        const oddReal = real[oddIndex];
        const oddImag = imag[oddIndex];
        const tempReal = twiddleReal * oddReal - twiddleImag * oddImag;
        const tempImag = twiddleReal * oddImag + twiddleImag * oddReal;

        real[oddIndex] = real[evenIndex] - tempReal;
        imag[oddIndex] = imag[evenIndex] - tempImag;
        real[evenIndex] += tempReal;
        imag[evenIndex] += tempImag;
      }
    }
  }

  const powerSpectrum = new Float32Array(size / 2);
  for (let bin = 0; bin < powerSpectrum.length; bin++) {
    const scale = size * size;
    powerSpectrum[bin] = ((real[bin] * real[bin]) + (imag[bin] * imag[bin])) / scale;
  }
  return powerSpectrum;
}

export function computeMelBandDb(
  powerSpectrum: Float32Array,
  melFilterBank: MelFilter[],
  floorDb: number,
  ceilDb: number,
  epsilon = 1e-12
): Float32Array {
  const melBandDb = new Float32Array(melFilterBank.length);

  for (let bandIndex = 0; bandIndex < melFilterBank.length; bandIndex++) {
    const filter = melFilterBank[bandIndex];
    let weightedPower = epsilon;
    for (let weightIndex = 0; weightIndex < filter.weights.length; weightIndex++) {
      const weight = filter.weights[weightIndex];
      if (weight <= 0) {
        continue;
      }
      weightedPower += powerSpectrum[filter.startBin + weightIndex] * weight;
    }
    const rawDb = 10 * Math.log10(weightedPower + epsilon);
    melBandDb[bandIndex] = clampDecibels(rawDb, floorDb, ceilDb);
  }

  return melBandDb;
}

export function updateAgcBounds(
  previousTopDb: number | null,
  framePeakDb: number,
  hopMs: number,
  config: AgcConfig
): { topDb: number; floorDb: number } {
  const releaseDb = config.releaseDbPerSecond * (hopMs / 1000);
  const targetTopDb = clampDecibels(
    framePeakDb + config.headroomDb,
    config.floorDb + config.windowDb,
    config.ceilDb
  );
  const topDb = previousTopDb == null
    ? targetTopDb
    : Math.max(targetTopDb, previousTopDb - releaseDb);

  return {
    topDb,
    floorDb: topDb - config.windowDb,
  };
}

export function checksumMelBands(melBandDb: Float32Array): string {
  let checksum = 0x811c9dc5;
  for (let bandIndex = 0; bandIndex < melBandDb.length; bandIndex++) {
    const quantized = Math.round(melBandDb[bandIndex] * 4);
    checksum ^= quantized & 0xff;
    checksum = Math.imul(checksum, 0x01000193);
    checksum ^= (quantized >> 8) & 0xff;
    checksum = Math.imul(checksum, 0x01000193);
  }
  return (checksum >>> 0).toString(16).padStart(8, '0');
}

export function findDominantBin(powerSpectrum: Float32Array): number {
  let maxValue = Number.NEGATIVE_INFINITY;
  let maxIndex = 0;
  for (let index = 0; index < powerSpectrum.length; index++) {
    if (powerSpectrum[index] > maxValue) {
      maxValue = powerSpectrum[index];
      maxIndex = index;
    }
  }
  return maxIndex;
}
