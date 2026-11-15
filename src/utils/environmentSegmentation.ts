import { ImageFormat, Skia } from '@shopify/react-native-skia';
import type {
  ImageClassification,
  SceneCategory,
} from './imageClassification';
import { CATEGORY_INFO } from './imageClassification';
import {
  buildImageRgbInput,
  ModelTensorInfo,
} from './imageTensor';

type NumericTensorData = ArrayBufferView & {
  readonly length: number;
  [index: number]: number;
};

export interface SegmentationOverlay {
  uri: string;
  width: number;
  height: number;
}

export interface EnvironmentSegmentationResult {
  classifications: ImageClassification[];
  overlay: SegmentationOverlay | null;
}

const MIN_SEGMENT_COVERAGE = 0.035;
const MAX_SEGMENT_RESULTS = 4;

export const ADE20K_SEGMENTATION_MODEL = require('../../assets/models/ade20k_deeplabv3plus_32c_quant.tflite');

// The Zenodo release describes this model as "top-31 most frequently occurred classes".
// That implies the 32-way output includes a background class plus the first 31 ADE20K scene parsing classes.
const ADE20K_32_LABELS = [
  'background',
  'wall',
  'building',
  'sky',
  'floor',
  'tree',
  'ceiling',
  'road',
  'bed',
  'windowpane',
  'grass',
  'cabinet',
  'sidewalk',
  'person',
  'earth',
  'door',
  'table',
  'mountain',
  'plant',
  'curtain',
  'chair',
  'car',
  'water',
  'painting',
  'sofa',
  'shelf',
  'house',
  'sea',
  'mirror',
  'rug',
  'field',
  'armchair',
  'seat',
] as const;

const LABEL_CATEGORY_MAP: Record<(typeof ADE20K_32_LABELS)[number], SceneCategory> = {
  background: 'unknown',
  wall: 'indoor',
  building: 'urban',
  sky: 'sky',
  floor: 'indoor',
  tree: 'nature',
  ceiling: 'indoor',
  road: 'traffic',
  bed: 'indoor',
  windowpane: 'indoor',
  grass: 'nature',
  cabinet: 'indoor',
  sidewalk: 'urban',
  person: 'unknown',
  earth: 'nature',
  door: 'indoor',
  table: 'indoor',
  mountain: 'nature',
  plant: 'nature',
  curtain: 'indoor',
  chair: 'indoor',
  car: 'traffic',
  water: 'water',
  painting: 'indoor',
  sofa: 'indoor',
  shelf: 'indoor',
  house: 'residential',
  sea: 'water',
  mirror: 'indoor',
  rug: 'indoor',
  field: 'nature',
  armchair: 'indoor',
  seat: 'indoor',
};

const SEGMENTATION_COLORS = [
  [0, 0, 0, 0],
  [90, 110, 180, 132],
  [195, 122, 92, 138],
  [76, 140, 202, 126],
  [174, 154, 120, 126],
  [78, 171, 91, 138],
  [206, 178, 120, 126],
  [95, 109, 132, 138],
  [142, 92, 126, 138],
  [130, 189, 204, 138],
  [98, 196, 88, 138],
  [188, 172, 152, 138],
  [152, 171, 180, 132],
  [214, 156, 116, 138],
  [154, 128, 82, 138],
  [184, 152, 110, 138],
  [162, 132, 112, 138],
  [122, 150, 184, 132],
  [104, 180, 120, 138],
  [176, 132, 154, 138],
  [164, 142, 116, 138],
  [198, 96, 92, 146],
  [94, 158, 184, 138],
  [171, 132, 112, 138],
  [144, 136, 116, 138],
  [178, 124, 92, 138],
  [173, 130, 120, 138],
  [78, 149, 188, 138],
  [168, 148, 138, 138],
  [128, 176, 104, 138],
  [116, 168, 124, 138],
  [152, 142, 128, 126],
] as const;

export async function buildSegmentationInput(
  imageUri: string,
  inputTensor: ModelTensorInfo
): Promise<Uint8Array | Float32Array> {
  return buildImageRgbInput(imageUri, inputTensor);
}

