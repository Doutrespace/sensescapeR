import { useState, useCallback, useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { loadTensorflowModel, TensorflowModel } from 'react-native-fast-tflite';
import { LoggingService } from '../services/logging';
import {
  ImageClassification,
  SceneCategory,
  CATEGORY_INFO,
  getDominantCategory,
} from '../utils/imageClassification';
import {
  buildObjectDetectionInput,
  EFFICIENTDET_LITE2_MODEL,
  parseObjectDetections,
} from '../utils/objectDetection';
import {
  ADE20K_SEGMENTATION_MODEL,
  buildSegmentationInput,
  parseEnvironmentSegments,
  SegmentationOverlay,
} from '../utils/environmentSegmentation';

// Android runs the models natively; the web build runs the same .tflite files via WebAssembly.
const PHOTO_ANALYSIS_SUPPORTED = Platform.OS === 'android' || Platform.OS === 'web';
// The object detector produces dynamically sized outputs, which the browser
// TFLite runtime (LiteRT.js) cannot allocate. On web only the environment
// segmentation runs; object boxes stay Android-only.
const OBJECT_DETECTION_SUPPORTED = Platform.OS === 'android';

export interface PhotoAnalysisResult {
  classifications: ImageClassification[];
  dominantCategory: SceneCategory;
  categoryInfo: typeof CATEGORY_INFO[SceneCategory];
  segmentationOverlay: SegmentationOverlay | null;
}

export interface UseImageClassifierReturn {
  isLoading: boolean;
  isReady: boolean;
  error: string | null;
  classify: (imageUri: string) => Promise<ImageClassification[]>;
  classifyWithAnalysis: (imageUri: string) => Promise<PhotoAnalysisResult>;
}

/**
 * Hook for Android on-device object detection.
 */
export function useImageClassifier(): UseImageClassifierReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const objectModelRef = useRef<TensorflowModel | null>(null);
  const modelsLoadedRef = useRef(false);
  const environmentModelRef = useRef<TensorflowModel | null>(null);
  const modelLoadPromiseRef = useRef<Promise<{
    objectModel: TensorflowModel | null;
    environmentModel: TensorflowModel;
  }> | null>(null);
  const classificationCacheRef = useRef<Map<string, ImageClassification[]>>(new Map());
  const analysisCacheRef = useRef<Map<string, PhotoAnalysisResult>>(new Map());

  const ensureModels = useCallback(async (): Promise<{
    objectModel: TensorflowModel | null;
    environmentModel: TensorflowModel;
  }> => {
    if (!PHOTO_ANALYSIS_SUPPORTED) {
      throw new Error('Real on-device photo analysis is only enabled on Android and web.');
    }

    if (modelsLoadedRef.current && environmentModelRef.current) {
      return {
        objectModel: objectModelRef.current,
        environmentModel: environmentModelRef.current,
      };
    }

    if (!modelLoadPromiseRef.current) {
      setIsLoading(true);
      setLoadError(null);

      modelLoadPromiseRef.current = Promise.all([
        OBJECT_DETECTION_SUPPORTED
          ? loadTensorflowModel(EFFICIENTDET_LITE2_MODEL)
          : Promise.resolve(null),
        loadTensorflowModel(ADE20K_SEGMENTATION_MODEL),
      ])
        .then(([objectModel, environmentModel]) => {
          objectModelRef.current = objectModel;
          environmentModelRef.current = environmentModel;
          modelsLoadedRef.current = true;
          setIsReady(true);
          LoggingService.debug('Image classifier models ready', {
            objectInputs: objectModel?.inputs,
            objectOutputs: objectModel?.outputs,
            environmentInputs: environmentModel.inputs,
            environmentOutputs: environmentModel.outputs,
          });
          return { objectModel, environmentModel };
        })
        .catch((err) => {
          modelLoadPromiseRef.current = null;
          setIsReady(false);
          const message = err instanceof Error
            ? err.message
            : 'Failed to load photo analysis models.';
          setLoadError(message);
          throw err;
        })
        .finally(() => {
          setIsLoading(false);
        });
    }

    return modelLoadPromiseRef.current;
  }, []);

  useEffect(() => {
    if (!PHOTO_ANALYSIS_SUPPORTED) {
      setIsReady(false);
      setIsLoading(false);
      return;
    }

    ensureModels().catch((err) => {
      LoggingService.error('Image classifier model initialization failed', {
        error: err instanceof Error ? err.message : String(err),
      });
    });
  }, [ensureModels]);

  const error = PHOTO_ANALYSIS_SUPPORTED
    ? loadError
    : 'Real on-device photo analysis is only enabled on Android and web.';

  /**
   * Analyzes image and returns top object labels detected on-device.
   */
  const classify = useCallback(async (imageUri: string): Promise<ImageClassification[]> => {
    const analysis = await classifyWithAnalysis(imageUri);
    return analysis.classifications;
  }, []);

  /**
   * Classify image and return with analysis metadata
   */
  const classifyWithAnalysis = useCallback(async (imageUri: string): Promise<PhotoAnalysisResult> => {
    const cached = analysisCacheRef.current.get(imageUri);
    if (cached) {
      return cached;
    }

    setIsLoading(true);

    try {
      const { objectModel, environmentModel } = await ensureModels();
      const objectInputTensor = objectModel?.inputs[0];
      const environmentInputTensor = environmentModel.inputs[0];
      if (objectModel && !objectInputTensor) {
        throw new Error('Object detector model has no input tensor.');
      }
      if (!environmentInputTensor) {
        throw new Error('Environment segmenter model has no input tensor.');
      }

      const [objectResult, environmentResult] = await Promise.allSettled([
        (async () => {
          if (!objectModel || !objectInputTensor) {
            return [];
          }
          const input = await buildObjectDetectionInput(imageUri, objectInputTensor);
          const outputs = await objectModel.run([input]);
          return parseObjectDetections(outputs, objectModel.outputs).map((item) => ({
            ...item,
            source: 'object' as const,
          }));
        })(),
        (async () => {
          const input = await buildSegmentationInput(imageUri, environmentInputTensor);
          const outputs = await environmentModel.run([input]);
          return parseEnvironmentSegments(outputs, environmentModel.outputs);
        })(),
      ]);

      const objectDetections = objectResult.status === 'fulfilled'
        ? objectResult.value
        : [];
      const environmentAnalysis = environmentResult.status === 'fulfilled'
        ? environmentResult.value
        : { classifications: [], overlay: null };

      if (objectResult.status === 'rejected') {
        LoggingService.warn('Object detection failed', {
          error: objectResult.reason instanceof Error ? objectResult.reason.message : String(objectResult.reason),
        });
      }
      if (environmentResult.status === 'rejected') {
        LoggingService.warn('Environment segmentation failed', {
          error: environmentResult.reason instanceof Error ? environmentResult.reason.message : String(environmentResult.reason),
        });
      }

      if (objectDetections.length === 0 && environmentAnalysis.classifications.length === 0) {
        const objectMessage = objectResult.status === 'rejected'
          ? String(objectResult.reason)
          : 'no object detections';
        const environmentMessage = environmentResult.status === 'rejected'
          ? String(environmentResult.reason)
          : 'no environment segments';
        throw new Error(`Photo analysis failed: ${objectMessage}; ${environmentMessage}`);
      }

      const classifications = [
        ...objectDetections,
        ...environmentAnalysis.classifications,
      ];
      const dominantCategory = getDominantCategory(classifications);
      const categoryInfo = CATEGORY_INFO[dominantCategory];
      const analysis: PhotoAnalysisResult = {
        classifications,
        dominantCategory,
        categoryInfo,
        segmentationOverlay: environmentAnalysis.overlay,
      };

      classificationCacheRef.current.set(imageUri, classifications);
      analysisCacheRef.current.set(imageUri, analysis);

      LoggingService.debug('Parsed image classifications', {
        classifications: classifications.map((item) => ({
          label: item.label,
          confidence: item.confidence,
          source: item.source,
        })),
      });
      return analysis;
    } catch (err) {
      LoggingService.error('Photo analysis failed', {
        error: err instanceof Error ? err.message : String(err),
      });
      const message = err instanceof Error
        ? err.message
        : 'Photo analysis failed.';
      throw new Error(message);
    } finally {
      setIsLoading(false);
    }
  }, [ensureModels]);

  return {
    isLoading,
    isReady,
    error,
    classify,
    classifyWithAnalysis,
  };
}

/**
 * Utility to format classification results for display
 */
export function formatClassificationForDisplay(
  classification: ImageClassification
): string {
  const metric = classification.source === 'environment'
    ? (classification.coverage ?? classification.confidence)
    : classification.confidence;
  const percent = Math.round(metric * 100);
  return `${classification.emoji} ${classification.label} (${percent}%)`;
}

/**
 * Utility to get color for a category
 */
export function getCategoryColor(category: SceneCategory): string {
  return CATEGORY_INFO[category].color;
}
