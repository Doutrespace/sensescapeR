/**
 * What the device actually did with the microphone signal during the last
 * recording. Browsers may ignore the request to switch off echo
 * cancellation, noise suppression or automatic gain, and all three change
 * measured levels, so the applied settings are saved with each measurement.
 */
export type CaptureInfo = Record<string, string | number | boolean | null>;

let lastCaptureInfo: CaptureInfo | null = null;

export function setCaptureInfo(info: CaptureInfo | null): void {
  lastCaptureInfo = info;
}

export function getCaptureInfo(): CaptureInfo | null {
  return lastCaptureInfo;
}
