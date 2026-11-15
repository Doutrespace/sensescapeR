// Spectrogram color gradient matching app theme
// Maps amplitude (0-255) to RGBA colors

export const SPECTROGRAM_DB_FLOOR = -80;
export const SPECTROGRAM_DB_CEIL = 0;

interface ColorStop {
  threshold: number;
  r: number;
  g: number;
  b: number;
}

// Color gradient for spectrogram visualization
// Magma-inspired: deep purple (silent) -> magenta -> orange -> yellow (clipping)
const SPECTROGRAM_GRADIENT: ColorStop[] = [
  // Approximate stops from matplotlib's magma colormap
  { threshold: 0, r: 10, g: 0, b: 30 }, // very dark purple
  { threshold: 64, r: 78, g: 18, b: 103 }, // deep violet
  { threshold: 128, r: 181, g: 54, b: 121 }, // magenta
  { threshold: 192, r: 249, g: 109, b: 87 }, // bright orange
  { threshold: 255, r: 252, g: 253, b: 191 }, // pale yellow (high energy)
];

// Pre-computed lookup table for fast color mapping
let colorLookupTable: Uint8Array | null = null;

function buildColorLookupTable(): Uint8Array {
  const table = new Uint8Array(256 * 4); // RGBA for each of 256 values

  for (let amplitude = 0; amplitude < 256; amplitude++) {
    const { r, g, b } = interpolateColor(amplitude);
    const offset = amplitude * 4;
    table[offset] = r;
    table[offset + 1] = g;
    table[offset + 2] = b;
    table[offset + 3] = 255; // Full opacity
  }

  return table;
}

function interpolateColor(amplitude: number): { r: number; g: number; b: number } {
  // Find the two color stops to interpolate between
  let lowerStop = SPECTROGRAM_GRADIENT[0];
  let upperStop = SPECTROGRAM_GRADIENT[SPECTROGRAM_GRADIENT.length - 1];

  for (let i = 0; i < SPECTROGRAM_GRADIENT.length - 1; i++) {
    if (amplitude >= SPECTROGRAM_GRADIENT[i].threshold &&
      amplitude < SPECTROGRAM_GRADIENT[i + 1].threshold) {
      lowerStop = SPECTROGRAM_GRADIENT[i];
      upperStop = SPECTROGRAM_GRADIENT[i + 1];
      break;
    }
  }

  // Calculate interpolation factor
  const range = upperStop.threshold - lowerStop.threshold;
  const factor = range > 0 ? (amplitude - lowerStop.threshold) / range : 0;

  // Linear interpolation between colors
  return {
    r: Math.round(lowerStop.r + (upperStop.r - lowerStop.r) * factor),
    g: Math.round(lowerStop.g + (upperStop.g - lowerStop.g) * factor),
    b: Math.round(lowerStop.b + (upperStop.b - lowerStop.b) * factor),
  };
}

// Get the color lookup table (lazy initialization)
export function getColorLookupTable(): Uint8Array {
  if (!colorLookupTable) {
    colorLookupTable = buildColorLookupTable();
  }
  return colorLookupTable;
}

export function clampDecibels(
  value: number,
  floor: number = SPECTROGRAM_DB_FLOOR,
  ceil: number = SPECTROGRAM_DB_CEIL
): number {
  return Math.min(ceil, Math.max(floor, value));
}

export function dbToNormalizedAmplitude(
  value: number,
  floor: number = SPECTROGRAM_DB_FLOOR,
  ceil: number = SPECTROGRAM_DB_CEIL
): number {
  const clamped = clampDecibels(value, floor, ceil);
  return (clamped - floor) / Math.max(1e-6, ceil - floor);
}

export function dbToColorIndex(
  value: number,
  floor: number = SPECTROGRAM_DB_FLOOR,
  ceil: number = SPECTROGRAM_DB_CEIL
): number {
  return Math.round(dbToNormalizedAmplitude(value, floor, ceil) * 255);
}

// Convert amplitude (0-255) to RGBA using the lookup table
export function amplitudeToRGBA(amplitude: number): [number, number, number, number] {
  const table = getColorLookupTable();
  const offset = Math.min(255, Math.max(0, amplitude)) * 4;
  return [
    table[offset],
    table[offset + 1],
    table[offset + 2],
    table[offset + 3],
  ];
}

// Convert amplitude to hex color string
export function amplitudeToHex(amplitude: number): string {
  const [r, g, b] = amplitudeToRGBA(amplitude);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

// Fill a pixel buffer with colors for a frequency data column
export function fillColumnPixels(
  frequencyData: Uint8Array,
  pixelBuffer: Uint8Array,
  columnIndex: number,
  width: number,
  height: number,
  maxBins: number = height
): void {
  const table = getColorLookupTable();
  const binsToUse = Math.min(frequencyData.length, maxBins);
  const binHeight = height / binsToUse;

  for (let bin = 0; bin < binsToUse; bin++) {
    const amplitude = frequencyData[bin];
    const colorOffset = amplitude * 4;

    // Flip Y axis (low frequencies at bottom)
    const y = height - 1 - Math.floor(bin * binHeight);
    const pixelOffset = (y * width + columnIndex) * 4;

    pixelBuffer[pixelOffset] = table[colorOffset];
    pixelBuffer[pixelOffset + 1] = table[colorOffset + 1];
    pixelBuffer[pixelOffset + 2] = table[colorOffset + 2];
    pixelBuffer[pixelOffset + 3] = table[colorOffset + 3];
  }
}

// Create a color scale legend (useful for UI display)
export function getColorScaleStops(): Array<{ position: number; color: string }> {
  return SPECTROGRAM_GRADIENT.map((stop) => ({
    position: stop.threshold / 255,
    color: `rgb(${stop.r}, ${stop.g}, ${stop.b})`,
  }));
}

// Frequency to Y position mapping helper
export function frequencyToY(frequency: number, maxFrequency: number, height: number): number {
  // Logarithmic scale for frequency (more resolution at lower frequencies)
  const minFreq = 20; // Minimum displayable frequency
  const logMin = Math.log10(minFreq);
  const logMax = Math.log10(maxFrequency);
  const logFreq = Math.log10(Math.max(minFreq, frequency));

  const normalized = (logFreq - logMin) / (logMax - logMin);
  return height - 1 - Math.floor(normalized * (height - 1));
}

// Linear frequency to Y position (simpler alternative)
export function frequencyToYLinear(frequency: number, maxFrequency: number, height: number): number {
  const normalized = Math.min(1, frequency / maxFrequency);
  return height - 1 - Math.floor(normalized * (height - 1));
}
