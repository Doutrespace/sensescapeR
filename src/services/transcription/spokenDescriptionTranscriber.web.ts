/**
 * Browser implementation of spoken-description transcription, using the Web
 * Speech API where the browser offers it (Chrome, Edge, Safari).
 */
type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: any) => void) | null;
  onerror: ((event: any) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

let activeRecognition: SpeechRecognitionLike | null = null;
let cancelled = false;

function getRecognitionConstructor(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === 'undefined') {
    return null;
  }
  return (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition ?? null;
}

/**
 * Off by default. The Web Speech API does not work on the device: Chrome
 * and Safari send the audio to Google or Apple for recognition. For a study
 * that must be covered by the information given to participants, so the
 * notes step offers a text field instead. Set to true only after adding
 * this to the consent text.
 */
const VOICE_TRANSCRIPTION_ENABLED = false;

export function isSpokenDescriptionTranscriptionAvailable(): boolean {
  return VOICE_TRANSCRIPTION_ENABLED && getRecognitionConstructor() !== null;
}

export function transcribeSpokenDescription(
  localeTag?: string,
  maxCharacters = 600,
): Promise<string> {
  const Recognition = getRecognitionConstructor();
  if (!Recognition) {
    return Promise.reject(
      new Error('Spoken description transcription is not available in this browser.')
    );
  }

  activeRecognition?.abort();
  cancelled = false;

  return new Promise<string>((resolve, reject) => {
    const recognition = new Recognition();
    let transcript = '';
    let failure: string | null = null;

    recognition.lang = localeTag || navigator.language || 'en-US';
    recognition.continuous = true;
    recognition.interimResults = false;

    recognition.onresult = (event: any) => {
      for (let index = event.resultIndex; index < event.results.length; index++) {
        const result = event.results[index];
        if (result.isFinal) {
          transcript = `${transcript} ${result[0].transcript}`.trim();
        }
      }
      if (transcript.length >= maxCharacters) {
        recognition.stop();
      }
    };

    recognition.onerror = (event: any) => {
      const code = String(event?.error ?? 'unknown');
      if (code === 'aborted' || code === 'no-speech') {
        return;
      }
      failure = code === 'not-allowed' || code === 'service-not-allowed'
        ? 'Microphone or speech recognition permission was denied.'
        : `Speech recognition failed (${code}).`;
    };

    recognition.onend = () => {
      if (activeRecognition === recognition) {
        activeRecognition = null;
      }
      if (cancelled) {
        reject(new Error('CANCELLED'));
      } else if (failure) {
        reject(new Error(failure));
      } else if (!transcript) {
        reject(new Error('No speech was recognised. Try again and speak closer to the microphone.'));
      } else {
        resolve(transcript.slice(0, maxCharacters));
      }
    };

    activeRecognition = recognition;
    try {
      recognition.start();
    } catch (error) {
      activeRecognition = null;
      reject(error instanceof Error ? error : new Error(String(error)));
    }
  });
}

export function stopSpokenDescriptionTranscription(): void {
  activeRecognition?.stop();
}

export function cancelSpokenDescriptionTranscription(): void {
  if (activeRecognition) {
    cancelled = true;
    activeRecognition.abort();
  }
}
