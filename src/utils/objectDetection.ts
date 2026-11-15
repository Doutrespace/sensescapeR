import type { ImageClassification } from './imageClassification';
import {
  buildImageRgbInput,
  ModelTensorInfo,
} from './imageTensor';

type NumericTensorData = ArrayBufferView & {
  readonly length: number;
  [index: number]: number;
};

const MODEL_SCORE_THRESHOLD = 0.35;
const MODEL_MAX_RESULTS = 3;
const MODEL_IOU_THRESHOLD = 0.45;

export const EFFICIENTDET_LITE2_MODEL = require('../../assets/models/efficientdet_lite2_detection.tflite');

const MODEL_LABELS_80 = [
  'person',
  'bicycle',
  'car',
  'motorcycle',
  'airplane',
  'bus',
  'train',
  'truck',
  'boat',
  'traffic light',
  'fire hydrant',
  'stop sign',
  'parking meter',
  'bench',
  'bird',
  'cat',
  'dog',
  'horse',
  'sheep',
  'cow',
  'elephant',
  'bear',
  'zebra',
  'giraffe',
  'backpack',
  'umbrella',
  'handbag',
  'tie',
  'suitcase',
  'frisbee',
  'skis',
  'snowboard',
  'sports ball',
  'kite',
  'baseball bat',
  'baseball glove',
  'skateboard',
  'surfboard',
  'tennis racket',
  'bottle',
  'wine glass',
  'cup',
  'fork',
  'knife',
  'spoon',
  'bowl',
  'banana',
  'apple',
  'sandwich',
  'orange',
  'broccoli',
  'carrot',
  'hot dog',
  'pizza',
  'donut',
  'cake',
  'chair',
  'couch',
  'potted plant',
  'bed',
  'dining table',
  'toilet',
  'tv',
  'laptop',
  'mouse',
  'remote',
  'keyboard',
  'cell phone',
  'microwave',
  'oven',
  'toaster',
  'sink',
  'refrigerator',
  'book',
  'clock',
  'vase',
  'scissors',
  'teddy bear',
  'hair drier',
  'toothbrush',
] as const;

const COCO_LABELS_91 = [
  'background',
  'person',
  'bicycle',
  'car',
  'motorcycle',
  'airplane',
  'bus',
  'train',
  'truck',
  'boat',
  'traffic light',
  'fire hydrant',
  'unknown',
  'stop sign',
  'parking meter',
  'bench',
  'bird',
  'cat',
  'dog',
  'horse',
  'sheep',
  'cow',
  'elephant',
  'bear',
  'zebra',
  'giraffe',
  'unknown',
  'backpack',
  'umbrella',
  'unknown',
  'unknown',
  'handbag',
  'tie',
  'suitcase',
  'frisbee',
  'skis',
  'snowboard',
  'sports ball',
  'kite',
  'baseball bat',
  'baseball glove',
  'skateboard',
  'surfboard',
  'tennis racket',
  'bottle',
  'unknown',
  'wine glass',
  'cup',
  'fork',
  'knife',
  'spoon',
  'bowl',
  'banana',
  'apple',
  'sandwich',
  'orange',
  'broccoli',
  'carrot',
  'hot dog',
  'pizza',
  'donut',
  'cake',
  'chair',
  'couch',
  'potted plant',
  'bed',
  'unknown',
  'dining table',
  'unknown',
  'unknown',
  'toilet',
  'unknown',
  'tv',
  'laptop',
  'mouse',
  'remote',
  'keyboard',
  'cell phone',
  'microwave',
  'oven',
  'toaster',
  'sink',
  'refrigerator',
  'unknown',
  'book',
  'clock',
  'vase',
  'scissors',
  'teddy bear',
  'hair drier',
  'toothbrush',
] as const;

export async function buildObjectDetectionInput(
  imageUri: string,
  inputTensor: ModelTensorInfo
): Promise<Uint8Array | Float32Array> {
  return buildImageRgbInput(imageUri, inputTensor);
}

