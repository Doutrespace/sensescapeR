import { LoggingService } from '../logging';

// Audio analyzer using react-native-audio-api for live spectrogram
let AudioContext: any = null;
let AudioRecorder: any = null;

try {
  const audioApi = require('react-native-audio-api');
  AudioContext = audioApi.AudioContext;
  AudioRecorder = audioApi.AudioRecorder;
  LoggingService.debug('Audio analyzer native module loaded');
} catch (error) {
  LoggingService.warn('Audio analyzer native module unavailable', {
    error: error instanceof Error ? error.message : String(error),
  });
}

const SAMPLE_RATE = 48000;
const FFT_SIZE = 4096;
const RECORDER_BUFFER_LENGTH = 512;
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

export class AudioAnalyzer {
  private audioContext: any | null = null;
  private analyser: any | null = null;
  private recorderAdapter: any | null = null;
  private microphone: any | null = null;
  private frequencyData: Uint8Array | null = null;
  private floatFrequencyData: Float32Array | null = null;
  private timeDomainData: Uint8Array | null = null;
  private floatTimeDomainData: Float32Array | null = null;
  private fftSizeValue = FFT_SIZE;
  private latestAudioFrameDiagnostics: AudioFrameDiagnostics | null = null;
  private audioFrameListeners = new Set<(event: AudioFrameEvent) => void>();
  private isInitialized = false;

  get frequencyBinCount(): number {
    return this.analyser?.frequencyBinCount ?? FFT_SIZE / 2;
  }

  get sampleRate(): number {
    return this.audioContext?.sampleRate ?? SAMPLE_RATE;
  }

  get isAvailable(): boolean {
    return AudioContext !== null;
  }

