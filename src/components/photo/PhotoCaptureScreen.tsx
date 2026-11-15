import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  Alert,
  Linking,
  useWindowDimensions,
  ActivityIndicator,
} from 'react-native';
import { CameraView, CameraType, useCameraPermissions } from 'expo-camera';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Paths, File, Directory } from 'expo-file-system';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { Colors, Spacing, Radius, Shadows } from '../../theme/colors';
import { useImageClassifier } from '../../hooks/useImageClassifier';
import { LoggingService } from '../../services/logging/LoggingService';
import {
  ImageClassification,
  getIncludedImageClassifications,
  groupImageClassifications,
  withIncludedImageClassifications,
} from '../../utils/imageClassification';
import {
  assessVisualContext,
  formatVisualIndicatorSummary,
} from '../../utils/visualContext';
import DetectionOverlayImage, { getDetectionAccent } from './DetectionOverlayImage';
import { t } from '../../i18n';

interface Props {
  onPhotoCaptured: (uri: string, classifications?: ImageClassification[]) => void;
  onSkip: () => void;
}

function getPhotoCaptureErrorMessage(error?: string): string {
  if (!error) {
    return 'The photo could not be saved. Check available storage and try again.';
  }

  const normalized = error.toLowerCase();
  if (normalized.includes('space') || normalized.includes('storage') || normalized.includes('enospc')) {
    return 'Your device is low on storage. Free some space and try taking the photo again.';
  }
  if (normalized.includes('permission')) {
    return 'Camera access is unavailable. Check the permission in system settings and try again.';
  }
  return 'The photo could not be saved. Check available storage and try again.';
}