export function parseEnvironmentSegments(
  outputs: readonly ArrayBufferView[],
  outputTensors: readonly ModelTensorInfo[]
): EnvironmentSegmentationResult {
  const entries = outputTensors.map((tensor, index) => ({
    tensor,
    data: asNumericTensorData(outputs[index], tensor.name),
    index,
  }));

  const maskEntry =
    entries.find((entry) => entry.tensor.name.toLowerCase().includes('argmax')) ??
    entries.find((entry) => looksLikeMaskTensor(entry.tensor));
  const logitsEntry = maskEntry
    ? entries.find((entry) => entry.index !== maskEntry.index && looksLikeLogitsTensor(entry.tensor))
    : entries.find((entry) => looksLikeLogitsTensor(entry.tensor));

  const classIds = maskEntry
    ? extractMaskClassIds(maskEntry.tensor, maskEntry.data)
    : logitsEntry
      ? extractLogitClassIds(logitsEntry.tensor, logitsEntry.data)
      : null;

  if (!classIds) {
    throw new Error('Segmentation outputs are missing a readable mask or logits tensor.');
  }

  const coverageByClass = new Map<number, number>();
  for (const classId of classIds.values) {
    if (classId < 0 || classId >= ADE20K_32_LABELS.length) {
      continue;
    }

    coverageByClass.set(classId, (coverageByClass.get(classId) ?? 0) + 1);
  }

  const pixelCount = classIds.values.length;
  if (pixelCount === 0) {
    return { classifications: [], overlay: null };
  }

  const segments = Array.from(coverageByClass.entries())
    .map(([classId, count]) => {
      const coverage = count / pixelCount;
      return {
        classId,
        coverage,
      };
    })
    .filter(({ classId, coverage }) => {
      if (coverage < MIN_SEGMENT_COVERAGE) {
        return false;
      }

      const label = ADE20K_32_LABELS[classId];
      return label !== 'background';
    })
    .sort((left, right) => right.coverage - left.coverage)
    .slice(0, MAX_SEGMENT_RESULTS)
    .map(({ classId, coverage }) => toEnvironmentClassification(classId, coverage));

  if (segments.length > 0) {
    return {
      classifications: segments,
      overlay: createSegmentationOverlay(classIds.values, classIds.width, classIds.height),
    };
  }

  const dominantClass = Array.from(coverageByClass.entries())
    .sort((left, right) => right[1] - left[1])[0];

  if (!dominantClass) {
    return { classifications: [], overlay: null };
  }

  return {
    classifications: [toEnvironmentClassification(dominantClass[0], dominantClass[1] / pixelCount)],
    overlay: createSegmentationOverlay(classIds.values, classIds.width, classIds.height),
  };
}

function toEnvironmentClassification(classId: number, coverage: number): ImageClassification {
  const label = ADE20K_32_LABELS[classId] ?? `Scene class ${classId}`;
  const category = LABEL_CATEGORY_MAP[label as keyof typeof LABEL_CATEGORY_MAP] ?? 'unknown';

  return {
    label: toDisplayLabel(label),
    confidence: coverage,
    coverage,
    classId,
    category,
    emoji: CATEGORY_INFO[category].emoji,
    source: 'environment',
  };
}

function extractMaskClassIds(
  tensor: ModelTensorInfo,
  data: NumericTensorData
): { values: number[]; width: number; height: number } {
  const spatialShape = resolveSpatialShape(tensor.shape);
  const expected = spatialShape.height * spatialShape.width;
  if (data.length < expected) {
    throw new Error(`Segmentation mask tensor is smaller than expected (${data.length} < ${expected}).`);
  }

  const classIds: number[] = new Array(expected);
  for (let index = 0; index < expected; index++) {
    classIds[index] = Math.round(data[index] ?? -1);
  }

  return {
    values: classIds,
    width: spatialShape.width,
    height: spatialShape.height,
  };
}

function extractLogitClassIds(
  tensor: ModelTensorInfo,
  data: NumericTensorData
): { values: number[]; width: number; height: number } {
  const layout = resolveLogitLayout(tensor.shape);
  const pixelCount = layout.height * layout.width;
  const classIds: number[] = new Array(pixelCount);

  if (layout.layout === 'nhwc') {
    for (let pixelIndex = 0; pixelIndex < pixelCount; pixelIndex++) {
      const channelOffset = pixelIndex * layout.classCount;
      classIds[pixelIndex] = argmaxAt(data, channelOffset, 1, layout.classCount);
    }
    return {
      values: classIds,
      width: layout.width,
      height: layout.height,
    };
  }

  for (let pixelIndex = 0; pixelIndex < pixelCount; pixelIndex++) {
    classIds[pixelIndex] = argmaxAt(data, pixelIndex, pixelCount, layout.classCount);
  }

  return {
    values: classIds,
    width: layout.width,
    height: layout.height,
  };
}

