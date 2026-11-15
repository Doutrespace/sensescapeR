/**
 * Minimal web stand-in for `@shopify/react-native-skia`.
 *
 * Components that draw with Skia have dedicated `.web` implementations
 * (HTML canvas). This shim only covers the small raw-pixels -> PNG path that
 * shared utility code uses, so the 7 MB CanvasKit runtime is not needed.
 */
export const ImageFormat = { JPEG: 3, PNG: 4, WEBP: 6 } as const;
export const FilterMode = { Nearest: 0, Linear: 1 } as const;

interface ImageInfo {
  width: number;
  height: number;
  colorType?: number;
  alphaType?: number;
}

function makeImage(info: ImageInfo, data: { bytes: Uint8Array }, _rowBytes: number) {
  if (typeof document === 'undefined') {
    return null;
  }

  const canvas = document.createElement('canvas');
  canvas.width = info.width;
  canvas.height = info.height;
  const context = canvas.getContext('2d');
  if (!context) {
    return null;
  }

  const pixels = new Uint8ClampedArray(info.width * info.height * 4);
  pixels.set(data.bytes.subarray(0, pixels.length));
  context.putImageData(new ImageData(pixels, info.width, info.height), 0, 0);

  return {
    width: () => info.width,
    height: () => info.height,
    encodeToBase64: (format: number = ImageFormat.PNG, quality = 100) => {
      const mimeType = format === ImageFormat.JPEG ? 'image/jpeg' : 'image/png';
      return canvas.toDataURL(mimeType, quality / 100).split(',')[1] ?? '';
    },
  };
}

export const Skia = {
  Data: {
    fromBytes: (bytes: Uint8Array) => ({ bytes }),
  },
  Image: {
    MakeImage: makeImage,
  },
};

const Unsupported = () => null;
export const Canvas = Unsupported;
export const Image = Unsupported;
export const Paint = Unsupported;
export const ColorMatrix = Unsupported;
export const useImage = () => null;
