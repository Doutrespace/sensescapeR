import {
  buildMelFilterBank,
  checksumMelBands,
  computeMelBandDb,
  computePowerSpectrum,
  createHannWindow,
  findDominantBin,
  updateAgcBounds,
} from './spectrogramProcessing';

function createSineWave(size: number, sampleRate: number, frequency: number): Float32Array {
  const samples = new Float32Array(size);
  for (let index = 0; index < size; index++) {
    samples[index] = Math.sin((2 * Math.PI * frequency * index) / sampleRate);
  }
  return samples;
}

describe('spectrogramProcessing', () => {
  it('finds the dominant FFT bin for a known tone', () => {
    const sampleRate = 48000;
    const fftSize = 2048;
    const window = createHannWindow(fftSize);
    const tone = createSineWave(fftSize, sampleRate, 1000);
    const spectrum = computePowerSpectrum(tone, window);
    const dominantBin = findDominantBin(spectrum);
    const dominantFrequency = (dominantBin * sampleRate) / fftSize;

    expect(dominantFrequency).toBeGreaterThan(900);
    expect(dominantFrequency).toBeLessThan(1100);
  });

  it('produces different mel checksums for silence and tone', () => {
    const sampleRate = 48000;
    const fftSize = 2048;
    const window = createHannWindow(fftSize);
    const melFilters = buildMelFilterBank(sampleRate, fftSize, 128, 40, 8000);
    const silence = new Float32Array(fftSize);
    const tone = createSineWave(fftSize, sampleRate, 1000);

    const silenceMel = computeMelBandDb(
      computePowerSpectrum(silence, window),
      melFilters,
      -100,
      0
    );
    const toneMel = computeMelBandDb(
      computePowerSpectrum(tone, window),
      melFilters,
      -100,
      0
    );

    expect(checksumMelBands(silenceMel)).not.toEqual(checksumMelBands(toneMel));
  });

  it('releases AGC slowly instead of resetting per frame', () => {
    const initial = updateAgcBounds(null, -22, 0, {
      floorDb: -100,
      ceilDb: 0,
      windowDb: 80,
      headroomDb: 6,
      releaseDbPerSecond: 10,
    });
    const released = updateAgcBounds(initial.topDb, -60, 100, {
      floorDb: -100,
      ceilDb: 0,
      windowDb: 80,
      headroomDb: 6,
      releaseDbPerSecond: 10,
    });

    expect(initial.topDb).toBeCloseTo(-16, 0);
    expect(released.topDb).toBeGreaterThan(-25);
    expect(released.floorDb).toBeCloseTo(released.topDb - 80, 5);
  });
});