function argmaxAt(
  data: NumericTensorData,
  startIndex: number,
  stride: number,
  classCount: number
): number {
  let bestClass = 0;
  let bestScore = Number.NEGATIVE_INFINITY;

  for (let classIndex = 0; classIndex < classCount; classIndex++) {
    const score = data[startIndex + (classIndex * stride)] ?? Number.NEGATIVE_INFINITY;
    if (score > bestScore) {
      bestScore = score;
      bestClass = classIndex;
    }
  }

  return bestClass;
}

function resolveSpatialShape(shape: number[]) {
  if (shape.length === 4 && shape[0] === 1) {
    if (shape[3] === 1) {
      return { height: shape[1], width: shape[2] };
    }

    if (shape[1] === 1) {
      return { height: shape[2], width: shape[3] };
    }
  }

  if (shape.length === 3) {
    if (shape[0] === 1) {
      return { height: shape[1], width: shape[2] };
    }

    return { height: shape[0], width: shape[1] };
  }

  throw new Error(`Unsupported segmentation mask shape: ${JSON.stringify(shape)}`);
}

function resolveLogitLayout(shape: number[]) {
  if (shape.length !== 4 || shape[0] !== 1) {
    throw new Error(`Unsupported segmentation logits shape: ${JSON.stringify(shape)}`);
  }

  const [, dim1, dim2, dim3] = shape;

  if (dim3 === ADE20K_32_LABELS.length) {
    return {
      layout: 'nhwc' as const,
      height: dim1,
      width: dim2,
      classCount: dim3,
    };
  }

  if (dim1 === ADE20K_32_LABELS.length) {
    return {
      layout: 'nchw' as const,
      height: dim2,
      width: dim3,
      classCount: dim1,
    };
  }

  throw new Error(`Unable to resolve segmentation logits layout: ${JSON.stringify(shape)}`);
}

function looksLikeMaskTensor(tensor: ModelTensorInfo) {
  if (tensor.dataType !== 'int32' && tensor.dataType !== 'uint8' && tensor.dataType !== 'int64') {
    return false;
  }

  if (tensor.shape.length === 3 && tensor.shape[0] === 1) {
    return true;
  }

  return tensor.shape.length === 4 && (
    tensor.shape[3] === 1 ||
    tensor.shape[1] === 1
  );
}

function looksLikeLogitsTensor(tensor: ModelTensorInfo) {
  if (tensor.shape.length !== 4 || tensor.shape[0] !== 1) {
    return false;
  }

  return tensor.shape[1] === ADE20K_32_LABELS.length || tensor.shape[3] === ADE20K_32_LABELS.length;
}

function asNumericTensorData(value: ArrayBufferView | undefined, tensorName: string): NumericTensorData {
  if (!value) {
    throw new Error(`Missing segmentation output tensor: ${tensorName}`);
  }

  if (value instanceof BigInt64Array || value instanceof BigUint64Array) {
    throw new Error(`Unsupported bigint segmentation tensor: ${tensorName}`);
  }

  return value as NumericTensorData;
}

function toDisplayLabel(value: string) {
  return value.replace(/\b\w/g, (char) => char.toUpperCase());
}

function createSegmentationOverlay(
  classIds: number[],
  width: number,
  height: number
): SegmentationOverlay | null {
  const rgba = new Uint8Array(width * height * 4);

  for (let index = 0; index < classIds.length; index++) {
    const classId = classIds[index];
    const [red, green, blue, alpha] = SEGMENTATION_COLORS[classId] ?? SEGMENTATION_COLORS[0];
    const offset = index * 4;
    rgba[offset] = red;
    rgba[offset + 1] = green;
    rgba[offset + 2] = blue;
    rgba[offset + 3] = alpha;
  }

  const colorType = 4;
  const rowBytes = width * 4;
  const imageInfo = {
    width,
    height,
    colorType,
    alphaType: 3,
  };

  const data = Skia.Data.fromBytes(rgba);
  const image = Skia.Image.MakeImage(imageInfo, data, rowBytes);
  if (!image) {
    return null;
  }

  const base64 = image.encodeToBase64(ImageFormat.PNG, 100);
  return {
    uri: `data:image/png;base64,${base64}`,
    width,
    height,
  };
}
