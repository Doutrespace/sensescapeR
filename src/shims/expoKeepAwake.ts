export const ExpoKeepAwakeTag = 'soundscape-dev-noop';

export function useKeepAwake(): void {
  // Expo's dev wrapper may import expo-keep-awake if it is resolvable.
  // This app does not use keep-awake directly, so make the hook a no-op
  // instead of crashing when the native module is absent from the Android build.
}

export async function activateKeepAwake(): Promise<void> {}

export async function deactivateKeepAwake(): Promise<void> {}
