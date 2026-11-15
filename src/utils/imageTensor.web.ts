// Browser implementation: images are decoded and resized with an HTML canvas
// instead of Skia. Everything else mirrors imageTensor.ts.

export interface ModelTensorInfo {
  name: string;
  dataType: string;
  shape: number[];
}

export interface ResolvedInputShape {
  width: number;
  height: number;
  channels: number;
  layout: 'nhwc' | 'nchw';
}

export function resolveImageInputShape(inputTensor: ModelTensorInfo): ResolvedInputShape {
  const [batchOrHeight, heightOrChannels, widthOrHeight, channelsOrWidth] = inputTensor.shape;

  if (inputTensor.shape.length !== 4 || batchOrHeight !== 1) {
    throw new Error(`Unexpected image model input shape: ${JSON.stringify(inputTensor.shape)}`);
  }

  if (channelsOrWidth === 3) {
    return {
      width: widthOrHeight,
      height: heightOrChannels,
      channels: channelsOrWidth,
      layout: 'nhwc',
    };
  }

  if (heightOrChannels === 3) {
    return {
      width: channelsOrWidth,
      height: widthOrHeight,
      channels: heightOrChannels,
      layout: 'nchw',
    };
  }

  throw new Error(`Unsupported image model input shape: ${JSON.stringify(inputTensor.shape)}`);
}

export async function buildImageRgbInput(
  imageUri: string,
  inputTensor: ModelTensorInfo,
  options?: {
    normalizeToUnitRange?: boolean;
  }
): Promise<Uint8Array | Float32Array> {
  const shape = resolveImageInputShape(inputTensor);
  const rgbaPixels = await decodeAndResizeImage(imageUri, shape.width, shape.height);
  const normalizeToUnitRange = options?.normalizeToUnitRange ?? inputTensor.dataType === 'float32';

  if (inputTensor.dataType === 'uint8') {
    return convertRgbaToUint8Rgb(rgbaPixels, shape, normalizeToUnitRange);
  }

  if (inputTensor.dataType === 'float32') {
    return convertRgbaToFloatRgb(rgbaPixels, shape, normalizeToUnitRange);
  }

  throw new Error(`Unsupported image input tensor type: ${inputTensor.dataType}`);
}

async function decodeAndResizeImage(
  imageUri: string,
  width: number,
  height: number
): Promise<Uint8Array> {
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const element = new window.Image();
    element.onload = () => resolve(element);
    element.onerror = () => reject(new Error(`Unable to decode image for model input: ${imageUri}`));
    element.src = imageUri;
  });

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) {
    throw new Error(`Unable to create a ${width}x${height} canvas`);
  }

  context.fillStyle = '#000000';
  context.fillRect(0, 0, width, height);
  context.drawImage(image, 0, 0, width, height);

  const { data } = context.getImageData(0, 0, width, height);
  return new Uint8Array(data.buffer, data.byteOffset, data.length);
}

function convertRgbaToUint8Rgb(
  rgbaPixels: Uint8Array,
  shape: ResolvedInputShape,
  normalizeToUnitRange: boolean
): Uint8Array {
  const output = new Uint8Array(shape.width * shape.height * shape.channels);
  copyRgbPixels(rgbaPixels, output, shape, normalizeToUnitRange);
  return output;
}

function convertRgbaToFloatRgb(
  rgbaPixels: Uint8Array,
  shape: ResolvedInputShape,
  normalizeToUnitRange: boolean
): Float32Array {
  const output = new Float32Array(shape.width * shape.height * shape.channels);
  copyRgbPixels(rgbaPixels, output, shape, normalizeToUnitRange);
  return output;
}

function copyRgbPixels(
  rgbaPixels: Uint8Array,
  output: Uint8Array | Float32Array,
  shape: ResolvedInputShape,
  normalizeToUnitRange: boolean
) {
  const pixelCount = shape.width * shape.height;

  for (let pixelIndex = 0; pixelIndex < pixelCount; pixelIndex++) {
    const rgbaOffset = pixelIndex * 4;
    const red = rgbaPixels[rgbaOffset];
    const green = rgbaPixels[rgbaOffset + 1];
    const blue = rgbaPixels[rgbaOffset + 2];

    if (shape.layout === 'nhwc') {
      const rgbOffset = pixelIndex * shape.channels;
      output[rgbOffset] = normalize(red, normalizeToUnitRange);
      output[rgbOffset + 1] = normalize(green, normalizeToUnitRange);
      output[rgbOffset + 2] = normalize(blue, normalizeToUnitRange);
      continue;
    }

    output[pixelIndex] = normalize(red, normalizeToUnitRange);
    output[pixelCount + pixelIndex] = normalize(green, normalizeToUnitRange);
    output[(pixelCount * 2) + pixelIndex] = normalize(blue, normalizeToUnitRange);
  }
}

function normalize(value: number, normalizeToUnitRange: boolean) {
  return normalizeToUnitRange ? value / 255 : value;
}
