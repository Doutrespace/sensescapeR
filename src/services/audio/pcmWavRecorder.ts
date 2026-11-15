import { Directory, File, Paths } from 'expo-file-system';
import { AudioAnalyzer, AudioFrameEvent } from './audioAnalyzer';
import { computeAcousticMetrics, type AcousticMetrics } from './acousticMetrics';
import type { AudioLevelingMode } from '../../stores/usePreferencesStore';

const RECORDINGS_DIRNAME = 'recordings';

// Normalization thresholds - RMS-based for scientific accuracy
// Normalization triggers when RMS is below this threshold
const QUIET_RMS_THRESHOLD_DB = -28;

// Target levels for normalization
const TARGET_RMS_DB = -20;
const TARGET_PEAK_DB = -3;

// Tiered max gain based on how quiet the recording is
// This ensures very quiet recordings get adequate boost while
// limiting gain for moderately quiet ones to avoid noise amplification
const GAIN_TIERS = [
  { rmsThreshold: -55, maxGain: 32 },  // Very quiet: up to +30 dB
  { rmsThreshold: -45, maxGain: 18 },  // Quiet: up to +25 dB
  { rmsThreshold: -35, maxGain: 10 },  // Moderately quiet: up to +20 dB
  { rmsThreshold: -28, maxGain: 6 },   // Slightly quiet: up to +15.5 dB
];

function getMaxGainForLevel(rmsDb: number): number {
  for (const tier of GAIN_TIERS) {
    if (rmsDb < tier.rmsThreshold) {
      return tier.maxGain;
    }
  }
  return 6; // Default fallback
}

export interface PcmRecordingStats {
  durationMs: number;
  sampleRate: number;
  totalSamples: number;
  latestRms: number;
  latestPeak: number;
}

export interface PcmRecordingResult {
  uri: string;
  durationMs: number;
  sampleRate: number;
  totalSamples: number;
  // Normalization metadata for scientific traceability
  normalizationApplied: boolean;
  normalizationGain: number | null;  // Linear gain multiplier (e.g., 6 = +15.5 dB)
  // Original levels BEFORE normalization (for scientific analysis)
  originalPeakDb: number;
  originalRmsDb: number;
  // IEC-weighted acoustic metrics, always computed from the original
  // (pre-normalization) samples. Null when there is no audio.
  acousticMetrics: AcousticMetrics | null;
}

function floatToInt16Sample(value: number): number {
  const clamped = Math.max(-1, Math.min(1, value));
  return clamped < 0
    ? Math.round(clamped * 0x8000)
    : Math.round(clamped * 0x7fff);
}

function createWavBytes(
  chunks: Int16Array[],
  totalSamples: number,
  sampleRate: number,
  channelCount: number
): Uint8Array {
  const bytesPerSample = 2;
  const dataBytes = totalSamples * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataBytes);
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);

  const writeAscii = (offset: number, value: string) => {
    for (let index = 0; index < value.length; index++) {
      view.setUint8(offset + index, value.charCodeAt(index));
    }
  };

  writeAscii(0, 'RIFF');
  view.setUint32(4, 36 + dataBytes, true);
  writeAscii(8, 'WAVE');
  writeAscii(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channelCount, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * channelCount * bytesPerSample, true);
  view.setUint16(32, channelCount * bytesPerSample, true);
  view.setUint16(34, bytesPerSample * 8, true);
  writeAscii(36, 'data');
  view.setUint32(40, dataBytes, true);

  let byteOffset = 44;
  for (const chunk of chunks) {
    for (let sampleIndex = 0; sampleIndex < chunk.length; sampleIndex++) {
      view.setInt16(byteOffset, chunk[sampleIndex], true);
      byteOffset += bytesPerSample;
    }
  }

  return bytes;
}

function linearToDbfs(value: number): number {
  return 20 * Math.log10(Math.max(value, 1e-6));
}

function analyzeChunks(chunks: Int16Array[]): {
  peakLinear: number;
  rmsLinear: number;
  peakDb: number;
  rmsDb: number;
} {
  let peakLinear = 0;
  let sumSquares = 0;
  let totalSamples = 0;

  for (const chunk of chunks) {
    for (let index = 0; index < chunk.length; index++) {
      const sample = chunk[index] / 0x7fff;
      const magnitude = Math.abs(sample);
      peakLinear = Math.max(peakLinear, magnitude);
      sumSquares += sample * sample;
      totalSamples++;
    }
  }

  const rmsLinear = totalSamples > 0
    ? Math.sqrt(sumSquares / totalSamples)
    : 0;

  return {
    peakLinear,
    rmsLinear,
    peakDb: linearToDbfs(peakLinear),
    rmsDb: linearToDbfs(rmsLinear),
  };
}