  async initialize(config?: AudioAnalyzerConfig): Promise<boolean> {
    if (this.isInitialized) {
      return true;
    }

    if (!AudioContext) {
      LoggingService.warn('AudioContext unavailable; skipping analyzer initialization');
      return false;
    }

    try {
      const sampleRate = config?.sampleRate ?? SAMPLE_RATE;
      const fftSize = config?.fftSize ?? FFT_SIZE;
      const smoothing = config?.smoothingTimeConstant ?? SMOOTHING_TIME_CONSTANT;
      const recorderBufferLengthInSamples =
        config?.recorderBufferLengthInSamples ?? RECORDER_BUFFER_LENGTH;
      const minDecibels = config?.minDecibels ?? MIN_DECIBELS;
      const maxDecibels = config?.maxDecibels ?? MAX_DECIBELS;

      this.fftSizeValue = fftSize;

      LoggingService.debug('Creating audio context', { sampleRate });

      // Create audio context
      this.audioContext = new AudioContext({ sampleRate });

      // Create analyser node
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = fftSize;
      this.analyser.smoothingTimeConstant = smoothing;
      this.analyser.minDecibels = minDecibels;
      this.analyser.maxDecibels = maxDecibels;
      this.analyser.window = 'hann';

      // Add a GainNode set to 0 to drive the graph without speaker output
      const gainNode = this.audioContext.createGain();
      gainNode.gain.value = 0;
      this.analyser.connect(gainNode);
      gainNode.connect(this.audioContext.destination);

      // Initialize frequency data array
      this.frequencyData = new Uint8Array(this.analyser.frequencyBinCount);
      this.floatFrequencyData = new Float32Array(this.analyser.frequencyBinCount);
      this.timeDomainData = new Uint8Array(fftSize);
      this.floatTimeDomainData = new Float32Array(fftSize);

      // Create recorder adapter for microphone input
      if (AudioRecorder && typeof this.audioContext.createRecorderAdapter === 'function') {
        try {
          const { AudioManager } = require('react-native-audio-api');
          if (AudioManager) {
            let status = await AudioManager.checkRecordingPermissions();
            if (status !== 'Granted') {
              LoggingService.debug('Requesting microphone permission via AudioManager');
              status = await AudioManager.requestRecordingPermissions();
            }
            if (status !== 'Granted') {
              LoggingService.warn('Microphone permission not granted for analyzer', { status });
              return false;
            }

            if (typeof AudioManager.setAudioSessionOptions === 'function') {
              // 'measurement' mode disables iOS input processing (AGC, EQ,
              // echo/noise suppression) so captured levels reflect the true
              // field. Bluetooth input is intentionally NOT allowed: BT mics
              // use lossy mono with their own gain/processing and unknown
              // calibration, which would corrupt acoustic measurements. Keep
              // capture on the built-in mic.
              AudioManager.setAudioSessionOptions({
                iosCategory: 'playAndRecord',
                iosMode: 'measurement',
                iosOptions: ['defaultToSpeaker'],
                iosAllowHaptics: true,
              });
            }
          }

          this.recorderAdapter = this.audioContext.createRecorderAdapter();
          this.recorderAdapter.connect(this.analyser);

          LoggingService.debug('AudioContext state before resume', {
            state: this.audioContext.state,
          });
          await this.audioContext.resume();
          LoggingService.debug('AudioContext state after resume', {
            state: this.audioContext.state,
          });

          if (AudioManager && typeof AudioManager.setAudioSessionActivity === 'function') {
            await AudioManager.setAudioSessionActivity(true);
            LoggingService.debug('Audio session activity enabled');
          }

          if (AudioManager && typeof AudioManager.getDevicesInfo === 'function') {
            try {
              const devices = await AudioManager.getDevicesInfo();
              LoggingService.debug('Audio devices queried', { devices });
            } catch (deviceError) {
              LoggingService.debug('Audio device query failed', {
                error: deviceError instanceof Error ? deviceError.message : String(deviceError),
              });
            }
          }

          this.microphone = new AudioRecorder({
            sampleRate: sampleRate,
            bufferLengthInSamples: recorderBufferLengthInSamples,
          });
          this.microphone.onAudioReady((event: any) => {
            const samples = this.extractMonoSamples(event?.buffer);
            if (!samples) {
              return;
            }

            let sum = 0;
            let sumSquares = 0;
            let peak = 0;
            for (let index = 0; index < samples.length; index++) {
              const value = samples[index];
              sum += value;
              sumSquares += value * value;
              peak = Math.max(peak, Math.abs(value));
            }

            const mean = sum / Math.max(1, samples.length);
            const rms = Math.sqrt(sumSquares / Math.max(1, samples.length));
            const frameEvent: AudioFrameEvent = {
              samples,
              sampleRate: event?.buffer?.sampleRate ?? sampleRate,
              when: event?.when ?? this.audioContext?.currentTime ?? 0,
              numFrames: event?.numFrames ?? samples.length,
              rms,
              peak,
              mean,
            };

            this.latestAudioFrameDiagnostics = {
              sampleRate: frameEvent.sampleRate,
              numFrames: frameEvent.numFrames,
              rms,
              peak,
              mean,
              lastUpdatedAt: Date.now(),
            };

            this.audioFrameListeners.forEach((listener) => {
              listener(frameEvent);
            });
          });
          this.microphone.connect(this.recorderAdapter);
          this.microphone.start();
          LoggingService.debug('Microphone connected to analyzer', {
            fftSize,
            bufferLength: recorderBufferLengthInSamples,
            hopMs: Number(((recorderBufferLengthInSamples / sampleRate) * 1000).toFixed(2)),
          });
        } catch (recorderError) {
          LoggingService.warn('Failed to start analyzer microphone', {
            error: recorderError instanceof Error ? recorderError.message : String(recorderError),
          });
        }
      } else {
        LoggingService.warn('Audio recorder adapter not available for analyzer');
      }

      this.isInitialized = true;
      LoggingService.debug('Audio analyzer initialized', {
        frequencyBinCount: this.analyser.frequencyBinCount,
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

  getFrequencyData(): Uint8Array | null {
    if (!this.analyser || !this.frequencyData) {
      return null;
    }

    this.analyser.getByteFrequencyData(this.frequencyData);
    return this.frequencyData;
  }

  getFloatFrequencyData(): Float32Array | null {
    if (!this.analyser || !this.floatFrequencyData) {
      return null;
    }

    this.analyser.getFloatFrequencyData(this.floatFrequencyData);
    return this.floatFrequencyData;
  }

  getTimeDomainData(): Uint8Array | null {
    if (!this.analyser || !this.timeDomainData) {
      return null;
    }

    this.analyser.getByteTimeDomainData(this.timeDomainData);
    return this.timeDomainData;
  }

  getFloatTimeDomainData(): Float32Array | null {
    if (!this.analyser || !this.floatTimeDomainData) {
      return null;
    }

    this.analyser.getFloatTimeDomainData(this.floatTimeDomainData);
    return this.floatTimeDomainData;
  }

  // Get the frequency for a given bin index
  getFrequencyForBin(binIndex: number): number {
    const nyquist = this.sampleRate / 2;
    return (binIndex / this.frequencyBinCount) * nyquist;
  }

  // Get the bin index for a given frequency
  getBinForFrequency(frequency: number): number {
    const nyquist = this.sampleRate / 2;
    return Math.round((frequency / nyquist) * this.frequencyBinCount);
  }

  // Get frequency data limited to a specific range (e.g., 0-8kHz)
  getFrequencyDataInRange(minFreq: number, maxFreq: number): Uint8Array | null {
    const data = this.getFrequencyData();
    if (!data) return null;

    const minBin = this.getBinForFrequency(minFreq);
    const maxBin = this.getBinForFrequency(maxFreq);

    return data.slice(minBin, maxBin);
  }

  getFloatFrequencyDataInRange(minFreq: number, maxFreq: number): Float32Array | null {
    const data = this.getFloatFrequencyData();
    if (!data) return null;

    const minBin = this.getBinForFrequency(minFreq);
    const maxBin = this.getBinForFrequency(maxFreq);

    return data.slice(minBin, maxBin);
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
    if (this.audioContext && typeof this.audioContext.suspend === 'function') {
      this.audioContext.suspend();
    }
  }

  resume(): void {
    if (this.audioContext && typeof this.audioContext.resume === 'function') {
      this.audioContext.resume();
    }
  }

  cleanup(): void {
    if (this.microphone) {
      try {
        this.microphone.stop();
        this.microphone.disconnect();
      } catch (e) {
        // Ignore disconnect errors
      }
      this.microphone = null;
    }

    if (this.recorderAdapter) {
      try {
        this.recorderAdapter.disconnect();
      } catch (e) {
        // Ignore disconnect errors
      }
      this.recorderAdapter = null;
    }

    if (this.analyser) {
      try {
        this.analyser.disconnect();
      } catch (e) {
        // Ignore disconnect errors
      }
      this.analyser = null;
    }

    if (this.audioContext) {
      try {
        this.audioContext.close();
      } catch (e) {
        // Ignore close errors
      }
      this.audioContext = null;
    }

    this.frequencyData = null;
    this.floatFrequencyData = null;
    this.timeDomainData = null;
    this.floatTimeDomainData = null;
    this.latestAudioFrameDiagnostics = null;
    this.audioFrameListeners.clear();
    this.isInitialized = false;
    LoggingService.debug('Audio analyzer cleaned up');
  }

  private extractMonoSamples(buffer: any): Float32Array | null {
    if (!buffer || typeof buffer.getChannelData !== 'function') {
      return null;
    }

    const channelCount = Math.max(1, buffer.numberOfChannels ?? 1);
    const firstChannel = buffer.getChannelData(0);
    if (!firstChannel || firstChannel.length === 0) {
      return null;
    }

    if (channelCount === 1) {
      return new Float32Array(firstChannel);
    }

    const mono = new Float32Array(firstChannel.length);
    for (let channel = 0; channel < channelCount; channel++) {
      const channelData = buffer.getChannelData(channel);
      for (let index = 0; index < mono.length; index++) {
        mono[index] += channelData[index] / channelCount;
      }
    }
    return mono;
  }
}

// Singleton instance for convenience
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

// Check if audio analysis is available
export function isAudioAnalysisAvailable(): boolean {
  return AudioContext !== null;
}
