/**
 * One shared Web Audio context for microphone capture.
 *
 * Mobile Safari only lets an AudioContext start from a user gesture, and the
 * recorder starts a moment after the tap that opens it. `primeAudioContext`
 * is called from every tap/click so the context is already running by then.
 */
export const CAPTURE_SAMPLE_RATE = 48000;

let sharedContext: AudioContext | null = null;

function createContext(): AudioContext | null {
  const Constructor: typeof AudioContext | undefined =
    (window as any).AudioContext ?? (window as any).webkitAudioContext;
  if (!Constructor) {
    return null;
  }

  try {
    return new Constructor({ sampleRate: CAPTURE_SAMPLE_RATE, latencyHint: 'interactive' });
  } catch {
    // Some browsers refuse a custom rate; the analyzer resamples in that case.
    return new Constructor();
  }
}

export function getAudioContext(): AudioContext | null {
  if (!sharedContext || sharedContext.state === 'closed') {
    sharedContext = createContext();
  }
  return sharedContext;
}

export function primeAudioContext(): void {
  const context = getAudioContext();
  if (context && context.state === 'suspended') {
    void context.resume().catch(() => undefined);
  }
}

/** Drops the shared context so the next capture gets a fresh one. */
export function replaceAudioContext(context: AudioContext | null): void {
  if (sharedContext && sharedContext !== context && sharedContext.state !== 'closed') {
    void sharedContext.close().catch(() => undefined);
  }
  sharedContext = context;
}
