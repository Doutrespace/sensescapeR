import React, { useMemo, useCallback, useEffect, useRef, useState } from 'react';
import { StyleProp, StyleSheet, TouchableOpacity, View, ViewStyle } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import { LoggingService } from '../../services/logging';
import { Colors, Radius, Shadows } from '../../theme/colors';
import { LEAFLET_CSS, LEAFLET_JS } from './leafletBundle';

export interface OpenStreetMapMarker {
  id: string;
  latitude: number;
  longitude: number;
  color?: string;
  title?: string;
  subtitle?: string;
  count?: number;
  isCluster?: boolean;
}

export interface OpenStreetMapBounds {
  northeast: { latitude: number; longitude: number };
  southwest: { latitude: number; longitude: number };
  center: { latitude: number; longitude: number };
  zoom: number;
}

export type OpenStreetMapBasemap = 'light' | 'satellite';

interface Props {
  markers: OpenStreetMapMarker[];
  initialCenter?: { latitude: number; longitude: number; zoom?: number } | null;
  userLocation?: { latitude: number; longitude: number } | null;
  selectedMarkerId?: string | null;
  fitToMarkers?: boolean;
  basemap?: OpenStreetMapBasemap;
  onMarkerPress?: (id: string) => void;
  onBoundsChange?: (bounds: OpenStreetMapBounds) => void;
  style?: StyleProp<ViewStyle>;
  bottomInset?: number;
}