function normalizeChunks(chunks: Int16Array[]): {
  chunks: Int16Array[];
  appliedGain: number;
  peakDbBefore: number;
  rmsDbBefore: number;
} {
  const analysis = analyzeChunks(chunks);

  // Skip normalization if:
  // - No audio data (peak is 0)
  // - RMS level is already adequate (above threshold)
  // This is RMS-based only - we normalize quiet recordings regardless of peak
  if (analysis.peakLinear <= 0 || analysis.rmsDb > QUIET_RMS_THRESHOLD_DB) {
    return {
      chunks,
      appliedGain: 1,
      peakDbBefore: analysis.peakDb,
      rmsDbBefore: analysis.rmsDb,
    };
  }

  // Get tiered max gain based on how quiet the recording is
  const maxGain = getMaxGainForLevel(analysis.rmsDb);

  // Calculate gain needed to reach target RMS
  const targetRmsLinear = Math.pow(10, TARGET_RMS_DB / 20);
  const gainToRms = targetRmsLinear / Math.max(analysis.rmsLinear, 1e-6);

  // Calculate gain that would push peaks to target (to avoid clipping)
  const targetPeakLinear = Math.pow(10, TARGET_PEAK_DB / 20);
  const gainToPeak = targetPeakLinear / Math.max(analysis.peakLinear, 1e-6);

  // Apply the minimum of: RMS target gain, peak safety limit, tier max gain
  // This ensures we don't clip and don't over-amplify noise
  const appliedGain = Math.max(1, Math.min(maxGain, gainToPeak, gainToRms));

  if (appliedGain <= 1.01) {
    return {
      chunks,
      appliedGain: 1,
      peakDbBefore: analysis.peakDb,
      rmsDbBefore: analysis.rmsDb,
    };
  }

  // Apply linear gain - safe for classification models as it doesn't
  // alter spectral content, only uniform amplitude scaling
  const normalizedChunks = chunks.map((chunk) => {
    const nextChunk = new Int16Array(chunk.length);
    for (let index = 0; index < chunk.length; index++) {
      const scaled = Math.max(-1, Math.min(1, (chunk[index] / 0x7fff) * appliedGain));
      nextChunk[index] = floatToInt16Sample(scaled);
    }
    return nextChunk;
  });

  return {
    chunks: normalizedChunks,
    appliedGain,
    peakDbBefore: analysis.peakDb,
    rmsDbBefore: analysis.rmsDb,
  };
}

export class PcmWavRecorder {
  constructor(private readonly audioLevelingMode: AudioLevelingMode = 'playback') {}

  private unsubscribe: (() => void) | null = null;
  private readonly chunks: Int16Array[] = [];
  private totalSamples = 0;
  private sampleRate = 48000;
  private latestRms = 0;
  private latestPeak = 0;

  start(analyzer: AudioAnalyzer): void {
    if (this.unsubscribe) {
      throw new Error('PCM recorder already started');
    }

    this.sampleRate = analyzer.sampleRate;
    this.totalSamples = 0;
    this.latestRms = 0;
    this.latestPeak = 0;
    this.chunks.length = 0;

    this.unsubscribe = analyzer.addAudioFrameListener((event) => {
      this.handleAudioFrame(event);
    });
  }

  getStats(): PcmRecordingStats {
    return {
      durationMs: this.totalSamples === 0
        ? 0
        : (this.totalSamples / this.sampleRate) * 1000,
      sampleRate: this.sampleRate,
      totalSamples: this.totalSamples,
      latestRms: this.latestRms,
      latestPeak: this.latestPeak,
    };
  }

  async stop(): Promise<PcmRecordingResult> {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }

    const recordingsDir = new Directory(Paths.document, RECORDINGS_DIRNAME);
    if (!recordingsDir.exists) {
      recordingsDir.create();
    }

    // Always analyze original levels for scientific traceability
    const originalAnalysis = analyzeChunks(this.chunks);

    // IEC-weighted acoustic metrics (LAeq, percentiles, ...) are always derived
    // from the ORIGINAL samples, before any playback normalization, so they
    // reflect the true captured field level (in dBFS until calibrated).
    const acousticMetrics = computeAcousticMetrics(this.chunks, this.sampleRate, {
      computedFromOriginal: true,
    });

    // Apply normalization if enabled, otherwise use original chunks
    const normalized = this.audioLevelingMode === 'playback'
      ? normalizeChunks(this.chunks)
      : {
          chunks: this.chunks,
          appliedGain: 1,
          peakDbBefore: originalAnalysis.peakDb,
          rmsDbBefore: originalAnalysis.rmsDb,
        };

    const file = new File(recordingsDir, `recording_${Date.now()}.wav`);
    file.create();
    file.write(createWavBytes(normalized.chunks, this.totalSamples, this.sampleRate, 1));

    return {
      uri: file.uri,
      durationMs: this.totalSamples === 0
        ? 0
        : (this.totalSamples / this.sampleRate) * 1000,
      sampleRate: this.sampleRate,
      totalSamples: this.totalSamples,
      normalizationApplied: normalized.appliedGain > 1.01,
      normalizationGain: normalized.appliedGain > 1.01 ? normalized.appliedGain : null,
      originalPeakDb: normalized.peakDbBefore,
      originalRmsDb: normalized.rmsDbBefore,
      acousticMetrics,
    };
  }

  cancel(): void {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }

    this.chunks.length = 0;
    this.totalSamples = 0;
    this.latestRms = 0;
    this.latestPeak = 0;
  }

  private handleAudioFrame(event: AudioFrameEvent): void {
    const pcmChunk = new Int16Array(event.samples.length);
    for (let index = 0; index < event.samples.length; index++) {
      pcmChunk[index] = floatToInt16Sample(event.samples[index]);
    }

    this.chunks.push(pcmChunk);
    this.totalSamples += pcmChunk.length;
    this.sampleRate = event.sampleRate;
    this.latestRms = event.rms;
    this.latestPeak = event.peak;
  }
}