export function parseObjectDetections(
  outputs: readonly ArrayBufferView[],
  outputTensors: readonly ModelTensorInfo[]
): ImageClassification[] {
  const entries = outputTensors.map((tensor, index) => ({
    tensor,
    data: asNumericTensorData(outputs[index], tensor.name),
    index,
  }));

  const boxesEntry =
    findEntry(entries, (name) => name.includes('box')) ??
    entries.find((entry) => isBoxesTensor(entry.tensor, entry.data));
  const countEntry =
    findEntry(entries, (name) => name.includes('num') || name.includes('count')) ??
    entries.find((entry) => entry.data.length === 1);

  const remainingEntries = entries.filter(
    (entry) => entry.index !== boxesEntry?.index && entry.index !== countEntry?.index
  );
  const scoresEntry =
    findEntry(remainingEntries, (name) => name.includes('score')) ??
    remainingEntries.find((entry) => looksLikeScores(entry.data));
  const classesEntry =
    findEntry(remainingEntries, (name) => name.includes('class')) ??
    remainingEntries.find((entry) => entry.index !== scoresEntry?.index);

  if (!boxesEntry || !scoresEntry || !classesEntry) {
    throw new Error('Detector outputs are missing boxes, classes, or scores tensors.');
  }

  const boxes = boxesEntry.data;
  const classes = classesEntry.data;
  const scores = scoresEntry.data;
  const rawCount = countEntry?.data[0] ?? Math.min(scores.length, classes.length, boxes.length / 4);
  const detectionCount = Math.max(
    0,
    Math.min(
      Math.round(rawCount),
      scores.length,
      classes.length,
      Math.floor(boxes.length / 4)
    )
  );

  const detections: ImageClassification[] = [];

  for (let index = 0; index < detectionCount; index++) {
    const confidence = clamp01(scores[index] ?? 0);
    if (confidence < MODEL_SCORE_THRESHOLD) {
      continue;
    }

    const boxOffset = index * 4;
    // TensorFlow Lite object detection boxes are [ymin, xmin, ymax, xmax].
    const top = clamp01(boxes[boxOffset] ?? 0);
    const left = clamp01(boxes[boxOffset + 1] ?? 0);
    const bottom = clamp01(boxes[boxOffset + 2] ?? top);
    const right = clamp01(boxes[boxOffset + 3] ?? left);
    const classId = Math.round(classes[index] ?? -1);

    detections.push({
      label: labelForClassId(classId),
      confidence,
      category: 'unknown',
      emoji: '🏷️',
      boundingBox: {
        left,
        top,
        width: clamp01(right - left),
        height: clamp01(bottom - top),
      },
    });
  }

  return suppressOverlappingDetections(detections)
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, MODEL_MAX_RESULTS);
}

function findEntry(
  entries: ReadonlyArray<{ tensor: ModelTensorInfo; data: NumericTensorData; index: number }>,
  matcher: (name: string) => boolean
) {
  return entries.find((entry) => matcher(entry.tensor.name.toLowerCase()));
}

function isBoxesTensor(tensor: ModelTensorInfo, data: NumericTensorData) {
  return tensor.shape[tensor.shape.length - 1] === 4 && data.length >= 4;
}

function looksLikeScores(data: NumericTensorData) {
  if (data.length === 0) {
    return false;
  }

  const sampleSize = Math.min(data.length, 10);
  let minimum = Number.POSITIVE_INFINITY;
  let maximum = Number.NEGATIVE_INFINITY;

  for (let index = 0; index < sampleSize; index++) {
    const value = data[index];
    minimum = Math.min(minimum, value);
    maximum = Math.max(maximum, value);
  }

  return minimum >= 0 && maximum <= 1.05;
}

function labelForClassId(classId: number) {
  const candidates = [
    COCO_LABELS_91[classId + 1],
    COCO_LABELS_91[classId],
    MODEL_LABELS_80[classId],
    MODEL_LABELS_80[classId - 1],
  ];

  for (const candidate of candidates) {
    if (candidate && candidate !== 'background' && candidate !== 'unknown') {
      return toDisplayLabel(candidate);
    }
  }

  return `Class ${classId}`;
}

function suppressOverlappingDetections(detections: ImageClassification[]) {
  const sorted = [...detections].sort((a, b) => b.confidence - a.confidence);
  const filtered: ImageClassification[] = [];

  for (const detection of sorted) {
    const overlapsExisting = filtered.some((existing) => {
      if (!existing.boundingBox || !detection.boundingBox) {
        return false;
      }

      return intersectionOverUnion(existing.boundingBox, detection.boundingBox) >= MODEL_IOU_THRESHOLD;
    });

    if (!overlapsExisting) {
      filtered.push(detection);
    }
  }

  return filtered;
}

function intersectionOverUnion(
  left: NonNullable<ImageClassification['boundingBox']>,
  right: NonNullable<ImageClassification['boundingBox']>
) {
  const x1 = Math.max(left.left, right.left);
  const y1 = Math.max(left.top, right.top);
  const x2 = Math.min(left.left + left.width, right.left + right.width);
  const y2 = Math.min(left.top + left.height, right.top + right.height);

  const intersectionWidth = Math.max(0, x2 - x1);
  const intersectionHeight = Math.max(0, y2 - y1);
  const intersectionArea = intersectionWidth * intersectionHeight;

  if (intersectionArea <= 0) {
    return 0;
  }

  const leftArea = left.width * left.height;
  const rightArea = right.width * right.height;
  const unionArea = leftArea + rightArea - intersectionArea;

  if (unionArea <= 0) {
    return 0;
  }

  return intersectionArea / unionArea;
}

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

function asNumericTensorData(value: ArrayBufferView | undefined, tensorName: string): NumericTensorData {
  if (!value) {
    throw new Error(`Missing detector output tensor: ${tensorName}`);
  }

  if (value instanceof BigInt64Array || value instanceof BigUint64Array) {
    throw new Error(`Unsupported bigint detector output tensor: ${tensorName}`);
  }

  return value as NumericTensorData;
}

function toDisplayLabel(value: string) {
  return value.replace(/\b\w/g, (char) => char.toUpperCase());
}
