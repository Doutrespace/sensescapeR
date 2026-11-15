import { useRef, useCallback, useEffect, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { AudioAnalyzer, AudioFrameEvent } from '../services/audio/audioAnalyzer';
import { LoggingService } from '../services/logging/LoggingService';
import {
  dbToNormalizedAmplitude,
  getColorLookupTable,
} from '../utils/colorMapping';
import {
  buildMelFilterBank,
  checksumMelBands,
  computeMelBandDb,
  computePowerSpectrum,
  createHannWindow,
  updateAgcBounds,
} from '../utils/spectrogramProcessing';
import { applyHighPassFilter } from '../utils/audioInference';

const DEFAULT_WIDTH = 256;
const DEFAULT_HEIGHT = 512;
const MAX_FREQUENCY = 8000;
const SAMPLE_RATE = 48000;
const FFT_SIZE = 2048;
const RECORDER_HOP_SAMPLES = 512;
const TARGET_FPS = SAMPLE_RATE / RECORDER_HOP_SAMPLES;
const MEL_BAND_COUNT = 128;
const MEL_MIN_HZ = 40;
const RUMBLE_FILTER_HZ = 200;
const AGC_WINDOW_DB = 80;
const AGC_HEADROOM_DB = 6;
const AGC_RELEASE_DB_PER_SECOND = 10;
const DISPLAY_GAMMA = 0.9;
const EPSILON = 1e-12;
const DIAGNOSTIC_LOG_INTERVAL_MS = 1000;
const RAW_DB_FLOOR = -100;
const RAW_DB_CEIL = 0;

export interface SpectrogramFrameDiagnostics {
  frameIndex: number;
  melChecksum: string;
  hopMs: number;
  repeatedFrame: boolean;
  repeatedFrameStreak: number;
  avgBandDeltaDb: number;
  maxBandDeltaDb: number;
  agcTopDb: number;
  agcFloorDb: number;
  rawRms: number;
  rawPeak: number;
  rawMean: number;
  targetFps: number;
}

export interface SpectrogramData {
  width: number;
  height: number;
  pixels: Uint8Array;
  timestamp: number;
  diagnostics: SpectrogramFrameDiagnostics;
}

export interface UseSpectrogramDataOptions {
  width?: number;
  height?: number;
  maxFrequency?: number;
  enabled?: boolean;
}

export interface UseSpectrogramDataReturn {
  spectrogramData: SpectrogramData | null;
  isActive: boolean;
  analyzer: AudioAnalyzer | null;
  start: () => Promise<AudioAnalyzer | null>;
  stop: () => void;
  getPixelData: () => Uint8Array | null;
}

export function useSpectrogramData(
  options: UseSpectrogramDataOptions = {}
): UseSpectrogramDataReturn {
  const {
    width = DEFAULT_WIDTH,
    height = DEFAULT_HEIGHT,
    maxFrequency = MAX_FREQUENCY,
    enabled = true,
  } = options;

  const [isActive, setIsActive] = useState(false);
  const [timestamp, setTimestamp] = useState(0);

  const analyzerRef = useRef<AudioAnalyzer | null>(null);
  const enabledRef = useRef(enabled);
  const pixelBufferRef = useRef<Uint8Array | null>(null);
  const audioFrameUnsubscribeRef = useRef<(() => void) | null>(null);
  const processFrameRef = useRef<(event?: AudioFrameEvent) => void>(() => {});
  const latestAudioFrameRef = useRef<AudioFrameEvent | null>(null);
  const pcmRingBufferRef = useRef(new Float32Array(FFT_SIZE));
  const pcmWriteIndexRef = useRef(0);
  const pcmBufferedSamplesRef = useRef(0);
  const highPassStateRef = useRef({ previousInput: 0, previousOutput: 0 });
  const hannWindowRef = useRef<Float32Array | null>(null);
  const melFilterBankRef = useRef<ReturnType<typeof buildMelFilterBank> | null>(null);
  const previousMelBandDbRef = useRef<Float32Array | null>(null);
  const lastMelChecksumRef = useRef<string | null>(null);
  const lastProcessedAtRef = useRef<number | null>(null);
  const repeatedFrameStreakRef = useRef(0);
  const agcPeakDbRef = useRef<number | null>(null);
  const frameIndexRef = useRef(0);
  const lastDiagnosticLogAtRef = useRef(0);
  const latestDiagnosticsRef = useRef<SpectrogramFrameDiagnostics>({
    frameIndex: 0,
    melChecksum: '00000000',
    hopMs: 0,
    repeatedFrame: false,
    repeatedFrameStreak: 0,
    avgBandDeltaDb: 0,
    maxBandDeltaDb: 0,
    agcTopDb: RAW_DB_CEIL,
    agcFloorDb: RAW_DB_CEIL - AGC_WINDOW_DB,
    rawRms: 0,
    rawPeak: 0,
    rawMean: 0,
    targetFps: TARGET_FPS,
  });

  const initializeBuffers = useCallback(() => {
    pixelBufferRef.current = new Uint8Array(width * height * 4);
    pcmRingBufferRef.current.fill(0);
    pcmWriteIndexRef.current = 0;
    pcmBufferedSamplesRef.current = 0;
    highPassStateRef.current = { previousInput: 0, previousOutput: 0 };
    hannWindowRef.current = createHannWindow(FFT_SIZE);
    melFilterBankRef.current = null;
    previousMelBandDbRef.current = null;
    lastMelChecksumRef.current = null;
    lastProcessedAtRef.current = null;
    repeatedFrameStreakRef.current = 0;
    agcPeakDbRef.current = null;
    frameIndexRef.current = 0;
    latestAudioFrameRef.current = null;
    lastDiagnosticLogAtRef.current = 0;
    latestDiagnosticsRef.current = {
      frameIndex: 0,
      melChecksum: '00000000',
      hopMs: 0,
      repeatedFrame: false,
      repeatedFrameStreak: 0,
      avgBandDeltaDb: 0,
      maxBandDeltaDb: 0,
      agcTopDb: RAW_DB_CEIL,
      agcFloorDb: RAW_DB_CEIL - AGC_WINDOW_DB,
      rawRms: 0,
      rawPeak: 0,
      rawMean: 0,
      targetFps: TARGET_FPS,
    };

    const table = getColorLookupTable();
    const backgroundR = table[0];
    const backgroundG = table[1];
    const backgroundB = table[2];

    for (let offset = 0; offset < pixelBufferRef.current.length; offset += 4) {
      pixelBufferRef.current[offset] = backgroundR;
      pixelBufferRef.current[offset + 1] = backgroundG;
      pixelBufferRef.current[offset + 2] = backgroundB;
      pixelBufferRef.current[offset + 3] = 255;
    }
  }, [width, height]);

  useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);

  const getLatestPcmWindow = useCallback((): Float32Array | null => {
    if (pcmBufferedSamplesRef.current < FFT_SIZE) {
      return null;
    }

    const ring = pcmRingBufferRef.current;
    const writeIndex = pcmWriteIndexRef.current;
    const window = new Float32Array(FFT_SIZE);
    const tailLength = FFT_SIZE - writeIndex;
    window.set(ring.subarray(writeIndex), 0);
    window.set(ring.subarray(0, writeIndex), tailLength);
    return window;
  }, []);

  const processFrame = useCallback((audioFrame?: AudioFrameEvent) => {
    if (!analyzerRef.current || !pixelBufferRef.current || !audioFrame) {
      return;
    }

    const filteredSamples = applyHighPassFilter(
      audioFrame.samples,
      audioFrame.sampleRate,
      RUMBLE_FILTER_HZ,
      highPassStateRef.current
    );

    for (let index = 0; index < filteredSamples.length; index++) {
      pcmRingBufferRef.current[pcmWriteIndexRef.current] = filteredSamples[index];
      pcmWriteIndexRef.current = (pcmWriteIndexRef.current + 1) % FFT_SIZE;
      pcmBufferedSamplesRef.current = Math.min(FFT_SIZE, pcmBufferedSamplesRef.current + 1);
    }

    const pcmWindow = getLatestPcmWindow();
    if (!pcmWindow) {
      return;
    }

    if (!hannWindowRef.current) {
      hannWindowRef.current = createHannWindow(FFT_SIZE);
    }

    if (!melFilterBankRef.current) {
      melFilterBankRef.current = buildMelFilterBank(
        analyzerRef.current.sampleRate,
        FFT_SIZE,
        MEL_BAND_COUNT,
        MEL_MIN_HZ,
        maxFrequency
      );
    }

    const table = getColorLookupTable();
    const pixels = pixelBufferRef.current;
    const pixels32 = new Uint32Array(pixels.buffer);
    for (let y = 0; y < height; y++) {
      const rowStart = y * width;
      pixels32.copyWithin(rowStart, rowStart + 1, rowStart + width);
    }

    const powerSpectrum = computePowerSpectrum(pcmWindow, hannWindowRef.current);
    const melBandDb = computeMelBandDb(
      powerSpectrum,
      melFilterBankRef.current,
      RAW_DB_FLOOR,
      RAW_DB_CEIL,
      EPSILON
    );

    let framePeakDb = RAW_DB_FLOOR + AGC_WINDOW_DB;
    for (let bandIndex = 0; bandIndex < MEL_BAND_COUNT; bandIndex++) {
      framePeakDb = Math.max(framePeakDb, melBandDb[bandIndex]);
    }

    const now = performance.now();
    const hopMs = lastProcessedAtRef.current == null ? 0 : now - lastProcessedAtRef.current;
    lastProcessedAtRef.current = now;

    const { topDb: agcTopDb, floorDb: agcFloorDb } = updateAgcBounds(
      agcPeakDbRef.current,
      framePeakDb,
      hopMs,
      {
        floorDb: RAW_DB_FLOOR,
        ceilDb: RAW_DB_CEIL,
        windowDb: AGC_WINDOW_DB,
        headroomDb: AGC_HEADROOM_DB,
        releaseDbPerSecond: AGC_RELEASE_DB_PER_SECOND,
      }
    );
    agcPeakDbRef.current = agcTopDb;

    const lastColumn = width - 1;
    for (let y = 0; y < height; y++) {
      const normalizedY = (height - 1 - y) / Math.max(1, height - 1);
      const melPosition = normalizedY * (MEL_BAND_COUNT - 1);
      const lowerBand = Math.floor(melPosition);
      const upperBand = Math.min(MEL_BAND_COUNT - 1, lowerBand + 1);
      const blend = melPosition - lowerBand;
      const bandDb =
        melBandDb[lowerBand] + (melBandDb[upperBand] - melBandDb[lowerBand]) * blend;
      const normalized = dbToNormalizedAmplitude(bandDb, agcFloorDb, agcTopDb);
      const colorIndex = Math.round(Math.pow(normalized, DISPLAY_GAMMA) * 255);
      const colorOffset = colorIndex * 4;
      const pixelOffset = (y * width + lastColumn) * 4;
      pixels[pixelOffset] = table[colorOffset];
      pixels[pixelOffset + 1] = table[colorOffset + 1];
      pixels[pixelOffset + 2] = table[colorOffset + 2];
      pixels[pixelOffset + 3] = 255;
    }

    const previousMelBandDb = previousMelBandDbRef.current;
    let totalDeltaDb = 0;
    let maxDeltaDb = 0;
    for (let bandIndex = 0; bandIndex < MEL_BAND_COUNT; bandIndex++) {
      if (previousMelBandDb) {
        const deltaDb = Math.abs(melBandDb[bandIndex] - previousMelBandDb[bandIndex]);
        totalDeltaDb += deltaDb;
        maxDeltaDb = Math.max(maxDeltaDb, deltaDb);
      }
    }
    previousMelBandDbRef.current = new Float32Array(melBandDb);

    const melChecksum = checksumMelBands(melBandDb);
    const repeatedFrame = lastMelChecksumRef.current === melChecksum;
    lastMelChecksumRef.current = melChecksum;
    repeatedFrameStreakRef.current = repeatedFrame ? repeatedFrameStreakRef.current + 1 : 0;

    frameIndexRef.current += 1;
    latestDiagnosticsRef.current = {
      frameIndex: frameIndexRef.current,
      melChecksum,
      hopMs,
      repeatedFrame,
      repeatedFrameStreak: repeatedFrameStreakRef.current,
      avgBandDeltaDb: previousMelBandDb ? totalDeltaDb / MEL_BAND_COUNT : 0,
      maxBandDeltaDb: maxDeltaDb,
      agcTopDb,
      agcFloorDb,
      rawRms: audioFrame?.rms ?? latestAudioFrameRef.current?.rms ?? 0,
      rawPeak: audioFrame?.peak ?? latestAudioFrameRef.current?.peak ?? 0,
      rawMean: audioFrame?.mean ?? latestAudioFrameRef.current?.mean ?? 0,
      targetFps: TARGET_FPS,
    };

    if (
      __DEV__
      && LoggingService.getDebugEnabled()
      && Date.now() - lastDiagnosticLogAtRef.current >= DIAGNOSTIC_LOG_INTERVAL_MS
    ) {
      lastDiagnosticLogAtRef.current = Date.now();
      const diagnostics = latestDiagnosticsRef.current;
      LoggingService.debug('Spectrogram frame diagnostics', { ...diagnostics });
    }

    setTimestamp(Date.now());
  }, [height, maxFrequency, width]);

  processFrameRef.current = processFrame;

  const start = useCallback(async (): Promise<AudioAnalyzer | null> => {
    if (isActive) {
      return analyzerRef.current;
    }

    const analyzer = new AudioAnalyzer();
    const initialized = await analyzer.initialize({
      fftSize: FFT_SIZE,
      smoothingTimeConstant: 0.2,
      sampleRate: SAMPLE_RATE,
      recorderBufferLengthInSamples: RECORDER_HOP_SAMPLES,
      minDecibels: RAW_DB_FLOOR,
      maxDecibels: RAW_DB_CEIL,
    });

    if (!initialized) {
      LoggingService.error('Failed to initialize spectrogram analyzer');
      return null;
    }

    initializeBuffers();
    analyzerRef.current = analyzer;
    audioFrameUnsubscribeRef.current = analyzer.addAudioFrameListener((event) => {
      latestAudioFrameRef.current = event;
      if (enabledRef.current) {
        processFrameRef.current(event);
      }
    });
    setIsActive(true);
    return analyzer;
  }, [initializeBuffers, isActive]);

  const stop = useCallback(() => {
    if (audioFrameUnsubscribeRef.current) {
      audioFrameUnsubscribeRef.current();
      audioFrameUnsubscribeRef.current = null;
    }

    if (analyzerRef.current) {
      analyzerRef.current.cleanup();
      analyzerRef.current = null;
    }

    setIsActive(false);
  }, []);

  const getPixelData = useCallback((): Uint8Array | null => (
    pixelBufferRef.current ? new Uint8Array(pixelBufferRef.current) : null
  ), []);

  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState === 'background' && analyzerRef.current) {
        analyzerRef.current.pause();
      } else if (nextAppState === 'active' && analyzerRef.current) {
        analyzerRef.current.resume();
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, []);

  useEffect(() => stop, [stop]);

  const spectrogramData: SpectrogramData | null = pixelBufferRef.current
    ? {
      width,
      height,
      pixels: pixelBufferRef.current,
      timestamp,
      diagnostics: latestDiagnosticsRef.current,
    }
    : null;

  return {
    spectrogramData,
    isActive,
    analyzer: analyzerRef.current,
    start,
    stop,
    getPixelData,
  };
}
