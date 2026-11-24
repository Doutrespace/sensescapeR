/**
 * Browser implementation of the audio analyzer.
 *
 * Same public surface as the native version (react-native-audio-api), built
 * on getUserMedia + Web Audio. It emits mono Float32 PCM frames at 48 kHz, so
 * the WAV recorder, the spectrogram and the sound classifier work unchanged.
 */
import { LoggingService } from '../logging';
import { getCaptureInfo, setCaptureInfo } from './captureInfo';
import { CAPTURE_SAMPLE_RATE, getAudioContext, replaceAudioContext } from '../../web/audioContext';

const FFT_SIZE = 4096;
const RECORDER_BUFFER_LENGTH = 512;
/**
 * Size of the blocks the browser hands over. The capture callback runs on the
 * main thread, next to drawing and sound classification; with small blocks a
 * short stall of that thread makes the browser drop audio. Large blocks
 * tolerate stalls of about 85 ms. They are cut into frames of
 * RECORDER_BUFFER_LENGTH samples before they are passed on.
 */
const CAPTURE_BLOCK_LENGTH = 4096;
const SMOOTHING_TIME_CONSTANT = 0.75;
const MIN_DECIBELS = -100;
const MAX_DECIBELS = 0;

export interface AudioFrameEvent {
  samples: Float32Array;
  sampleRate: number;
  when: number;
  numFrames: number;
  rms: number;
  peak: number;
  mean: number;
}

export interface AudioFrameDiagnostics {
  sampleRate: number;
  numFrames: number;
  rms: number;
  peak: number;
  mean: number;
  lastUpdatedAt: number;
}

export interface AudioAnalyzerConfig {
  fftSize?: number;
  smoothingTimeConstant?: number;
  sampleRate?: number;
  recorderBufferLengthInSamples?: number;
  minDecibels?: number;
  maxDecibels?: number;
}

function isCaptureSupported(): boolean {
  return typeof navigator !== 'undefined'
    && !!navigator.mediaDevices?.getUserMedia
    && typeof window !== 'undefined'
    && !!((window as any).AudioContext ?? (window as any).webkitAudioContext);
}

/** Streaming linear resampler for browsers that ignore the requested rate. */
class LinearResampler {
  private position = 0;
  private lastSample = 0;

  constructor(private readonly sourceRate: number, private readonly targetRate: number) {}

  process(input: Float32Array): Float32Array {
    const step = this.sourceRate / this.targetRate;
    const output: number[] = [];
    let position = this.position;

    while (position < input.length) {
      const index = Math.floor(position);
      const fraction = position - index;
      const previous = index === 0 ? this.lastSample : input[index - 1];
      const current = input[index];
      output.push(previous + (current - previous) * fraction);
      position += step;
    }

    this.position = position - input.length;
    this.lastSample = input[input.length - 1] ?? this.lastSample;
    return Float32Array.from(output);
  }
}

export class AudioAnalyzer {
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private stream: MediaStream | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private processor: ScriptProcessorNode | null = null;
  private silentOutput: GainNode | null = null;
  private resampler: LinearResampler | null = null;
  private frequencyData: Uint8Array | null = null;
  private floatFrequencyData: Float32Array | null = null;
  private timeDomainData: Uint8Array | null = null;
  private floatTimeDomainData: Float32Array | null = null;
  private latestAudioFrameDiagnostics: AudioFrameDiagnostics | null = null;
  private audioFrameListeners = new Set<(event: AudioFrameEvent) => void>();
  private isInitialized = false;
  /** Length of the frames passed to listeners. */
  private frameLength = RECORDER_BUFFER_LENGTH;
  /** Captured samples (48 kHz) not yet passed on as a full frame. */
  private pending = new Float32Array(0);
  // Bookkeeping to detect audio the browser dropped.
  private firstBlockTime: number | null = null;
  private lastBlockTime = 0;
  private samplesReceived = 0;
  private wasInterrupted = false;
  private wakeLock: { release: () => Promise<void> } | null = null;
  private readonly handleVisibilityChange = () => {
    if (typeof document === 'undefined' || !this.isInitialized) {
      return;
    }
    if (document.hidden) {
      // Screen locked or app switched: the browser pauses the microphone.
      this.wasInterrupted = true;
    } else {
      void this.requestWakeLock();
    }
  };

