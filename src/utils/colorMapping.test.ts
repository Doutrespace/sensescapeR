import {
  amplitudeToRGBA,
  amplitudeToHex,
  clampDecibels,
  dbToColorIndex,
  dbToNormalizedAmplitude,
  getColorScaleStops,
  frequencyToY,
  frequencyToYLinear,
} from './colorMapping';

describe('colorMapping utilities', () => {
  it('maps amplitude to RGBA with clamping', () => {
    const low = amplitudeToRGBA(-10);
    const mid = amplitudeToRGBA(128);
    const high = amplitudeToRGBA(300);

    expect(low[3]).toBe(255);
    expect(high[3]).toBe(255);
    expect(low[0]).toBeGreaterThanOrEqual(0);
    expect(low[0]).toBeLessThanOrEqual(255);
    expect(mid[0]).toBeGreaterThanOrEqual(0);
    expect(mid[0]).toBeLessThanOrEqual(255);
  });

  it('maps amplitude to hex string', () => {
    const hex = amplitudeToHex(128);
    expect(hex).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it('maps dB values with a fixed clamp before color lookup', () => {
    expect(clampDecibels(-120)).toBe(-80);
    expect(clampDecibels(6)).toBe(0);
    expect(dbToNormalizedAmplitude(-80)).toBe(0);
    expect(dbToNormalizedAmplitude(0)).toBe(1);
    expect(dbToColorIndex(-80)).toBe(0);
    expect(dbToColorIndex(0)).toBe(255);
  });

  it('returns ordered color scale stops between 0 and 1', () => {
    const stops = getColorScaleStops();
    expect(stops.length).toBeGreaterThan(0);
    stops.forEach((stop) => {
      expect(stop.position).toBeGreaterThanOrEqual(0);
      expect(stop.position).toBeLessThanOrEqual(1);
      expect(stop.color).toMatch(/^rgb\(/);
    });
  });

  it('maps frequency to Y within bounds (log scale)', () => {
    const height = 256;
    const maxFrequency = 20000;
    const yLow = frequencyToY(50, maxFrequency, height);
    const yHigh = frequencyToY(15000, maxFrequency, height);

    expect(yLow).toBeGreaterThanOrEqual(0);
    expect(yLow).toBeLessThan(height);
    expect(yHigh).toBeGreaterThanOrEqual(0);
    expect(yHigh).toBeLessThan(height);
  });

  it('maps frequency to Y within bounds (linear scale)', () => {
    const height = 256;
    const maxFrequency = 20000;
    const yLow = frequencyToYLinear(50, maxFrequency, height);
    const yHigh = frequencyToYLinear(15000, maxFrequency, height);

    expect(yLow).toBeGreaterThanOrEqual(0);
    expect(yLow).toBeLessThan(height);
    expect(yHigh).toBeGreaterThanOrEqual(0);
    expect(yHigh).toBeLessThan(height);
  });
});
