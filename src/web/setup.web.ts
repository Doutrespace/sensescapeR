/**
 * Browser bootstrapping. Imported first by the root layout.
 */
import { Alert } from 'react-native';
import { showWebAlert } from './alert';
import { primeAudioContext } from './audioContext';
import { mediaStoreReady } from './mediaStore';

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  // react-native-web ships Alert.alert as a no-op.
  (Alert as unknown as { alert: typeof showWebAlert }).alert = showWebAlert;

  // Mobile Safari only starts audio from a user gesture; the recorder opens a
  // moment after the tap, so wake the audio context on the tap itself.
  for (const eventName of ['pointerup', 'touchend', 'keyup'] as const) {
    window.addEventListener(eventName, primeAudioContext, { capture: true, passive: true });
  }

  // Start loading stored recordings' media right away.
  void mediaStoreReady();

  // Ask the browser not to evict recordings that have not been uploaded yet.
  void navigator.storage?.persist?.().catch(() => undefined);

  const style = document.createElement('style');
  style.textContent = `
    html, body, #root { height: 100%; }
    body {
      overscroll-behavior: none;
      -webkit-tap-highlight-color: transparent;
      -webkit-text-size-adjust: 100%;
      touch-action: manipulation;
      background: #F3EFE6;
    }
  `;
  document.head.appendChild(style);
}