export default function OpenStreetMapView({
  markers,
  initialCenter,
  userLocation,
  selectedMarkerId,
  fitToMarkers = false,
  basemap = 'light',
  onMarkerPress,
  onBoundsChange,
  style,
  bottomInset = 0,
}: Props) {
  const WebViewComponent = WebView as unknown as React.ComponentType<any>;
  const webViewRef = useRef<any>(null);
  const [isMapReady, setIsMapReady] = useState(false);
  const payload = useMemo(
    () =>
      JSON.stringify({
        markers,
        initialCenter,
        userLocation,
        selectedMarkerId,
        fitToMarkers,
        basemap,
      }).replace(/</g, '\\u003c'),
    [basemap, fitToMarkers, initialCenter, markers, selectedMarkerId, userLocation]
  );
  const html = useMemo(() => {
    const controlBottomOffset = Math.max(12, bottomInset + 8);
    return `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
    <style>
      ${LEAFLET_CSS}

      html, body, #map {
        margin: 0;
        padding: 0;
        width: 100%;
        height: 100%;
        background: ${Colors.background};
      }

      body {
        overflow: hidden;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }

      .leaflet-container {
        background: #efe8dc;
      }

      .leaflet-control-attribution {
        background: rgba(251, 248, 241, 0.92);
        color: ${Colors.textMuted};
        border-radius: 10px;
        margin: 0 10px ${controlBottomOffset}px 0;
        padding: 3px 8px;
        box-shadow: 0 6px 18px rgba(23, 23, 23, 0.08);
        display: inline-block;
        width: auto;
        max-width: 52%;
      }

      .leaflet-control-attribution a {
        color: ${Colors.text};
      }

      .soundscape-marker {
        position: relative;
        width: 22px;
        height: 22px;
        transform: translate(-11px, -11px);
      }

      .soundscape-marker__halo {
        position: absolute;
        inset: 0;
        border-radius: 999px;
        opacity: 0.18;
      }

      .soundscape-marker__ring {
        position: absolute;
        inset: 3px;
        border-radius: 999px;
        border: 1.5px solid rgba(23, 23, 23, 0.72);
        background: rgba(251, 248, 241, 0.82);
        box-shadow: 0 3px 10px rgba(23, 23, 23, 0.12);
      }

      .soundscape-marker__core {
        position: absolute;
        inset: 7px;
        border-radius: 999px;
        border: 1px solid rgba(23, 23, 23, 0.16);
      }

      .soundscape-marker__count {
        position: absolute;
        inset: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 10px;
        font-weight: 700;
        color: ${Colors.text};
        letter-spacing: 0.2px;
      }

      .soundscape-marker--cluster .soundscape-marker__halo {
        opacity: 0.24;
      }

      .soundscape-marker--cluster .soundscape-marker__ring {
        background: rgba(251, 248, 241, 0.98);
        border-width: 2px;
      }

      .soundscape-marker--selected {
        width: 28px;
        height: 28px;
        transform: translate(-14px, -14px);
      }

      .soundscape-marker--selected .soundscape-marker__halo {
        inset: -2px;
        opacity: 0.28;
        animation: soundscapePulse 1.8s ease-out infinite;
      }

      .soundscape-marker--selected .soundscape-marker__ring {
        inset: 4px;
        border-width: 2px;
        background: rgba(251, 248, 241, 0.94);
        box-shadow: 0 6px 16px rgba(23, 23, 23, 0.16);
      }

      .soundscape-marker--selected .soundscape-marker__core {
        inset: 9px;
      }

      @keyframes soundscapePulse {
        0% {
          transform: scale(0.94);
          opacity: 0.34;
        }
        70% {
          transform: scale(1.18);
          opacity: 0.06;
        }
        100% {
          transform: scale(1.18);
          opacity: 0;
        }
      }
    </style>
  </head>
  <body>
    <div id="map"></div>
    <script>${LEAFLET_JS}</script>
    <script>
      const initialConfig = {
        markers: [],
        initialCenter: null,
        userLocation: null,
        selectedMarkerId: null,
        fitToMarkers: false,
        basemap: 'light',
      };

      function postMessage(payload) {
        if (window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage(JSON.stringify(payload));
        }
      }

      function buildMap() {
        function hexToRgba(hex, alpha) {
          if (!hex) return 'rgba(23,23,23,' + alpha + ')';
          const normalized = hex.replace('#', '');
          const raw = normalized.length === 3
            ? normalized.split('').map((c) => c + c).join('')
            : normalized;

          const int = parseInt(raw, 16);
          const r = (int >> 16) & 255;
          const g = (int >> 8) & 255;
          const b = int & 255;
          return 'rgba(' + r + ',' + g + ',' + b + ',' + alpha + ')';
        }

        function getMarkerSize(zoom, isSelected, isCluster) {
          if (isCluster) {
            if (zoom >= 17) return isSelected ? 40 : 34;
            if (zoom >= 15) return isSelected ? 37 : 31;
            if (zoom >= 13) return isSelected ? 34 : 28;
            return isSelected ? 31 : 25;
          }

          if (zoom >= 17) return isSelected ? 34 : 28;
          if (zoom >= 15) return isSelected ? 31 : 25;
          if (zoom >= 13) return isSelected ? 28 : 22;
          return isSelected ? 25 : 19;
        }

        function buildMarkerIcon(marker, isSelected, zoom) {
          const color = marker.color || '#171717';
          const haloColor = hexToRgba(color, isSelected ? 0.3 : 0.18);
          const ringBackground = isSelected
            ? 'rgba(251, 248, 241, 0.96)'
            : 'rgba(251, 248, 241, 0.84)';
          const isCluster = !!marker.isCluster;
          const size = getMarkerSize(zoom, isSelected, isCluster);
          const iconAnchor = Math.round(size / 2);
          const ringInset = Math.max(3, Math.round(size * 0.16));
          const coreInset = Math.max(ringInset + 3, Math.round(size * 0.34));
          const countText = typeof marker.count === 'number' && marker.count > 1
            ? '<div class="soundscape-marker__count">' + marker.count + '</div>'
            : '';

          return L.divIcon({
            className: '',
            iconSize: [size, size],
            iconAnchor: [iconAnchor, iconAnchor],
            html: [
              '<div class="soundscape-marker' + (isSelected ? ' soundscape-marker--selected' : '') + (isCluster ? ' soundscape-marker--cluster' : '') + '" style="width:' + size + 'px;height:' + size + 'px;transform:translate(-' + iconAnchor + 'px,-' + iconAnchor + 'px)">',
              '<div class="soundscape-marker__halo" style="background:' + haloColor + ';"></div>',
              '<div class="soundscape-marker__ring" style="inset:' + ringInset + 'px;border-color:' + color + '; background:' + ringBackground + ';"></div>',
              '<div class="soundscape-marker__core" style="inset:' + coreInset + 'px;background:' + color + ';"></div>',
              countText,
              '</div>',
            ].join(''),
          });
        }

        const map = L.map('map', {
          zoomControl: false,
          preferCanvas: true,
          attributionControl: true,
        });
        window.__soundscapeMap = map;
        window.__soundscapeMarkerLayer = [];
        window.__soundscapeUserLayers = [];
        window.__soundscapeViewportInitialized = false;
        window.__lastConfig = initialConfig;
        window.__soundscapeBaseLayers = {
          // CARTO's light basemap now returns "API key required" tiles, so the
          // grey style uses Esri's keyless Light Gray canvas (base + labels).
          light: L.layerGroup([
            L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
              maxZoom: 19,
              maxNativeZoom: 16,
              attribution: 'Tiles &copy; Esri &mdash; Esri, HERE, Garmin, &copy; OpenStreetMap contributors',
            }),
            L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}', {
              maxZoom: 19,
              maxNativeZoom: 16,
            }),
          ]),
          satellite: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
            maxZoom: 19,
            attribution: 'Tiles &copy; Esri',
          }),
        };
        window.__soundscapeActiveBasemap = null;

        function renderBasemap(config) {
          const nextBasemap = config.basemap === 'satellite' ? 'satellite' : 'light';
          if (window.__soundscapeActiveBasemap === nextBasemap) {
            return;
          }

          Object.keys(window.__soundscapeBaseLayers).forEach((key) => {
            const layer = window.__soundscapeBaseLayers[key];
            if (map.hasLayer(layer)) {
              map.removeLayer(layer);
            }
          });

          window.__soundscapeBaseLayers[nextBasemap].addTo(map);
          window.__soundscapeActiveBasemap = nextBasemap;
        }

        function renderUserLocation(config) {
          window.__soundscapeUserLayers.forEach((layer) => map.removeLayer(layer));
          window.__soundscapeUserLayers = [];

          if (config.userLocation) {
            const accuracyCircle = L.circle([config.userLocation.latitude, config.userLocation.longitude], {
              radius: 56,
              color: '#6C8AA7',
              weight: 1,
              fillColor: '#6C8AA7',
              fillOpacity: 0.12,
            }).addTo(map);

            const locationMarker = L.circleMarker([config.userLocation.latitude, config.userLocation.longitude], {
              radius: 6,
              color: '#6C8AA7',
              weight: 2,
              fillColor: '#F8F3E9',
              fillOpacity: 1,
            }).addTo(map);

            window.__soundscapeUserLayers = [accuracyCircle, locationMarker];
          }
        }

        function renderMarkers(config) {
          const markerLayer = window.__soundscapeMarkerLayer;
          markerLayer.forEach((layer) => map.removeLayer(layer));
          markerLayer.length = 0;
          const currentZoom = map.getZoom();
          const bounds = [];

          config.markers.forEach((marker) => {
          const isSelected = marker.id === config.selectedMarkerId;
          const circle = L.marker([marker.latitude, marker.longitude], {
            icon: buildMarkerIcon(marker, isSelected, currentZoom),
          }).addTo(map);

          circle.on('click', () => {
            postMessage({ type: 'markerPress', id: marker.id });
          });

          if (marker.title || marker.subtitle) {
            const title = marker.title ? '<strong>' + marker.title + '</strong>' : '';
            const subtitle = marker.subtitle ? '<div style="margin-top:4px;color:${Colors.textMuted};font-size:12px;">' + marker.subtitle + '</div>' : '';
            circle.bindPopup(
              '<div style="min-width:140px;color:${Colors.text};font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;">' + title + subtitle + '</div>',
              { autoPan: false }
            );
            if (isSelected) {
              circle.openPopup();
            }
          }

          bounds.push([marker.latitude, marker.longitude]);
          markerLayer.push(circle);
          });

          if (!window.__soundscapeViewportInitialized) {
            if (config.fitToMarkers && bounds.length > 0) {
              map.fitBounds(bounds, { padding: [36, 36] });
            } else {
              const center = config.initialCenter || config.userLocation || { latitude: 20, longitude: 0, zoom: 2 };
              map.setView([center.latitude, center.longitude], center.zoom || 13);
            }
            window.__soundscapeViewportInitialized = true;
          }
        }

        window.__updateMapConfig = function(nextConfig) {
          window.__lastConfig = nextConfig;
          renderBasemap(nextConfig);
          renderUserLocation(nextConfig);
          renderMarkers(nextConfig);
        };

        window.__updateMapConfig(initialConfig);

        map.on('moveend', () => {
          const currentBounds = map.getBounds();
          const centerPoint = map.getCenter();

          postMessage({
            type: 'boundsChange',
            northeast: {
              latitude: currentBounds.getNorthEast().lat,
              longitude: currentBounds.getNorthEast().lng,
            },
            southwest: {
              latitude: currentBounds.getSouthWest().lat,
              longitude: currentBounds.getSouthWest().lng,
            },
            center: {
              latitude: centerPoint.lat,
              longitude: centerPoint.lng,
            },
            zoom: map.getZoom(),
          });
        });

        map.on('zoomend', () => {
          if (window.__updateMapConfig && window.__lastConfig) {
            window.__updateMapConfig(window.__lastConfig);
          }
        });

        setTimeout(() => {
          map.invalidateSize();
        }, 0);

        postMessage({ type: 'ready' });
      }

      document.addEventListener('DOMContentLoaded', buildMap);
    </script>
  </body>
</html>
`;
  }, [bottomInset]);
  const htmlSource = useMemo(() => ({ html }), [html]);

  const handleMessage = useCallback((event: WebViewMessageEvent) => {
    try {
      const payload = JSON.parse(event.nativeEvent.data) as
        | ({ type: 'markerPress'; id: string })
        | ({ type: 'ready' })
        | ({ type: 'boundsChange' } & OpenStreetMapBounds);

      if (payload.type === 'ready') {
        setIsMapReady(true);
        return;
      }

      if (payload.type === 'markerPress') {
        onMarkerPress?.(payload.id);
        return;
      }

      if (payload.type === 'boundsChange') {
        onBoundsChange?.({
          northeast: payload.northeast,
          southwest: payload.southwest,
          center: payload.center,
          zoom: payload.zoom,
        });
      }
    } catch (error) {
      LoggingService.warn('Failed to parse OpenStreetMap WebView message', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }, [onBoundsChange, onMarkerPress]);

  useEffect(() => {
    if (!isMapReady || !webViewRef.current) {
      return;
    }

    const script = `
      window.__lastConfig = ${payload};
      if (window.__updateMapConfig) {
        window.__updateMapConfig(window.__lastConfig);
      }
      true;
    `;
    webViewRef.current.injectJavaScript(script);
  }, [isMapReady, payload]);

  const handleRecenterToUser = useCallback(() => {
    if (!isMapReady || !webViewRef.current || !userLocation) {
      return;
    }

    void Haptics.selectionAsync();

    const script = `
      if (window.__soundscapeMap) {
        var targetZoom = Math.max(window.__soundscapeMap.getZoom(), 16);
        window.__soundscapeMap.setView([${userLocation.latitude}, ${userLocation.longitude}], targetZoom, {
          animate: true,
          duration: 0.6
        });
      }
      true;
    `;

    webViewRef.current.injectJavaScript(script);
  }, [isMapReady, userLocation]);

  const handleZoomIn = useCallback(() => {
    if (!isMapReady || !webViewRef.current) {
      return;
    }

    void Haptics.selectionAsync();
    webViewRef.current.injectJavaScript(`
      if (window.__soundscapeMap) {
        window.__soundscapeMap.zoomIn();
      }
      true;
    `);
  }, [isMapReady]);

  const handleZoomOut = useCallback(() => {
    if (!isMapReady || !webViewRef.current) {
      return;
    }

    void Haptics.selectionAsync();
    webViewRef.current.injectJavaScript(`
      if (window.__soundscapeMap) {
        window.__soundscapeMap.zoomOut();
      }
      true;
    `);
  }, [isMapReady]);

  return (
    <View style={[styles.container, style]}>
      <WebViewComponent
        ref={webViewRef}
        originWhitelist={['*']}
        source={htmlSource}
        onMessage={handleMessage}
        style={styles.webview}
        javaScriptEnabled
        domStorageEnabled
        setSupportMultipleWindows={false}
      />
      <View style={[styles.controlStack, { bottom: bottomInset + 14 }]}>
        <View style={styles.zoomGroup}>
          <TouchableOpacity
            style={[styles.controlButton, styles.zoomButton]}
            onPress={handleZoomIn}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Zoom in"
          >
            <MaterialIcons name="add" size={24} color={Colors.text} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.controlButton, styles.zoomButton, styles.zoomButtonLast]}
            onPress={handleZoomOut}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Zoom out"
          >
            <MaterialIcons name="remove" size={24} color={Colors.text} />
          </TouchableOpacity>
        </View>
        {userLocation ? (
          <TouchableOpacity
            style={styles.controlButton}
            onPress={handleRecenterToUser}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Center map on my location"
            accessibilityHint="Move the map back to your current location"
          >
            <MaterialIcons name="my-location" size={18} color={Colors.text} />
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: 'hidden',
    borderRadius: Radius.lg,
    backgroundColor: Colors.background,
  },
  webview: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  controlStack: {
    position: 'absolute',
    right: 14,
    alignItems: 'center',
    gap: 10,
  },
  zoomGroup: {
    borderRadius: Radius.full,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(216, 209, 195, 0.95)',
    ...Shadows.md,
  },
  controlButton: {
    width: 42,
    height: 42,
    borderRadius: Radius.full,
    backgroundColor: 'rgba(251, 248, 241, 0.96)',
    borderWidth: 1,
    borderColor: 'rgba(216, 209, 195, 0.95)',
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.md,
  },
  zoomButton: {
    borderRadius: 0,
    borderWidth: 0,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(216, 209, 195, 0.95)',
  },
  zoomButtonLast: {
    borderBottomWidth: 0,
  },
});
