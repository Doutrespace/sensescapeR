import { useRef, useCallback, useState, useEffect } from 'react';
import { loadTensorflowModel, TensorflowModel } from 'react-native-fast-tflite';
import { AudioAnalyzer, AudioFrameEvent } from '../services/audio/audioAnalyzer';
import { LoggingService } from '../services/logging';
import { YAMNET_CLASSES } from '../utils/yamnetClasses';
import {
  MacroClassification,
  buildRankedClassifications,
  buildMacroClassifications,
  getDisplayLabel,
  getMacroFamily,
  getMacroFamilyTheme,
  selectBroadDisplayClassifications,
  selectDetailedDisplayClassifications,
} from '../utils/audioClassification';
import {
  applyHighPassFilter,
  computeAudioLevelStats,
  logMeanExpPoolScores,
} from '../utils/audioInference';

const YAMNET_SAMPLE_RATE = 16000;
const YAMNET_INPUT_SAMPLES = 15600;
const YAMNET_HOP_SAMPLES = 7680;
const TEMPORAL_POOL_WINDOW = 7;
const MIN_CLASS_SCORE = 0.02;
const PCM_LOG_INTERVAL_MS = 1000;
const SILENCE_RMS_THRESHOLD = 0.0018;
const TARGET_INPUT_RMS = 0.06;
const MAX_INPUT_GAIN = 3;
const MIN_CONFIDENT_SCORE = 0.06;
const SESSION_MIN_SCORE = 0.08;
const SPEECH_CONFIDENT_SCORE = 0.1;
const LIVE_DISPLAY_MIN_SCORE = 0.05;
const SPARKLINE_POINTS = 12;
// Keep infrasonic handling noise down without stripping useful traffic/engine energy.
const RUMBLE_FILTER_HZ = 80;
const QUIET_FRAME_THRESHOLD = 0.0015;
const RESAMPLE_DECIMATION_FACTOR = 3;
const RESAMPLE_KERNEL = [0.05, 0.1, 0.2, 0.3, 0.2, 0.1, 0.05];

interface DownsampleState {
  carry: number[];
  phase: number;
}

function getClassificationKey(
  rawLabel: string,
  hierarchy: 'specific' | 'broad'
): string {
  return `${hierarchy}:${rawLabel}`;
}

export interface SoundClassification {
  rawLabel: string;
  label: string;
  hierarchy: 'specific' | 'broad';
  score: number;
  adjustedScore: number;
  occurrenceCount: number;
  emoji: string;
  macroFamily: string;
  accentColor: string;
  softAccentColor: string;
  trackColor: string;
  accentTextColor: string;
  sparkline: number[];
}

export interface AudioClassifierDiagnostics {
  rawRms: number;
  filteredRms: number;
  peak: number;
  appliedGain: number;
  quietFrameRatio: number;
  pooledFrames: number;
  rumbleFilterHz: number;
}

export interface UseAudioClassifierReturn {
  classifications: SoundClassification[];
  broadClassifications: SoundClassification[];
  macroClassifications: MacroClassification[];
  diagnostics: AudioClassifierDiagnostics;
  isLoading: boolean;
  isReady: boolean;
  error: string | null;
  start: (analyzer: AudioAnalyzer) => void;
  stop: () => void;
  getTopDetectedSounds: (minScore?: number) => SoundClassification[];
}

function mergePersistentClassifications(
  current: SoundClassification[],
  sessionBestMap: Map<string, SoundClassification>,
  occurrenceCountMap: Map<string, number>,
  limit = 8
): SoundClassification[] {
  const currentByLabel = new Map(
    current.map((item) => [getClassificationKey(item.rawLabel, item.hierarchy), item]),
  );
  const persistentRepeated = Array.from(sessionBestMap.values())
    .map((item) => ({
      ...item,
      occurrenceCount: occurrenceCountMap.get(getClassificationKey(item.rawLabel, item.hierarchy))
        ?? item.occurrenceCount
        ?? 1,
    }))
    .filter((item) => item.occurrenceCount > 1);

  const merged = [
    ...current,
    ...persistentRepeated.filter(
      (item) => !currentByLabel.has(getClassificationKey(item.rawLabel, item.hierarchy)),
    ),
  ];

  return merged
    .sort((left, right) => {
      const leftCount = left.occurrenceCount ?? 1;
      const rightCount = right.occurrenceCount ?? 1;
      return (
        rightCount - leftCount
        || right.adjustedScore - left.adjustedScore
        || right.score - left.score
      );
    })
    .slice(0, limit);
}

