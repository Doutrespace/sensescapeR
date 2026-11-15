/**
 * Web replacement for `react-native-view-shot`. The only thing the app
 * captures is the live spectrogram, which is a <canvas> on web, so the
 * capture is the canvas content itself.
 */
export async function captureRef(
  target: any,
  options: { format?: 'png' | 'jpg'; quality?: number } = {}
): Promise<string> {
  const node: HTMLElement | null = target?.current ?? target ?? null;
  const canvas = node instanceof HTMLCanvasElement
    ? node
    : (node?.querySelector?.('canvas') as HTMLCanvasElement | null);

  if (!canvas) {
    throw new Error('Nothing to capture: no canvas found in the target view.');
  }

  const mimeType = options.format === 'jpg' ? 'image/jpeg' : 'image/png';
  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, mimeType, options.quality ?? 1);
  });

  if (!blob) {
    throw new Error('Canvas capture failed.');
  }

  return URL.createObjectURL(blob);
}

export default { captureRef };
