/**
 * Browser implementation of the spectrogram views. The native version draws
 * with Skia; here the same RGBA pixel buffer is painted onto an HTML canvas.
 */
import React, { forwardRef, useEffect, useRef } from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { Colors } from '../../theme/colors';
import { SpectrogramData } from '../../hooks/useSpectrogramData';
import { t } from '../../i18n';

const FREQUENCY_LABELS = [
  { freq: 8000, label: '8k', position: 0 },
  { freq: 4000, label: '4k', position: 0.5 },
  { freq: 2000, label: '2k', position: 0.75 },
  { freq: 1000, label: '1k', position: 0.875 },
  { freq: 500, label: '500', position: 0.9375 },
  { freq: 0, label: '0', position: 1 },
];

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
    height: propHeight = 180,
    showFrequencyLabels = true,
    showGpsOverlay = true,
    gpsCoordinates,
  }: SpectrogramViewProps,
  ref: React.Ref<any>
) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const bufferWidth = spectrogramData?.width ?? 0;
  const bufferHeight = spectrogramData?.height ?? 0;
  const hasData = !!spectrogramData?.pixels && bufferWidth > 0 && bufferHeight > 0;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !spectrogramData?.pixels || !bufferWidth || !bufferHeight) {
      return;
    }
    if (spectrogramData.pixels.length !== bufferWidth * bufferHeight * 4) {
      return;
    }

    if (canvas.width !== bufferWidth || canvas.height !== bufferHeight) {
      canvas.width = bufferWidth;
      canvas.height = bufferHeight;
    }

    const context = canvas.getContext('2d');
    if (!context) {
      return;
    }

    const pixels = new Uint8ClampedArray(
      spectrogramData.pixels.buffer as ArrayBuffer,
      spectrogramData.pixels.byteOffset,
      spectrogramData.pixels.length
    );
    context.putImageData(new ImageData(pixels, bufferWidth, bufferHeight), 0, 0);
  }, [spectrogramData?.pixels, spectrogramData?.timestamp, bufferWidth, bufferHeight]);

  return (
    <View style={styles.container} ref={ref}>
      <View style={styles.spectrogramContainer}>
        <View style={[styles.canvasContainer, { height: propHeight }]}>
          {React.createElement('canvas', {
            ref: canvasRef,
            style: {
              width: '100%',
              height: propHeight,
              display: hasData ? 'block' : 'none',
            },
          })}

          {!hasData && (
            <View style={[styles.noDataOverlay, StyleSheet.absoluteFill]}>
              <Text style={styles.noDataText}>{t('Waiting for audio...')}</Text>
            </View>
          )}

          {showFrequencyLabels && (
            <View style={[styles.frequencyLabels, { height: propHeight }]}>
              {FREQUENCY_LABELS.map(({ freq, label, position }) => (
                <Text
                  key={freq}
                  style={[styles.frequencyLabel, { top: position * (propHeight - 16) }]}
                >
                  {label}
                </Text>
              ))}
            </View>
          )}

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
  const visualBoost = Math.min(
    2.2,
    Math.max(1, displayBoost && displayBoost > 1 ? 1 + Math.log2(displayBoost) * 0.35 : 1)
  );

  if (!imageUri) {
    return (
      <View style={[styles.placeholder, { height: propHeight, width: propWidth }]}>
        <Text style={styles.placeholderText}>{t('No spectrogram available')}</Text>
      </View>
    );
  }

  return (
    <View style={[styles.staticContainer, { height: propHeight, width: propWidth }]}>
      {React.createElement('img', {
        src: imageUri,
        alt: 'Spectrogram of the recording',
        draggable: false,
        style: {
          width: '100%',
          height: '100%',
          objectFit: 'fill',
          display: 'block',
          filter: visualBoost > 1.01 ? `brightness(${visualBoost.toFixed(2)})` : undefined,
        },
      })}
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
