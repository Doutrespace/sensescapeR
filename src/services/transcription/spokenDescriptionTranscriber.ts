import { NativeModules, Platform } from 'react-native';

type NativeSpokenDescriptionTranscriber = {
  transcribe: (localeTag?: string | null, maxCharacters?: number) => Promise<string>;
  stopTranscription?: () => void;
  cancelTranscription?: () => void;
};

const nativeModule = NativeModules.SpokenDescriptionTranscriber as
  | NativeSpokenDescriptionTranscriber
  | undefined;

export function isSpokenDescriptionTranscriptionAvailable(): boolean {
  return Platform.OS === 'android' && !!nativeModule;
}

export async function transcribeSpokenDescription(
  localeTag?: string,
  maxCharacters = 600,
): Promise<string> {
  if (!isSpokenDescriptionTranscriptionAvailable() || !nativeModule) {
    throw new Error('Spoken description transcription is not available on this device.');
  }

  return nativeModule.transcribe(localeTag ?? null, maxCharacters);
}

export function stopSpokenDescriptionTranscription(): void {
  nativeModule?.stopTranscription?.();
}

export function cancelSpokenDescriptionTranscription(): void {
  nativeModule?.cancelTranscription?.();
}
