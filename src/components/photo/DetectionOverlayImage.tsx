import React, { useEffect, useMemo, useState } from 'react';
import {
  Image,
  LayoutChangeEvent,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Colors, Radius } from '../../theme/colors';
import type { ImageClassification } from '../../utils/imageClassification';

const DETECTION_COLORS = ['#8DA8A1', '#A7B88A', '#C9A27E', '#A593B7'];

interface Props {
  uri: string;
  detections?: ImageClassification[];
  maxHeight?: number;
  placeholderHeight?: number;
  borderRadius?: number;
  showBoxes?: boolean;
  showLabels?: boolean;
  segmentationOverlayUri?: string;
  showSegmentationOverlay?: boolean;
}

export function getDetectionAccent(index: number): string {
  return DETECTION_COLORS[index % DETECTION_COLORS.length];
}

export default function DetectionOverlayImage({
  uri,
  detections = [],
  maxHeight,
  placeholderHeight = 220,
  borderRadius = Radius.lg,
  showBoxes = false,
  showLabels = false,
  segmentationOverlayUri,
  showSegmentationOverlay = false,
}: Props) {
  const [containerWidth, setContainerWidth] = useState(0);
  const [imageSize, setImageSize] = useState<{ width: number; height: number } | null>(null);

  useEffect(() => {
    let cancelled = false;

    Image.getSize(
      uri,
      (width, height) => {
        if (!cancelled && width > 0 && height > 0) {
          setImageSize({ width, height });
        }
      },
      () => {
        if (!cancelled) {
          setImageSize({ width: 4, height: 5 });
        }
      }
    );

    return () => {
      cancelled = true;
    };
  }, [uri]);

  const frame = useMemo(() => {
    if (!imageSize || containerWidth <= 0) {
      return null;
    }

    const widthScale = containerWidth / imageSize.width;
    const heightScale = maxHeight ? maxHeight / imageSize.height : Number.POSITIVE_INFINITY;
    const scale = Math.min(widthScale, heightScale);

    return {
      width: imageSize.width * scale,
      height: imageSize.height * scale,
    };
  }, [containerWidth, imageSize, maxHeight]);

  const handleLayout = (event: LayoutChangeEvent) => {
    const nextWidth = event.nativeEvent.layout.width;
    if (nextWidth > 0 && nextWidth !== containerWidth) {
      setContainerWidth(nextWidth);
    }
  };

  return (
    <View style={styles.container} onLayout={handleLayout}>
      {frame ? (
        <View
          style={[
            styles.frame,
            {
              width: frame.width,
              height: frame.height,
              borderRadius,
            },
          ]}
        >
          <Image source={{ uri }} style={styles.image} resizeMode="cover" />
          {showSegmentationOverlay && segmentationOverlayUri && (
            <Image
              source={{ uri: segmentationOverlayUri }}
              style={styles.segmentationOverlay}
              resizeMode="stretch"
            />
          )}

          {showBoxes && detections.map((detection, index) => {
            if (!detection.boundingBox) {
              return null;
            }

            const color = getDetectionAccent(index);
            const left = clamp01(detection.boundingBox.left) * frame.width;
            const top = clamp01(detection.boundingBox.top) * frame.height;
            const width = clamp01(detection.boundingBox.width) * frame.width;
            const height = clamp01(detection.boundingBox.height) * frame.height;

            if (width <= 1 || height <= 1) {
              return null;
            }

            return (
              <View
                key={`${detection.label}-${index}`}
                style={[
                  styles.box,
                  {
                    left,
                    top,
                    width,
                    height,
                    borderColor: color,
                  },
                ]}
              >
                {showLabels && (
                  <View style={[styles.labelTag, { borderColor: color }]}>
                    <View style={[styles.labelDot, { backgroundColor: color }]} />
                    <Text numberOfLines={1} style={styles.labelTagText}>
                      {detection.label} {Math.round(detection.confidence * 100)}%
                    </Text>
                  </View>
                )}
              </View>
            );
          })}
        </View>
      ) : (
        <View
          style={[
            styles.placeholder,
            {
              height: maxHeight ?? placeholderHeight,
              borderRadius,
            },
          ]}
        />
      )}
    </View>
  );
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  frame: {
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: Colors.surface,
  },
  image: {
    ...StyleSheet.absoluteFillObject,
  },
  segmentationOverlay: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.62,
  },
  box: {
    position: 'absolute',
    borderWidth: 1.5,
    borderRadius: 12,
  },
  labelTag: {
    position: 'absolute',
    top: 6,
    left: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    maxWidth: '92%',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: Radius.full,
    backgroundColor: '#F8F3E9F2',
    borderWidth: 1,
  },
  labelDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  labelTagText: {
    color: Colors.text,
    fontSize: 11,
    fontWeight: '700',
  },
  placeholder: {
    width: '100%',
    backgroundColor: '#E6E0D5',
  },
});