function getEmoji(label: string): string {
  const normalized = label.toLowerCase();
  if (normalized.includes('bird') || normalized.includes('chirp') || normalized.includes('tweet')) return '🐦';
  if (normalized.includes('dog') || normalized.includes('bark')) return '🐕';
  if (normalized.includes('cat') || normalized.includes('meow') || normalized.includes('purr')) return '🐱';
  if (normalized.includes('speech') || normalized.includes('voice') || normalized.includes('conversation') || normalized.includes('crowd') || normalized.includes('babble')) return '🗣️';
  if (normalized.includes('music') || normalized.includes('song') || normalized.includes('instrument') || normalized.includes('guitar') || normalized.includes('piano') || normalized.includes('drum') || normalized.includes('flute')) return '🎵';
  if (normalized.includes('car') || normalized.includes('traffic') || normalized.includes('engine') || normalized.includes('vehicle') || normalized.includes('truck') || normalized.includes('horn') || normalized.includes('motor')) return '🚗';
  if (normalized.includes('rain') || normalized.includes('thunder') || normalized.includes('water') || normalized.includes('ocean') || normalized.includes('wave') || normalized.includes('stream')) return '🌊';
  if (normalized.includes('wind')) return '🌬️';
  if (normalized.includes('silence') || normalized.includes('background') || normalized.includes('static') || normalized.includes('noise')) return '🔇';
  if (normalized.includes('alarm') || normalized.includes('siren')) return '🚨';
  if (normalized.includes('aircraft') || normalized.includes('airplane') || normalized.includes('helicopter') || normalized.includes('jet')) return '✈️';
  if (normalized.includes('train') || normalized.includes('rail')) return '🚂';
  if (normalized.includes('child') || normalized.includes('baby') || normalized.includes('laughter')) return '👶';
  if (normalized.includes('insect') || normalized.includes('cricket') || normalized.includes('frog')) return '🦟';
  if (normalized.includes('fire') || normalized.includes('crackl')) return '🔥';
  if (normalized.includes('explosion') || normalized.includes('gunshot')) return '💥';
  return '🔊';
}

function flattenOutput(output: unknown): Float32Array | null {
  if (output instanceof Float32Array) {
    return output;
  }

  if (ArrayBuffer.isView(output)) {
    const view = output as ArrayBufferView;
    return new Float32Array(view.buffer.slice(view.byteOffset, view.byteOffset + view.byteLength));
  }

  if (Array.isArray(output)) {
    return Float32Array.from(output.flat(Infinity) as number[]);
  }

  return null;
}

function extractScores(outputs: unknown[]): Float32Array | null {
  for (const output of outputs) {
    const flattened = flattenOutput(output);
    if (!flattened || flattened.length < 521 || flattened.length % 521 !== 0) {
      continue;
    }

    if (flattened.length === 521) {
      return flattened;
    }

    const aggregated = new Float32Array(521);
    const frameCount = flattened.length / 521;
    for (let frameIndex = 0; frameIndex < frameCount; frameIndex++) {
      const offset = frameIndex * 521;
      for (let classIndex = 0; classIndex < 521; classIndex++) {
        aggregated[classIndex] += flattened[offset + classIndex];
      }
    }
    for (let classIndex = 0; classIndex < 521; classIndex++) {
      aggregated[classIndex] /= frameCount;
    }
    return aggregated;
  }

  return null;
}

function downsample48kTo16k(
  samples: Float32Array,
  state: DownsampleState
): Float32Array {
  const source = new Float32Array(state.carry.length + samples.length);
  for (let index = 0; index < state.carry.length; index++) {
    source[index] = state.carry[index];
  }
  source.set(samples, state.carry.length);

  const output: number[] = [];
  let phase = state.phase;
  for (let index = 0; index < source.length; index++) {
    if (phase === 0) {
      let filtered = 0;
      for (let kernelIndex = 0; kernelIndex < RESAMPLE_KERNEL.length; kernelIndex++) {
        const sampleIndex = index - kernelIndex;
        if (sampleIndex < 0) {
          break;
        }
        filtered += source[sampleIndex] * RESAMPLE_KERNEL[kernelIndex];
      }
      output.push(filtered);
    }
    phase = (phase + 1) % RESAMPLE_DECIMATION_FACTOR;
  }

  state.phase = phase;
  state.carry = Array.from(source.slice(-(RESAMPLE_KERNEL.length - 1)));

  return Float32Array.from(output);
}