export default function PhotoCaptureScreen({ onPhotoCaptured, onSkip }: Props) {
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<CameraType>('back');
  const [capturedUri, setCapturedUri] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [classifications, setClassifications] = useState<ImageClassification[]>([]);
  const [isClassifying, setIsClassifying] = useState(false);
  const [classificationError, setClassificationError] = useState<string | null>(null);
  const [showDetectionBoxes, setShowDetectionBoxes] = useState(false);
  const [showSegmentationOverlay, setShowSegmentationOverlay] = useState(false);
  const [segmentationOverlayUri, setSegmentationOverlayUri] = useState<string | null>(null);
  const cameraRef = useRef<CameraView>(null);

  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const tabBarHeight = useBottomTabBarHeight();
  const {
    classifyWithAnalysis,
    isReady: classifierReady,
    isLoading: classifierLoading,
    error: classifierError,
  } = useImageClassifier();

  const handleRequestPermission = useCallback(async () => {
    const result = await requestPermission();
    if (!result.granted) {
      Alert.alert(
        t('Camera Permission Required'),
        t('This feature needs camera access to capture photos of the environment. Please enable it in your device settings.'),
        [
          { text: t('Cancel'), style: 'cancel' },
          { text: t('Open Settings'), onPress: () => Linking.openSettings() },
        ]
      );
    }
  }, [requestPermission]);

  const handleCapture = useCallback(async () => {
    if (!cameraRef.current || isCapturing) return;

    setIsCapturing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.8,
        skipProcessing: false,
      });

      if (photo?.uri) {
        const resizeWidth = typeof photo.width === 'number' && photo.width > 1600
          ? 1600
          : undefined;
        const processedPhoto = await manipulateAsync(
          photo.uri,
          resizeWidth ? [{ resize: { width: resizeWidth } }] : [],
          {
            compress: 0.78,
            format: SaveFormat.JPEG,
          }
        );

        // Move to permanent location
        const filename = `photo_${Date.now()}.jpg`;
        const photosDir = new Directory(Paths.document, 'photos');

        if (!photosDir.exists) {
          await photosDir.create();
        }

        const processedFile = new File(processedPhoto.uri);
        const permanentFile = new File(photosDir, filename);
        await processedFile.move(permanentFile);

        if (photo.uri !== processedPhoto.uri) {
          const originalFile = new File(photo.uri);
          if (originalFile.exists) {
            originalFile.delete();
          }
        }

        setCapturedUri(permanentFile.uri);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (err) {
      LoggingService.error('Failed to capture photo', {
        error: err instanceof Error ? err.message : String(err),
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert(
        t('Photo unavailable'),
        getPhotoCaptureErrorMessage(err instanceof Error ? err.message : undefined)
      );
    } finally {
      setIsCapturing(false);
    }
  }, [isCapturing]);

  // Classify image when captured
  useEffect(() => {
    if (capturedUri && classifierReady) {
      setIsClassifying(true);
      setClassificationError(null);
      classifyWithAnalysis(capturedUri)
        .then((result) => {
          setClassifications(withIncludedImageClassifications(result.classifications));
          setSegmentationOverlayUri(result.segmentationOverlay?.uri ?? null);
          LoggingService.debug('Photo analysis complete', {
            classifications: result.classifications.map((item) => ({
              label: item.label,
              confidence: item.confidence,
              source: item.source,
            })),
          });
        })
        .catch((err) => {
          LoggingService.warn('Photo analysis failed', {
            error: err instanceof Error ? err.message : String(err),
          });
          setClassifications([]);
          setSegmentationOverlayUri(null);
          setClassificationError(err instanceof Error ? err.message : t('Object detection failed.'));
        })
        .finally(() => {
          setIsClassifying(false);
        });
    }
  }, [capturedUri, classifyWithAnalysis, classifierReady]);

  const handleRetake = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setCapturedUri(null);
    setClassifications([]);
    setClassificationError(null);
    setShowDetectionBoxes(false);
    setShowSegmentationOverlay(false);
    setSegmentationOverlayUri(null);
  }, []);

  const handleConfirm = useCallback(() => {
    if (capturedUri) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const includedClassifications = getIncludedImageClassifications(classifications);
      onPhotoCaptured(
        capturedUri,
        includedClassifications.length > 0 ? includedClassifications : undefined,
      );
    }
  }, [capturedUri, classifications, onPhotoCaptured]);

  const handleFlipCamera = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setFacing(current => (current === 'back' ? 'front' : 'back'));
  }, []);

  const footerBottomPadding = tabBarHeight + 16;
  const isDetectorBusy = Boolean(capturedUri) && (isClassifying || (classifierLoading && !classifierReady));
  const detectorErrorMessage = classificationError ?? classifierError;
  const includedClassifications = getIncludedImageClassifications(classifications);
  const objectDetections = includedClassifications.filter((item) => item.source !== 'environment');
  const environmentSegments = includedClassifications.filter((item) => item.source === 'environment');
  const groupedObjectDetections = groupImageClassifications(
    classifications.filter((item) => item.source !== 'environment'),
  );
  const groupedEnvironmentSegments = groupImageClassifications(
    classifications.filter((item) => item.source === 'environment'),
  );
  const visualContext = assessVisualContext(includedClassifications);
  const toggleClassificationGroup = useCallback((label: string, source?: 'object' | 'environment') => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setClassifications((current) => {
      const matchingItems = current.filter(
        (item) => item.label === label && (item.source ?? 'object') === (source ?? 'object'),
      );
      const shouldExclude = matchingItems.some((item) => item.reviewStatus !== 'excluded');

      return current.map((item) => {
        if (item.label !== label || (item.source ?? 'object') !== (source ?? 'object')) {
          return item;
        }

        return {
          ...item,
          reviewStatus: shouldExclude ? 'excluded' : 'included',
        };
      });
    });
  }, []);

  // Permission not determined yet
  if (!permission) {
    return (
      <View style={styles.container}>
        <View style={styles.permissionContainer}>
          <MaterialIcons name="camera-alt" size={64} color={Colors.textMuted} />
          <Text style={styles.permissionTitle}>{t('Camera Access')}</Text>
          <Text style={styles.permissionText}>
            {t('Loading camera permissions...')}
          </Text>
        </View>
      </View>
    );
  }

  // Permission denied
  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <View style={styles.permissionContainer}>
          <MaterialIcons name="camera-alt" size={64} color={Colors.textMuted} />
          <Text style={styles.permissionTitle}>{t('Camera Access Required')}</Text>
          <Text style={styles.permissionText}>
            {t('Capture a photo of your environment to help classify the soundscape context.')}
          </Text>
          <TouchableOpacity
            style={styles.permissionButton}
            onPress={handleRequestPermission}
            accessibilityRole="button"
            accessibilityLabel={t('Grant camera access')}
          >
            <Text style={styles.permissionButtonText}>{t('Grant Access')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.skipLink}
            onPress={onSkip}
            accessibilityRole="button"
            accessibilityLabel={t('Skip photo step')}
          >
            <Text style={styles.skipLinkText}>{t('Skip this step')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Photo captured - show preview with classifications
  if (capturedUri) {
    const previewHeight = Math.min((screenWidth - 48) * 1.05, screenHeight * 0.34);

    return (
      <View style={styles.container}>
        <ScrollView
          style={styles.previewScroll}
          contentContainerStyle={[styles.previewScrollContent, { paddingBottom: footerBottomPadding + 120 }]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <Text style={styles.title}>{t('Photo Captured')}</Text>
            <Text style={styles.subtitle}>
              {isDetectorBusy
                ? t('Running on-device photo analysis...')
                : classifications.length > 0
                  ? t('Detected objects and environmental context')
                  : detectorErrorMessage
                    ? t('Photo analysis unavailable')
                    : classifierReady
                    ? t('No confident context found')
                    : t('Preparing models...')}
            </Text>
          </View>

          <View style={styles.previewSection}>
            <View style={styles.previewContainer}>
              <DetectionOverlayImage
                uri={capturedUri}
                detections={objectDetections}
                maxHeight={previewHeight}
                borderRadius={Radius.lg}
                showBoxes={showDetectionBoxes}
                showLabels={false}
                segmentationOverlayUri={segmentationOverlayUri ?? undefined}
                showSegmentationOverlay={showSegmentationOverlay}
              />

              {isDetectorBusy && (
                <View style={styles.classifyingOverlay}>
                  <ActivityIndicator size="large" color={Colors.primary} />
                  <Text style={styles.classifyingText}>
                    {classifierReady ? t('Analyzing...') : t('Loading detector...')}
                  </Text>
                </View>
              )}
            </View>

            {!isDetectorBusy && (objectDetections.length > 0 || segmentationOverlayUri) && (
              <View style={styles.overlayToggleRow}>
                {objectDetections.length > 0 && (
                  <TouchableOpacity
                    style={styles.overlayToggle}
                    onPress={() => setShowDetectionBoxes((current) => !current)}
                    accessibilityRole="button"
                    accessibilityLabel={showDetectionBoxes ? t('Hide detection boxes') : t('Show detection boxes')}
                  >
                    <MaterialIcons
                      name={showDetectionBoxes ? 'visibility-off' : 'visibility'}
                      size={16}
                      color={Colors.textMuted}
                    />
                    <Text style={styles.overlayToggleText}>
                      {showDetectionBoxes ? t('Hide detection boxes') : t('Show detection boxes')}
                    </Text>
                  </TouchableOpacity>
                )}
                {segmentationOverlayUri && (
                  <TouchableOpacity
                    style={styles.overlayToggle}
                    onPress={() => setShowSegmentationOverlay((current) => !current)}
                    accessibilityRole="button"
                    accessibilityLabel={showSegmentationOverlay ? t('Hide segmentation map') : t('Show segmentation map')}
                  >
                    <MaterialIcons
                      name={showSegmentationOverlay ? 'layers-clear' : 'layers'}
                      size={16}
                      color={Colors.textMuted}
                    />
                    <Text style={styles.overlayToggleText}>
                      {showSegmentationOverlay ? t('Hide segmentation map') : t('Show segmentation map')}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>

          {!isDetectorBusy && classifications.length > 0 && (
            <View style={styles.classificationResults}>
            {groupedObjectDetections.length > 0 && (
              <>
                <Text style={styles.classificationTitle}>{t('Detected objects saved with photo')}</Text>
                <Text style={styles.classificationHint}>{t('Tap anything that was not actually present.')}</Text>
                <View style={styles.classificationList}>
                  {groupedObjectDetections.map((item, index) => {
                    const accentColor = getDetectionAccent(index);
                    const confidencePercent = Math.round(item.confidence * 100);
                    const isExcluded = item.entries.every((entry) => entry.reviewStatus === 'excluded');
                    return (
                      <TouchableOpacity
                        key={`object-${index}`}
                        activeOpacity={0.78}
                        onPress={() => toggleClassificationGroup(item.label, item.source)}
                        style={[
                          styles.classificationRow,
                          index === groupedObjectDetections.length - 1 && styles.classificationRowLast,
                          isExcluded && styles.classificationRowExcluded,
                        ]}
                        accessibilityRole="button"
                        accessibilityLabel={`${isExcluded ? t('Re-include') : t('Exclude')} ${t(item.label)}`}
                      >
                        <View style={styles.classificationRowHeader}>
                          <View style={styles.classificationMeta}>
                            <View
                              style={[
                                styles.classificationRank,
                                { backgroundColor: `${accentColor}18` },
                              ]}
                            >
                            <Text style={[styles.classificationRankText, { color: accentColor }]}>
                                {index + 1}
                              </Text>
                            </View>
                            <Text style={[styles.classificationLabel, isExcluded && styles.classificationLabelExcluded]}>
                              {t(item.label)}
                            </Text>
                            {item.count > 1 && (
                              <View style={styles.classificationCountBadge}>
                                <Text style={styles.classificationCountText}>{item.count}x</Text>
                              </View>
                            )}
                          </View>
                          <Text style={[styles.classificationConfidence, { color: accentColor }]}>
                            {confidencePercent}%
                          </Text>
                        </View>
                        <View style={styles.classificationBarTrack}>
                          <View
                            style={[
                              styles.classificationBarFill,
                              {
                                width: `${confidencePercent}%`,
                                backgroundColor: accentColor,
                              },
                            ]}
                          />
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </>
            )}

            {groupedEnvironmentSegments.length > 0 && (
              <>
                <Text style={styles.classificationTitle}>{t('Environmental context from segmentation')}</Text>
                <View style={styles.classificationList}>
                  {groupedEnvironmentSegments.map((item, index) => {
                    const accentColor = getDetectionAccent(index + groupedObjectDetections.length);
                    const coveragePercent = Math.round((item.coverage ?? item.confidence) * 100);
                    const isExcluded = item.entries.every((entry) => entry.reviewStatus === 'excluded');
                    return (
                      <TouchableOpacity
                        key={`environment-${index}`}
                        activeOpacity={0.78}
                        onPress={() => toggleClassificationGroup(item.label, item.source)}
                        style={[
                          styles.classificationRow,
                          index === groupedEnvironmentSegments.length - 1 && styles.classificationRowLast,
                          isExcluded && styles.classificationRowExcluded,
                        ]}
                        accessibilityRole="button"
                        accessibilityLabel={`${isExcluded ? t('Re-include') : t('Exclude')} ${t(item.label)}`}
                      >
                        <View style={styles.classificationRowHeader}>
                          <View style={styles.classificationMeta}>
                            <View
                              style={[
                                styles.classificationRank,
                                { backgroundColor: `${accentColor}18` },
                              ]}
                            >
                              <Text style={[styles.classificationRankText, { color: accentColor }]}>
                                {index + 1}
                              </Text>
                            </View>
                            <Text style={[styles.classificationLabel, isExcluded && styles.classificationLabelExcluded]}>
                              {t(item.label)}
                            </Text>
                          </View>
                          <Text style={[styles.classificationConfidence, { color: accentColor }]}>
                            {coveragePercent}%
                          </Text>
                        </View>
                        <View style={styles.classificationBarTrack}>
                          <View
                            style={[
                              styles.classificationBarFill,
                              {
                                width: `${coveragePercent}%`,
                                backgroundColor: accentColor,
                              },
                            ]}
                          />
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </>
            )}

            {includedClassifications.length > 0 && (
              <>
                <Text style={styles.classificationTitle}>{t('Visual soundscape context')}</Text>
                <View style={styles.contextCard}>
                  <Text style={styles.contextHeadline}>{visualContext.dominantContext}</Text>
                  <Text style={styles.contextSummary}>
                    {formatVisualIndicatorSummary(visualContext)}
                  </Text>
                  <View style={styles.contextTagList}>
                    {visualContext.indicators
                      .filter((item) => item.level !== 'low')
                      .slice(0, 4)
                      .map((item) => (
                        <View key={item.key} style={styles.contextTag}>
                          <Text style={styles.contextTagText}>
                            {t(item.label)} {item.level}
                          </Text>
                        </View>
                      ))}
                  </View>
                </View>
              </>
            )}
            </View>
          )}

          {!isDetectorBusy && detectorErrorMessage && (
            <View style={styles.classificationResults}>
              <View style={styles.detectorWarning}>
                <View style={styles.detectorWarningIcon}>
                  <MaterialIcons name="error-outline" size={16} color={Colors.warning} />
                </View>
                <View style={styles.detectorWarningContent}>
                  <Text style={styles.detectorWarningTitle}>{t('Photo analysis failed')}</Text>
                  <Text style={styles.detectorWarningText}>{detectorErrorMessage}</Text>
                </View>
              </View>
            </View>
          )}
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: footerBottomPadding }]}>
          <View style={styles.previewActions}>
            <TouchableOpacity
              style={styles.retakeButton}
              onPress={handleRetake}
              accessibilityRole="button"
              accessibilityLabel={t('Retake photo')}
            >
              <MaterialIcons name="refresh" size={24} color={Colors.text} />
              <Text style={styles.retakeButtonText}>{t('Retake')}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.confirmButton, isDetectorBusy && styles.confirmButtonDisabled]}
              onPress={handleConfirm}
              disabled={isDetectorBusy}
              accessibilityRole="button"
              accessibilityLabel={t('Use captured photo')}
              accessibilityState={{ disabled: isDetectorBusy }}
            >
              <MaterialIcons name="check" size={24} color={Colors.background} />
              <Text style={styles.confirmButtonText}>{t('Use Photo')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  // Camera view
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('Capture Environment')}</Text>
        <Text style={styles.subtitle}>
          {t('Take a photo of your surroundings')}
        </Text>
      </View>

      <View style={styles.cameraContainer}>
        <CameraView
          ref={cameraRef}
          style={styles.camera}
          facing={facing}
        />

        <View pointerEvents="box-none" style={styles.cameraOverlay}>
          <TouchableOpacity
            style={styles.flipButton}
            onPress={handleFlipCamera}
            accessibilityRole="button"
            accessibilityLabel={t('Flip camera')}
          >
            <MaterialIcons name="flip-camera-ios" size={28} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </View>

      <View style={[styles.footer, { paddingBottom: footerBottomPadding }]}>
        <View style={styles.captureActions}>
          <TouchableOpacity
            style={styles.skipButton}
            onPress={onSkip}
            accessibilityRole="button"
            accessibilityLabel={t('Skip photo step')}
          >
            <Text style={styles.skipButtonText}>{t('Skip')}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.captureButton, isCapturing && styles.captureButtonDisabled]}
            onPress={handleCapture}
            disabled={isCapturing}
            accessibilityRole="button"
            accessibilityLabel={t('Capture photo')}
            accessibilityState={{ disabled: isCapturing }}
          >
            <View style={styles.captureButtonInner} />
          </TouchableOpacity>

          <View style={styles.spacer} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: 10,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.4,
    color: Colors.text,
    marginBottom: 4,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
  },
  permissionTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.text,
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  permissionText: {
    fontSize: 15,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: Spacing.xl,
  },
  permissionButton: {
    backgroundColor: Colors.primary,
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: Radius.full,
  },
  permissionButtonText: {
    color: Colors.background,
    fontSize: 17,
    fontWeight: '700',
  },
  skipLink: {
    marginTop: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  skipLinkText: {
    color: Colors.textMuted,
    fontSize: 15,
    fontWeight: '600',
  },
  cameraContainer: {
    flex: 1,
    marginHorizontal: Spacing.lg,
    borderRadius: Radius.lg,
    overflow: 'hidden',
    backgroundColor: '#000',
  },
  camera: {
    flex: 1,
  },
  cameraOverlay: {
    position: 'absolute',
    top: Spacing.md,
    right: Spacing.md,
  },
  flipButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.lg,
    minHeight: 220,
  },
  previewSection: {
    paddingTop: 4,
  },
  previewScroll: {
    flex: 1,
  },
  previewScrollContent: {
    paddingTop: 6,
  },
  footer: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    backgroundColor: Colors.background,
  },
  captureActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  skipButton: {
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  skipButtonText: {
    color: Colors.textMuted,
    fontSize: 16,
    fontWeight: '600',
  },
  captureButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.surface,
    borderWidth: 5,
    borderColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.primary,
  },
  captureButtonDisabled: {
    opacity: 0.5,
  },
  captureButtonInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: Colors.primary,
  },
  spacer: {
    width: 60, // Same width as skip button area for centering
  },
  previewActions: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  retakeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 18,
    backgroundColor: Colors.surface,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.surfaceHighlight,
  },
  retakeButtonText: {
    color: Colors.text,
    fontSize: 17,
    fontWeight: '600',
  },
  confirmButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 18,
    backgroundColor: Colors.primary,
    borderRadius: Radius.full,
  },
  confirmButtonText: {
    color: Colors.background,
    fontSize: 17,
    fontWeight: '700',
  },
  confirmButtonDisabled: {
    opacity: 0.6,
  },
  classifyingOverlay: {
    position: 'absolute',
    top: 0,
    left: Spacing.lg,
    right: Spacing.lg,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  classifyingText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
    marginTop: Spacing.sm,
  },
  classificationResults: {
    paddingHorizontal: Spacing.lg,
    paddingTop: 12,
  },
  overlayToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: Radius.full,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.surfaceHighlight,
  },
  overlayToggleRow: {
    marginTop: 10,
    marginHorizontal: Spacing.lg,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  overlayToggleText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textMuted,
  },
  classificationTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textMuted,
    marginBottom: 12,
    letterSpacing: 0.8,
  },
  classificationHint: {
    fontSize: 13,
    color: Colors.textMuted,
    marginTop: -4,
    marginBottom: 10,
    lineHeight: 18,
  },
  classificationList: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.surfaceHighlight,
    overflow: 'hidden',
  },
  classificationRow: {
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: Colors.surfaceHighlight,
  },
  classificationRowLast: {
    borderBottomWidth: 0,
  },
  classificationRowExcluded: {
    opacity: 0.48,
  },
  classificationRowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  classificationMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 7,
  },
  classificationRank: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  classificationRankText: {
    fontSize: 11,
    fontWeight: '700',
  },
  classificationLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.text,
    flexShrink: 1,
  },
  classificationLabelExcluded: {
    textDecorationLine: 'line-through',
  },
  classificationCountBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Radius.full,
    backgroundColor: Colors.secondaryMuted,
  },
  classificationCountText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.textMuted,
    letterSpacing: 0.2,
  },
  classificationConfidence: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textMuted,
  },
  classificationBarTrack: {
    marginTop: 8,
    height: 3,
    borderRadius: 999,
    backgroundColor: Colors.secondaryMuted,
    overflow: 'hidden',
  },
  classificationBarFill: {
    height: '100%',
    borderRadius: 999,
  },
  contextCard: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.surfaceHighlight,
    backgroundColor: Colors.surface,
    padding: 14,
  },
  contextHeadline: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 4,
  },
  contextSummary: {
    fontSize: 14,
    lineHeight: 20,
    color: Colors.textMuted,
  },
  contextTagList: {
    marginTop: 10,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  contextTag: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: Radius.full,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.surfaceHighlight,
  },
  contextTagText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.text,
    textTransform: 'capitalize',
  },
  detectorWarning: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.surfaceHighlight,
  },
  detectorWarningIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.warningMuted,
  },
  detectorWarningContent: {
    flex: 1,
    gap: 2,
  },
  detectorWarningTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
  },
  detectorWarningText: {
    fontSize: 13,
    lineHeight: 18,
    color: Colors.textMuted,
  },
});
