import React, { forwardRef, useCallback, useMemo, useState } from 'react';
import { LayoutChangeEvent, StyleSheet, View, Text, Platform } from 'react-native';
import { Canvas, ColorMatrix, FilterMode, Image, Paint, Skia, useImage } from '@shopify/react-native-skia';
import { Colors } from '../../theme/colors';
import { SpectrogramData } from '../../hooks/useSpectrogramData';
import { LoggingService } from '../../services/logging/LoggingService';
import { t } from '../../i18n';

// Frequency labels for the Y-axis
const FREQUENCY_LABELS = [
  { freq: 8000, label: '8k', position: 0 },
  { freq: 4000, label: '4k', position: 0.5 },
  { freq: 2000, label: '2k', position: 0.75 },
  { freq: 1000, label: '1k', position: 0.875 },
  { freq: 500, label: '500', position: 0.9375 },
  { freq: 0, label: '0', position: 1 },
];

const LINEAR_SAMPLING = { filter: FilterMode.Linear } as const;

interface SpectrogramViewProps {
  spectrogramData: SpectrogramData | null;
  width?: number;
  height?: number;
  showFrequencyLabels?: boolean;
  showGpsOverlay?: boolean;
  gpsCoordinates?: { latitude: number; longitude: number } | null;
}

function SpectrogramViewInner(
  {
    spectrogramData,
    width: propWidth,
    height: propHeight = 180,
    showFrequencyLabels = true,
    showGpsOverlay = true,
    gpsCoordinates,
  }: SpectrogramViewProps,
  ref: React.Ref<any>
) {
  // Create Skia image from pixel data
  const skiaImage = useMemo(() => {
    if (!spectrogramData?.pixels || !spectrogramData.width || !spectrogramData.height) {
      return null;
    }

    try {
      const width = spectrogramData.width;
      const height = spectrogramData.height;
      const bytesPerPixel = 4;
      const rowBytes = width * bytesPerPixel;
      const expectedBytes = rowBytes * height;
      const actualBytes = spectrogramData.pixels.length;

      if (__DEV__ && LoggingService.getDebugEnabled() && Math.random() < 0.1) {
        LoggingService.debug('Skia spectrogram buffer', {
          width,
          height,
          rowBytes,
          expectedBytes,
          actualBytes,
          firstPixel: [
            spectrogramData.pixels[0],
            spectrogramData.pixels[1],
            spectrogramData.pixels[2],
            spectrogramData.pixels[3],
          ],
        });
      }

      if (expectedBytes !== actualBytes) {
        LoggingService.error('Skia buffer size variation', {
          expectedBytes,
          actualBytes,
          width,
          height,
        });
        return null;
      }

      // Create image data from RGBA pixel buffer
      // 4 = RGBA_8888, 5 = BGRA_8888. Android Skia often prefers BGRA_8888 depending on Endianness
      const colorType = Platform.OS === 'android' ? 5 : 4;

      const imageInfo = {
        width: width,
        height: height,
        colorType: colorType,
        alphaType: 1, // Opaque
      };

      // Force a new byte array copy to prevent Android RN-bridge from 
      // caching the memory reference, causing frozen/striped frames
      const freshBytes = new Uint8Array(spectrogramData.pixels);
      const data = Skia.Data.fromBytes(freshBytes);
      const image = Skia.Image.MakeImage(imageInfo, data, rowBytes);
      return image;
    } catch (error) {
      LoggingService.error('Failed to create Skia spectrogram image', {
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }, [spectrogramData?.pixels, spectrogramData?.width, spectrogramData?.height, spectrogramData?.timestamp]);

  const canvasWidth = propWidth || 300;
  const canvasHeight = propHeight;

  return (
    <View style={styles.container} ref={ref}>
      <View style={styles.spectrogramContainer}>
        {/* Spectrogram canvas — full width */}
        <View style={[styles.canvasContainer, { height: canvasHeight }]}>
          {skiaImage ? (
            <Canvas style={{ width: canvasWidth, height: canvasHeight }}>
              <Image
                image={skiaImage}
                x={0}
                y={0}
                width={canvasWidth}
                height={canvasHeight}
                fit="fill"
                sampling={LINEAR_SAMPLING}
              />
            </Canvas>
          ) : (
            <View style={[styles.noDataOverlay, StyleSheet.absoluteFill]}>
              <Text style={styles.noDataText}>
                {spectrogramData ? t('Processing audio...') : t('Waiting for audio...')}
              </Text>
            </View>
          )}

          {/* Frequency labels — overlay on left edge */}
          {showFrequencyLabels && (
            <View style={[styles.frequencyLabels, { height: canvasHeight }]}>
              {FREQUENCY_LABELS.map(({ freq, label, position }) => (
                <Text
                  key={freq}
                  style={[
                    styles.frequencyLabel,
                    { top: position * (canvasHeight - 16) },
                  ]}
                >
                  {label}
                </Text>
              ))}
            </View>
          )}

          {/* GPS overlay */}
          {showGpsOverlay && gpsCoordinates && (
            <View style={styles.gpsOverlay}>
              <Text style={styles.gpsText}>
                {gpsCoordinates.latitude.toFixed(4)}, {gpsCoordinates.longitude.toFixed(4)}
              </Text>
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

export const SpectrogramView = forwardRef(SpectrogramViewInner);

// Static spectrogram display (for review/playback)
interface StaticSpectrogramProps {
  imageUri?: string;
  width?: number;
  height?: number;
  displayBoost?: number;
}

export function StaticSpectrogram({
  imageUri,
  width: propWidth,
  height: propHeight = 150,
  displayBoost,
}: StaticSpectrogramProps) {
  const image = useImage(imageUri || null);
  const [measuredWidth, setMeasuredWidth] = useState(0);
  const resolvedWidth = propWidth ?? (measuredWidth > 0 ? measuredWidth : 300);
  const visualBoost = Math.min(
    2.2,
    Math.max(1, displayBoost && displayBoost > 1 ? 1 + Math.log2(displayBoost) * 0.35 : 1)
  );
  const brightnessOffset = Math.round((visualBoost - 1) * 10);
  const handleLayout = useCallback((event: LayoutChangeEvent) => {
    if (propWidth == null) {
      setMeasuredWidth(event.nativeEvent.layout.width);
    }
  }, [propWidth]);

  if (!imageUri) {
    return (
      <View
        style={[styles.placeholder, { height: propHeight, width: propWidth }]}
        onLayout={handleLayout}
      >
        <Text style={styles.placeholderText}>{t('No spectrogram available')}</Text>
      </View>
    );
  }

  return (
    <View
      style={[styles.staticContainer, { height: propHeight, width: propWidth }]}
      onLayout={handleLayout}
    >
      {image ? (
        <Canvas style={{ flex: 1 }}>
          <Image
            image={image}
            x={0}
            y={0}
            width={resolvedWidth}
            height={propHeight}
            fit="fill"
            sampling={LINEAR_SAMPLING}
          >
            {visualBoost > 1.01 ? (
              <Paint>
                <ColorMatrix
                  matrix={[
                    visualBoost, 0, 0, 0, brightnessOffset,
                    0, visualBoost, 0, 0, brightnessOffset,
                    0, 0, visualBoost, 0, brightnessOffset,
                    0, 0, 0, 1, 0,
                  ]}
                />
              </Paint>
            ) : null}
          </Image>
        </Canvas>
      ) : (
        <View style={styles.placeholder}>
          <Text style={styles.placeholderText}>{t('Loading spectrogram...')}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  spectrogramContainer: {
    flex: 1,
  },
  frequencyLabels: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: 32,
    zIndex: 10,
  },
  frequencyLabel: {
    position: 'absolute',
    left: 4,
    fontSize: 9,
    color: 'rgba(255,255,255,0.55)',
    fontVariant: ['tabular-nums'],
  },
  canvasContainer: {
    flex: 1,
    backgroundColor: '#0D1B2A',
    overflow: 'hidden',
  },
  staticContainer: {
    backgroundColor: '#0D1B2A',
    overflow: 'hidden',
  },
  gpsOverlay: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  gpsText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontVariant: ['tabular-nums'],
  },
  noDataOverlay: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0D1B2A',
  },
  noDataText: {
    color: Colors.textMuted,
    fontSize: 14,
  },
  timeAxis: {
    paddingTop: 4,
    paddingLeft: 36,
  },
  timeLabel: {
    color: Colors.textMuted,
    fontSize: 10,
  },
  placeholder: {
    backgroundColor: '#0D1B2A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    color: Colors.textMuted,
    fontSize: 14,
  },
});