function normalizeInputWindow(input: Float32Array): {
  normalized: Float32Array;
  rms: number;
  peak: number;
  mean: number;
  appliedGain: number;
} {
  let mean = 0;
  for (let index = 0; index < input.length; index++) {
    mean += input[index];
  }
  mean /= Math.max(1, input.length);

  const centered = new Float32Array(input.length);
  let rawSumSquares = 0;
  for (let index = 0; index < input.length; index++) {
    const value = input[index] - mean;
    centered[index] = value;
    rawSumSquares += value * value;
  }

  const rawRms = Math.sqrt(rawSumSquares / Math.max(1, input.length));
  const appliedGain = rawRms > 0
    ? Math.min(MAX_INPUT_GAIN, TARGET_INPUT_RMS / rawRms)
    : 1;

  const normalized = new Float32Array(input.length);
  let sumSquares = 0;
  let peak = 0;
  for (let index = 0; index < input.length; index++) {
    const scaled = Math.max(-1, Math.min(1, centered[index] * appliedGain));
    normalized[index] = scaled;
    sumSquares += scaled * scaled;
    peak = Math.max(peak, Math.abs(scaled));
  }

  return {
    normalized,
    rms: Math.sqrt(sumSquares / Math.max(1, input.length)),
    peak,
    mean,
    appliedGain,
  };
}

function buildDisplayClassification(
  rawLabel: string,
  score: number,
  adjustedScore = score,
  emoji?: string,
  occurrenceCount = 1,
  hierarchy: 'specific' | 'broad' = 'specific',
): SoundClassification {
  const macroFamily = getMacroFamily(rawLabel);
  const theme = getMacroFamilyTheme(macroFamily);
  return {
    rawLabel,
    label: getDisplayLabel(rawLabel),
    hierarchy,
    score,
    adjustedScore,
    occurrenceCount,
    emoji: emoji || getEmoji(rawLabel),
    macroFamily,
    accentColor: theme.tint,
    softAccentColor: theme.softTint,
    trackColor: theme.track,
    accentTextColor: theme.text,
    sparkline: [],
  };
}