  get frequencyBinCount(): number {
    return this.analyser?.frequencyBinCount ?? FFT_SIZE / 2;
  }

  /** Rate of the PCM frames handed to listeners (always 48 kHz on web). */
  /** Records which microphone processing the browser really applied. */
  private reportCaptureSettings(context: AudioContext): void {
    try {
      const track = this.stream?.getAudioTracks()[0];
      const settings = (track?.getSettings?.() ?? {}) as MediaTrackSettings;
      const flag = (value: unknown) => (typeof value === 'boolean' ? value : null);

      setCaptureInfo({
        echoCancellation: flag(settings.echoCancellation),
        noiseSuppression: flag(settings.noiseSuppression),
        autoGainControl: flag(settings.autoGainControl),
        channelCount: typeof settings.channelCount === 'number' ? settings.channelCount : null,
        contextSampleRate: context.sampleRate,
        resampled: context.sampleRate !== CAPTURE_SAMPLE_RATE,
        microphoneLabel: track?.label ? track.label : null,
      });
    } catch {
      setCaptureInfo(null);
    }
  }

  get sampleRate(): number {
    return CAPTURE_SAMPLE_RATE;
  }

  get isAvailable(): boolean {
    return isCaptureSupported();
  }

  async initialize(config?: AudioAnalyzerConfig): Promise<boolean> {
    if (this.isInitialized) {
      return true;
    }

    if (!isCaptureSupported()) {
      LoggingService.warn('Microphone capture is not supported in this browser');
      return false;
    }

    try {
      const fftSize = config?.fftSize ?? FFT_SIZE;
      const bufferLength = config?.recorderBufferLengthInSamples ?? RECORDER_BUFFER_LENGTH;

      // Ask for the rawest signal the browser offers: no echo cancellation,
      // noise suppression or automatic gain, so levels reflect the real field.
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          channelCount: 1,
        },
        video: false,
      });

      let context = getAudioContext();
      if (!context) {
        throw new Error('AudioContext unavailable');
      }

      try {
        this.source = context.createMediaStreamSource(this.stream);
      } catch (sourceError) {
        // Firefox cannot connect a microphone to a context with a custom rate.
        LoggingService.debug('Falling back to the default audio context sample rate', {
          error: sourceError instanceof Error ? sourceError.message : String(sourceError),
        });
        const Constructor = (window as any).AudioContext ?? (window as any).webkitAudioContext;
        context = new Constructor() as AudioContext;
        replaceAudioContext(context);
        this.source = context.createMediaStreamSource(this.stream);
      }

      this.audioContext = context;
      if (context.state !== 'running') {
        await context.resume();
      }

      this.resampler = context.sampleRate === CAPTURE_SAMPLE_RATE
        ? null
        : new LinearResampler(context.sampleRate, CAPTURE_SAMPLE_RATE);

      this.analyser = context.createAnalyser();
      this.analyser.fftSize = fftSize;
      this.analyser.smoothingTimeConstant = config?.smoothingTimeConstant ?? SMOOTHING_TIME_CONSTANT;
      this.analyser.minDecibels = config?.minDecibels ?? MIN_DECIBELS;
      this.analyser.maxDecibels = config?.maxDecibels ?? MAX_DECIBELS;

      this.frequencyData = new Uint8Array(this.analyser.frequencyBinCount);
      this.floatFrequencyData = new Float32Array(this.analyser.frequencyBinCount);
      this.timeDomainData = new Uint8Array(fftSize);
      this.floatTimeDomainData = new Float32Array(fftSize);

      // ScriptProcessorNode delivers raw PCM blocks and works in every
      // browser, including iOS Safari.
      this.frameLength = bufferLength;
      this.pending = new Float32Array(0);
      this.firstBlockTime = null;
      this.lastBlockTime = 0;
      this.samplesReceived = 0;
      this.wasInterrupted = false;

      this.processor = context.createScriptProcessor(CAPTURE_BLOCK_LENGTH, 1, 1);
      this.processor.onaudioprocess = (event) => {
        this.handleCaptureBlock(event.inputBuffer.getChannelData(0), event.playbackTime);
      };

      // Keep the screen on: an auto-lock during the 30 seconds would cut the
      // recording.
      void this.requestWakeLock();
      if (typeof document !== 'undefined') {
        document.addEventListener('visibilitychange', this.handleVisibilityChange);
      }

      // The graph must reach the destination to be pulled; keep it silent.
      this.silentOutput = context.createGain();
      this.silentOutput.gain.value = 0;

      this.source.connect(this.analyser);
      this.source.connect(this.processor);
      this.processor.connect(this.silentOutput);
      this.silentOutput.connect(context.destination);

      this.isInitialized = true;
      this.reportCaptureSettings(context);
      LoggingService.debug('Web audio analyzer initialized', {
        contextSampleRate: context.sampleRate,
        resampling: !!this.resampler,
        bufferLength,
      });
      return true;
    } catch (error) {
      LoggingService.error('Audio analyzer initialization failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      this.cleanup();
      return false;
    }
  }

  private async requestWakeLock(): Promise<void> {
    try {
      const wakeLockApi = (navigator as unknown as {
        wakeLock?: { request: (type: 'screen') => Promise<{ release: () => Promise<void> }> };
      }).wakeLock;
      if (wakeLockApi && this.isInitialized && typeof document !== 'undefined' && !document.hidden) {
        this.wakeLock = await wakeLockApi.request('screen');
      }
    } catch {
      // Not supported or refused (e.g. battery saver): recording still works.
    }
  }

  /**
   * Takes one block from the browser, notes whether audio went missing
   * before it, and passes the samples on in frames of equal length.
   */
  private handleCaptureBlock(block: Float32Array, blockTime: number): void {
    if (this.firstBlockTime === null) {
      this.firstBlockTime = blockTime;
    }
    this.lastBlockTime = blockTime;
    this.samplesReceived += block.length;

    // The browser reuses the block's memory, so always copy.
    const samples = this.resampler ? this.resampler.process(block) : new Float32Array(block);
    if (samples.length === 0) {
      return;
    }

    let buffer = samples;
    if (this.pending.length > 0) {
      buffer = new Float32Array(this.pending.length + samples.length);
      buffer.set(this.pending, 0);
      buffer.set(samples, this.pending.length);
    }

    let offset = 0;
    while (buffer.length - offset >= this.frameLength) {
      this.handleAudioBlock(
        buffer.slice(offset, offset + this.frameLength),
        blockTime + offset / CAPTURE_SAMPLE_RATE
      );
      offset += this.frameLength;
    }
    this.pending = offset < buffer.length ? buffer.slice(offset) : new Float32Array(0);
  }

  /** Milliseconds of audio the browser dropped during the last capture. */
  private measureDropoutMs(): number | null {
    const rate = this.audioContext?.sampleRate;
    if (!rate || this.firstBlockTime === null) {
      return null;
    }
    const expected = (this.lastBlockTime - this.firstBlockTime) * rate + CAPTURE_BLOCK_LENGTH;
    const missing = expected - this.samplesReceived;
    // Timestamps and counts agree to within a fraction of a block.
    return missing > CAPTURE_BLOCK_LENGTH / 2 ? Math.round((missing / rate) * 1000) : 0;
  }

  private handleAudioBlock(samples: Float32Array, when: number): void {

    let sum = 0;
    let sumSquares = 0;
    let peak = 0;
    for (let index = 0; index < samples.length; index++) {
      const value = samples[index];
      sum += value;
      sumSquares += value * value;
      const magnitude = Math.abs(value);
      if (magnitude > peak) {
        peak = magnitude;
      }
    }

    const mean = sum / samples.length;
    const rms = Math.sqrt(sumSquares / samples.length);
    const frameEvent: AudioFrameEvent = {
      samples,
      sampleRate: CAPTURE_SAMPLE_RATE,
      when,
      numFrames: samples.length,
      rms,
      peak,
      mean,
    };

    this.latestAudioFrameDiagnostics = {
      sampleRate: CAPTURE_SAMPLE_RATE,
      numFrames: samples.length,
      rms,
      peak,
      mean,
      lastUpdatedAt: Date.now(),
    };

    this.audioFrameListeners.forEach((listener) => {
      listener(frameEvent);
    });
  }

  getFrequencyData(): Uint8Array | null {
    if (!this.analyser || !this.frequencyData) {
      return null;
    }
    this.analyser.getByteFrequencyData(this.frequencyData as any);
    return this.frequencyData;
  }

  getFloatFrequencyData(): Float32Array | null {
    if (!this.analyser || !this.floatFrequencyData) {
      return null;
    }
    this.analyser.getFloatFrequencyData(this.floatFrequencyData as any);
    return this.floatFrequencyData;
  }

  getTimeDomainData(): Uint8Array | null {
    if (!this.analyser || !this.timeDomainData) {
      return null;
    }
    this.analyser.getByteTimeDomainData(this.timeDomainData as any);
    return this.timeDomainData;
  }

  getFloatTimeDomainData(): Float32Array | null {
    if (!this.analyser || !this.floatTimeDomainData) {
      return null;
    }
    this.analyser.getFloatTimeDomainData(this.floatTimeDomainData as any);
    return this.floatTimeDomainData;
  }

  private get analyserNyquist(): number {
    return (this.audioContext?.sampleRate ?? CAPTURE_SAMPLE_RATE) / 2;
  }

  getFrequencyForBin(binIndex: number): number {
    return (binIndex / this.frequencyBinCount) * this.analyserNyquist;
  }

  getBinForFrequency(frequency: number): number {
    return Math.round((frequency / this.analyserNyquist) * this.frequencyBinCount);
  }

  getFrequencyDataInRange(minFreq: number, maxFreq: number): Uint8Array | null {
    const data = this.getFrequencyData();
    if (!data) return null;
    return data.slice(this.getBinForFrequency(minFreq), this.getBinForFrequency(maxFreq));
  }

  getFloatFrequencyDataInRange(minFreq: number, maxFreq: number): Float32Array | null {
    const data = this.getFloatFrequencyData();
    if (!data) return null;
    return data.slice(this.getBinForFrequency(minFreq), this.getBinForFrequency(maxFreq));
  }

  addAudioFrameListener(listener: (event: AudioFrameEvent) => void): () => void {
    this.audioFrameListeners.add(listener);
    return () => {
      this.audioFrameListeners.delete(listener);
    };
  }

  getLatestAudioFrameDiagnostics(): AudioFrameDiagnostics | null {
    return this.latestAudioFrameDiagnostics;
  }

  pause(): void {
    void this.audioContext?.suspend().catch(() => undefined);
  }

  resume(): void {
    void this.audioContext?.resume().catch(() => undefined);
  }

  cleanup(): void {
    if (this.processor) {
      this.processor.onaudioprocess = null;
    }

    if (this.isInitialized) {
      // Complete the capture report of this recording.
      const info = getCaptureInfo();
      if (info) {
        setCaptureInfo({
          ...info,
          dropoutMs: this.measureDropoutMs(),
          interrupted: this.wasInterrupted,
        });
      }
    }

    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    }
    void this.wakeLock?.release().catch(() => undefined);
    this.wakeLock = null;
    this.pending = new Float32Array(0);

    for (const node of [this.source, this.processor, this.analyser, this.silentOutput]) {
      try {
        node?.disconnect();
      } catch {
        // Already disconnected.
      }
    }

    // Stopping the tracks releases the microphone (and its browser indicator).
    this.stream?.getTracks().forEach((track) => track.stop());

    // The shared context is kept for the next recording, just put to sleep.
    void this.audioContext?.suspend().catch(() => undefined);

    this.stream = null;
    this.source = null;
    this.processor = null;
    this.analyser = null;
    this.silentOutput = null;
    this.audioContext = null;
    this.resampler = null;
    this.frequencyData = null;
    this.floatFrequencyData = null;
    this.timeDomainData = null;
    this.floatTimeDomainData = null;
    this.latestAudioFrameDiagnostics = null;
    this.audioFrameListeners.clear();
    this.isInitialized = false;
    LoggingService.debug('Web audio analyzer cleaned up');
  }
}

let sharedAnalyzer: AudioAnalyzer | null = null;

export function getSharedAnalyzer(): AudioAnalyzer {
  if (!sharedAnalyzer) {
    sharedAnalyzer = new AudioAnalyzer();
  }
  return sharedAnalyzer;
}

export function cleanupSharedAnalyzer(): void {
  if (sharedAnalyzer) {
    sharedAnalyzer.cleanup();
    sharedAnalyzer = null;
  }
}

export function isAudioAnalysisAvailable(): boolean {
  return isCaptureSupported();
}