export function useAudioClassifier(): UseAudioClassifierReturn {
  const [classifications, setClassifications] = useState<SoundClassification[]>([]);
  const [broadClassifications, setBroadClassifications] = useState<SoundClassification[]>([]);
  const [macroClassifications, setMacroClassifications] = useState<MacroClassification[]>([]);
  const [diagnostics, setDiagnostics] = useState<AudioClassifierDiagnostics>({
    rawRms: 0,
    filteredRms: 0,
    peak: 0,
    appliedGain: 1,
    quietFrameRatio: 1,
    pooledFrames: 0,
    rumbleFilterHz: RUMBLE_FILTER_HZ,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const modelRef = useRef<TensorflowModel | null>(null);
  const analyzerRef = useRef<AudioAnalyzer | null>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const isRunning = useRef(false);
  const inferenceInFlight = useRef(false);

  const ringBufferRef = useRef<Float32Array>(new Float32Array(YAMNET_INPUT_SAMPLES));
  const writePosRef = useRef(0);
  const totalResampledSamplesRef = useRef(0);
  const samplesSinceLastInferenceRef = useRef(0);
  const downsampleStateRef = useRef<DownsampleState>({ carry: [], phase: 0 });
  const pooledScoreHistoryRef = useRef<Float32Array[]>([]);
  const sessionBest = useRef<Map<string, SoundClassification>>(new Map());
  const sessionBestBroad = useRef<Map<string, SoundClassification>>(new Map());
  const sparklineHistoryRef = useRef<Map<string, number[]>>(new Map());
  const occurrenceCountRef = useRef<Map<string, number>>(new Map());
  const lastPcmLogAtRef = useRef(0);
  const highPassStateRef = useRef({ previousInput: 0, previousOutput: 0 });
  const quietFrameHistoryRef = useRef<number[]>([]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setIsLoading(true);
        LoggingService.debug('Loading YAMNet TFLite model');
        const model = await loadTensorflowModel(
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          require('../../assets/models/yamnet.tflite')
        );
        if (cancelled) {
          return;
        }
        modelRef.current = model;
        setIsReady(true);
        LoggingService.info('YAMNet model ready');
      } catch (loadError) {
        if (cancelled) {
          return;
        }
        const message = loadError instanceof Error ? loadError.message : String(loadError);
        LoggingService.error('YAMNet model load failed', { error: message });
        setError(message);
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const runInference = useCallback(async () => {
    if (inferenceInFlight.current) {
      return;
    }

    const model = modelRef.current;
    if (!model || totalResampledSamplesRef.current < YAMNET_INPUT_SAMPLES) {
      return;
    }

    inferenceInFlight.current = true;
    try {
      const inputWindow = new Float32Array(YAMNET_INPUT_SAMPLES);
      for (let index = 0; index < YAMNET_INPUT_SAMPLES; index++) {
        inputWindow[index] =
          ringBufferRef.current[(writePosRef.current + index) % YAMNET_INPUT_SAMPLES];
      }

      const { normalized, rms, peak, mean, appliedGain } = normalizeInputWindow(inputWindow);
      if (rms < SILENCE_RMS_THRESHOLD) {
        setBroadClassifications([]);
        setMacroClassifications([]);
        setClassifications([buildDisplayClassification('Silence / quiet', 0.95, 0.95, '🔇', 1, 'specific')]);
        return;
      }

      LoggingService.debug('Running audio classifier inference', {
        rms: Number(rms.toFixed(4)),
        peak: Number(peak.toFixed(4)),
        mean: Number(mean.toFixed(4)),
        gain: Number(appliedGain.toFixed(2)),
      });

      const outputs = await model.run([normalized]);
      const scores = extractScores(outputs as unknown[]);
      if (!scores) {
        LoggingService.warn('Unexpected output shape from YAMNet');
        return;
      }

      pooledScoreHistoryRef.current.push(new Float32Array(scores));
      if (pooledScoreHistoryRef.current.length > TEMPORAL_POOL_WINDOW) {
        pooledScoreHistoryRef.current.shift();
      }
      const pooledScores = logMeanExpPoolScores(pooledScoreHistoryRef.current);

      const rankedResults = buildRankedClassifications(
        pooledScores,
        YAMNET_CLASSES,
        MIN_CLASS_SCORE
      );
      const detailedResults = selectDetailedDisplayClassifications(
        rankedResults,
        MIN_CONFIDENT_SCORE,
        4
      );
      const broadResults = selectBroadDisplayClassifications(
        rankedResults,
        MIN_CONFIDENT_SCORE * 0.9,
        4
      );
      const macros = buildMacroClassifications(rankedResults, MIN_CONFIDENT_SCORE);
      const topResult = detailedResults[0];

      if (topResult) {
        LoggingService.debug('Top audio classification result', {
          label: topResult.label,
          score: Number((topResult.score * 100).toFixed(1)),
          adjustedScore: Number((topResult.adjustedScore * 100).toFixed(1)),
          pooledFrames: pooledScoreHistoryRef.current.length,
        });
      }

      const displayedResults = detailedResults
        .filter((result) => result.adjustedScore >= LIVE_DISPLAY_MIN_SCORE)
        .map(({ label, score, adjustedScore, emoji }) => (
          buildDisplayClassification(
            label,
            score,
            adjustedScore,
            emoji,
            occurrenceCountRef.current.get(getClassificationKey(label, 'specific')) ?? 1,
            'specific',
          )
        ));
      const displayedBroadResults = broadResults
        .filter((result) => result.adjustedScore >= LIVE_DISPLAY_MIN_SCORE)
        .map(({ label, score, adjustedScore, emoji }) => (
          buildDisplayClassification(
            label,
            score,
            adjustedScore,
            emoji,
            occurrenceCountRef.current.get(getClassificationKey(label, 'broad')) ?? 1,
            'broad',
          )
        ));

      const currentScores = new Map<string, number>(
        displayedResults.map((result) => [result.rawLabel, result.score])
      );
      const historyKeys = new Set([
        ...sparklineHistoryRef.current.keys(),
        ...currentScores.keys(),
      ]);
      historyKeys.forEach((key) => {
        const nextSeries = [...(sparklineHistoryRef.current.get(key) ?? []), currentScores.get(key) ?? 0];
        if (nextSeries.length > SPARKLINE_POINTS) {
          nextSeries.splice(0, nextSeries.length - SPARKLINE_POINTS);
        }
        sparklineHistoryRef.current.set(key, nextSeries);
      });

      const liveResultsWithHistory = displayedResults.map((result) => ({
        ...result,
        sparkline: [...(sparklineHistoryRef.current.get(result.rawLabel) ?? [result.score])],
      }));

      liveResultsWithHistory.forEach((result) => {
        const key = getClassificationKey(result.rawLabel, result.hierarchy);
        const nextOccurrenceCount = (occurrenceCountRef.current.get(key) ?? 0) + 1;
        occurrenceCountRef.current.set(key, nextOccurrenceCount);
        result.occurrenceCount = nextOccurrenceCount;
        const previous = sessionBest.current.get(key);
        const sessionMinScore = /speech|conversation|voice/i.test(result.rawLabel)
          ? SPEECH_CONFIDENT_SCORE
          : SESSION_MIN_SCORE;
        if (
          result.adjustedScore >= sessionMinScore &&
          (!previous || result.adjustedScore > previous.adjustedScore)
        ) {
          sessionBest.current.set(key, { ...result });
        }
      });

      displayedBroadResults.forEach((result) => {
        const key = getClassificationKey(result.rawLabel, result.hierarchy);
        const nextOccurrenceCount = (occurrenceCountRef.current.get(key) ?? 0) + 1;
        occurrenceCountRef.current.set(key, nextOccurrenceCount);
        result.occurrenceCount = nextOccurrenceCount;
        const previous = sessionBestBroad.current.get(key);
        if (
          result.adjustedScore >= SESSION_MIN_SCORE * 0.85 &&
          (!previous || result.adjustedScore > previous.adjustedScore)
        ) {
          sessionBestBroad.current.set(key, { ...result });
        }
      });

      const persistentDetailedResults = mergePersistentClassifications(
        liveResultsWithHistory,
        sessionBest.current,
        occurrenceCountRef.current,
        8
      );
      const persistentBroadResults = mergePersistentClassifications(
        displayedBroadResults,
        sessionBestBroad.current,
        occurrenceCountRef.current,
        6
      ).filter((item) => /human|speech|conversation|animal|bird|traffic|vehicle|engine|wind|rain|water|music|noise|outdoor|indoor/i.test(item.rawLabel));

      setDiagnostics((current) => ({
        ...current,
        appliedGain,
        pooledFrames: pooledScoreHistoryRef.current.length,
      }));
      setBroadClassifications(persistentBroadResults);
      setMacroClassifications(macros);
      setClassifications(persistentDetailedResults);
    } catch (inferenceError) {
      LoggingService.warn('Audio classifier inference error', {
        error: inferenceError instanceof Error ? inferenceError.message : String(inferenceError),
      });
    } finally {
      inferenceInFlight.current = false;
    }
  }, []);

  const handleAudioFrame = useCallback((event: AudioFrameEvent) => {
    if (!isRunning.current) {
      return;
    }

    const filtered = applyHighPassFilter(
      event.samples,
      event.sampleRate,
      RUMBLE_FILTER_HZ,
      highPassStateRef.current
    );
    const filteredStats = computeAudioLevelStats(filtered);
    const resampled = event.sampleRate === YAMNET_SAMPLE_RATE
      ? filtered
      : downsample48kTo16k(filtered, downsampleStateRef.current);

    quietFrameHistoryRef.current.push(event.rms < QUIET_FRAME_THRESHOLD ? 1 : 0);
    if (quietFrameHistoryRef.current.length > 120) {
      quietFrameHistoryRef.current.shift();
    }
    const quietFrameRatio = quietFrameHistoryRef.current.length > 0
      ? quietFrameHistoryRef.current.reduce((sum, value) => sum + value, 0) / quietFrameHistoryRef.current.length
      : 1;

    if (Date.now() - lastPcmLogAtRef.current >= PCM_LOG_INTERVAL_MS) {
      lastPcmLogAtRef.current = Date.now();
      LoggingService.debug('Classifier PCM frame summary', {
        sampleRate: event.sampleRate,
        frames: event.numFrames,
        rms: Number(event.rms.toFixed(4)),
        filteredRms: Number(filteredStats.rms.toFixed(4)),
        peak: Number(event.peak.toFixed(4)),
        mean: Number(event.mean.toFixed(4)),
        quietRatio: Number(quietFrameRatio.toFixed(2)),
        resampledSamples: resampled.length,
      });
    }

    setDiagnostics((current) => ({
      ...current,
      rawRms: event.rms,
      filteredRms: filteredStats.rms,
      peak: filteredStats.peak,
      quietFrameRatio,
    }));

    for (let index = 0; index < resampled.length; index++) {
      ringBufferRef.current[writePosRef.current] = Math.max(-1, Math.min(1, resampled[index]));
      writePosRef.current = (writePosRef.current + 1) % YAMNET_INPUT_SAMPLES;
    }

    totalResampledSamplesRef.current += resampled.length;
    samplesSinceLastInferenceRef.current += resampled.length;

    if (
      totalResampledSamplesRef.current >= YAMNET_INPUT_SAMPLES &&
      samplesSinceLastInferenceRef.current >= YAMNET_HOP_SAMPLES
    ) {
      samplesSinceLastInferenceRef.current = 0;
      void runInference();
    }
  }, [runInference]);

  const start = useCallback((analyzer: AudioAnalyzer) => {
    if (isRunning.current) {
      return;
    }

    isRunning.current = true;
    analyzerRef.current = analyzer;
    ringBufferRef.current.fill(0);
    writePosRef.current = 0;
    totalResampledSamplesRef.current = 0;
    samplesSinceLastInferenceRef.current = 0;
    downsampleStateRef.current = { carry: [], phase: 0 };
    pooledScoreHistoryRef.current = [];
    sessionBest.current = new Map();
    sessionBestBroad.current = new Map();
    sparklineHistoryRef.current = new Map();
    occurrenceCountRef.current = new Map();
    lastPcmLogAtRef.current = 0;
    highPassStateRef.current = { previousInput: 0, previousOutput: 0 };
    quietFrameHistoryRef.current = [];
    setDiagnostics({
      rawRms: 0,
      filteredRms: 0,
      peak: 0,
      appliedGain: 1,
      quietFrameRatio: 1,
      pooledFrames: 0,
      rumbleFilterHz: RUMBLE_FILTER_HZ,
    });
    setBroadClassifications([]);
    setMacroClassifications([]);
    setClassifications([]);

    unsubscribeRef.current = analyzer.addAudioFrameListener(handleAudioFrame);
    LoggingService.info('Audio classifier started using PCM callback frames');
  }, [handleAudioFrame]);

  const stop = useCallback(() => {
    isRunning.current = false;
    analyzerRef.current = null;
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
      unsubscribeRef.current = null;
    }
    setBroadClassifications([]);
    setClassifications([]);
    setMacroClassifications([]);
    LoggingService.info('Audio classifier stopped');
  }, []);

  useEffect(() => stop, [stop]);

  const getTopDetectedSounds = useCallback((minScore = 0.1): SoundClassification[] => (
    [...Array.from(sessionBest.current.values()), ...Array.from(sessionBestBroad.current.values())]
      .filter((classification) => {
        const occurrenceCount = occurrenceCountRef.current.get(
          getClassificationKey(classification.rawLabel, classification.hierarchy),
        )
          ?? classification.occurrenceCount
          ?? 1;
        return classification.adjustedScore >= minScore || occurrenceCount > 1;
      })
      .sort((left, right) => (
        (occurrenceCountRef.current.get(getClassificationKey(right.rawLabel, right.hierarchy)) ?? right.occurrenceCount ?? 1)
          - (occurrenceCountRef.current.get(getClassificationKey(left.rawLabel, left.hierarchy)) ?? left.occurrenceCount ?? 1)
        || right.adjustedScore - left.adjustedScore
        || right.score - left.score
      ))
      .map((classification) => ({
        ...classification,
        occurrenceCount:
          occurrenceCountRef.current.get(getClassificationKey(classification.rawLabel, classification.hierarchy))
          ?? classification.occurrenceCount
          ?? 1,
      }))
      .slice(0, 8)
  ), []);

  return {
    classifications,
    broadClassifications,
    macroClassifications,
    diagnostics,
    isLoading,
    isReady,
    error,
    start,
    stop,
    getTopDetectedSounds,
  };
}
