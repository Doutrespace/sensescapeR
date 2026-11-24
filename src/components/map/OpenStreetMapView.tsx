import React, { useMemo, useCallback, useEffect, useRef, useState } from 'react';
import { StyleProp, StyleSheet, TouchableOpacity, View, ViewStyle } from 'react-native';
import { MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import { LoggingService } from '../../services/logging';
import { Colors, Radius, Shadows } from '../../theme/colors';
import { LEAFLET_CSS, LEAFLET_JS } from './leafletBundle';
import { t } from '../../i18n';

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
  /** Where the map opens while there is nothing to fit (see `fitToMarkers`). */
  initialCenter?: { latitude: number; longitude: number; zoom?: number } | null;
  userLocation?: { latitude: number; longitude: number } | null;
  selectedMarkerId?: string | null;
  /**
   * Open on the markers: the view is fitted to them once, as soon as there are
   * any, unless the user has moved the map before that.
   */
  fitToMarkers?: boolean;
  basemap?: OpenStreetMapBasemap;
  onMarkerPress?: (id: string) => void;
  onBoundsChange?: (bounds: OpenStreetMapBounds) => void;
  style?: StyleProp<ViewStyle>;
  /** Height of the floating tab bar over the bottom of the map; the buttons sit above it. */
  bottomInset?: number;
  /**
   * Height of what else is drawn over the map: at its top edge (a header card)
   * and directly above `bottomInset` (a legend). Fitting keeps the markers out of it.
   */
  fitInsets?: { top?: number; bottom?: number };
}

// Room kept around the outermost markers when the view is fitted to them. On
// the right the markers also have to stay clear of the control buttons.
const FIT_PADDING = 40;
const FIT_PADDING_RIGHT = 80;

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
  fitInsets,
}: Props) {
  const WebViewComponent = WebView as unknown as React.ComponentType<any>;
  const webViewRef = useRef<any>(null);
  // Number of "ready" messages: the page sends one each time it has (re)loaded.
  const [readyCount, setReadyCount] = useState(0);
  const isMapReady = readyCount > 0;
  const hasLocatedMarkers = markers.some(
    (marker) => Number.isFinite(marker.latitude) && Number.isFinite(marker.longitude)
  );
  const fitInsetTop = fitInsets?.top ?? 0;
  const fitInsetBottom = bottomInset + (fitInsets?.bottom ?? 0);
  const payload = useMemo(
    () =>
      // ASCII only and without "<": safe inside the page's <script> as well as in an
      // injected one (no early </script>, no line separator, no encoding to get wrong).
      JSON.stringify({
        markers,
        initialCenter,
        userLocation,
        selectedMarkerId,
        fitToMarkers,
        fitPadding: {
          top: FIT_PADDING + fitInsetTop,
          right: FIT_PADDING_RIGHT,
          bottom: FIT_PADDING + fitInsetBottom,
          left: FIT_PADDING,
        },
        basemap,
      }).replace(
        /[<\u007f-\uffff]/g,
        (character) => '\\u' + character.charCodeAt(0).toString(16).padStart(4, '0')
      ),
    [basemap, fitInsetBottom, fitInsetTop, fitToMarkers, initialCenter, markers, selectedMarkerId, userLocation]
  );
  // The page starts from what is known at mount, so its first view is already the right one.
  const [initialPayload] = useState(payload);
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
      const initialConfig = ${initialPayload};

      // Not named "postMessage": a global function of that name replaces
      // window.postMessage, and in the browser that is the channel the app
      // uses to send commands into this page.
      function sendToApp(payload) {
        if (window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage(JSON.stringify(payload));
        }
      }

      function buildMap() {
        const HTML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

        // Marker texts come from recordings, on the community map from other people's.
        function escapeHtml(value) {
          return String(value).replace(/[&<>"']/g, (character) => HTML_ESCAPES[character]);
        }

        function hasCoordinates(point) {
          return typeof point.latitude === 'number' && isFinite(point.latitude)
            && typeof point.longitude === 'number' && isFinite(point.longitude);
        }

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
          const color = escapeHtml(marker.color || '#171717');
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
        // The whole world, until applyAutoView() below knows where to look.
        map.setView([20, 0], 2);
        window.__soundscapeMap = map;
        window.__soundscapeMarkerLayer = [];
        window.__soundscapeUserLayers = [];
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

          config.markers.forEach((marker) => {
          if (!hasCoordinates(marker)) {
            return;
          }

          const isSelected = marker.id === config.selectedMarkerId;
          const circle = L.marker([marker.latitude, marker.longitude], {
            icon: buildMarkerIcon(marker, isSelected, currentZoom),
          }).addTo(map);

          circle.on('click', () => {
            sendToApp({ type: 'markerPress', id: marker.id });
          });

          if (marker.title || marker.subtitle) {
            const title = marker.title ? '<strong>' + escapeHtml(marker.title) + '</strong>' : '';
            const subtitle = marker.subtitle ? '<div style="margin-top:4px;color:${Colors.textMuted};font-size:12px;">' + escapeHtml(marker.subtitle) + '</div>' : '';
            circle.bindPopup(
              '<div style="min-width:140px;color:${Colors.text};font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;">' + title + subtitle + '</div>',
              { autoPan: false }
            );
            if (isSelected) {
              circle.openPopup();
            }
          }

          markerLayer.push(circle);
          });
        }

        function renderConfig(config) {
          renderBasemap(config);
          renderUserLocation(config);
          renderMarkers(config);
        }

        // Automatic view: fitted to the markers or centred on the given position, each at
        // most once, and never after the user has moved the map.
        const autoView = { fitted: false, centered: false, userMoved: false };
        let automaticMoves = 0;

        function moveAutomatically(move) {
          automaticMoves += 1;
          try {
            move();
          } finally {
            automaticMoves -= 1;
          }
        }

        // Shows all markers, zoomed in to street level (16) at most, which is also what a
        // single place gets. Returns false when there is nothing to fit or the map has no
        // usable size yet.
        function fitToMarkers(config, animate) {
          const positions = config.markers
            .filter(hasCoordinates)
            .map((marker) => [marker.latitude, marker.longitude]);
          const size = map.getSize();
          if (positions.length === 0 || size.x < 64 || size.y < 64) {
            return false;
          }

          // The markers stay clear of what covers the map, unless that leaves too little room.
          let padding = config.fitPadding;
          if (!padding || size.x - padding.left - padding.right < 120 || size.y - padding.top - padding.bottom < 120) {
            padding = { top: 16, right: 16, bottom: 16, left: 16 };
          }

          const options = {
            paddingTopLeft: [padding.left, padding.top],
            paddingBottomRight: [padding.right, padding.bottom],
            maxZoom: 16,
          };
          if (animate === false) {
            options.animate = false;
          }
          map.fitBounds(L.latLngBounds(positions), options);
          return true;
        }

        function applyAutoView(config) {
          if (autoView.userMoved || autoView.fitted) {
            return;
          }

          if (config.fitToMarkers) {
            moveAutomatically(() => {
              autoView.fitted = fitToMarkers(config, false);
            });
            if (autoView.fitted) {
              return;
            }
          }

          const center = config.initialCenter || config.userLocation;
          if (center && hasCoordinates(center) && !autoView.centered) {
            moveAutomatically(() => {
              map.setView([center.latitude, center.longitude], center.zoom || 13, { animate: false });
            });
            autoView.centered = true;
          }
        }

        // The "zoom to recordings" button.
        window.__soundscapeFitToMarkers = function() {
          fitToMarkers(window.__lastConfig);
        };

        window.__updateMapConfig = function(nextConfig) {
          window.__lastConfig = nextConfig;
          renderConfig(nextConfig);
          applyAutoView(nextConfig);
        };

        // Any move that is not an automatic one is the user's: gestures as well as the
        // zoom, location and fit buttons.
        map.on('movestart zoomstart', () => {
          if (automaticMoves === 0) {
            autoView.userMoved = true;
          }
        });

        // Marker sizes depend on the zoom level.
        map.on('zoomend', () => {
          renderConfig(window.__lastConfig);
        });

        // A map that had no size yet, such as one in a hidden tab, gets its automatic view
        // as soon as it has one.
        map.on('resize', () => {
          applyAutoView(window.__lastConfig);
        });

        window.__updateMapConfig(initialConfig);

        // Registered after the first view is set: only later moves are reported.
        map.on('moveend', () => {
          const currentBounds = map.getBounds();
          const centerPoint = map.getCenter();

          sendToApp({
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

        setTimeout(() => {
          map.invalidateSize();
        }, 0);

        sendToApp({ type: 'ready' });
      }

      document.addEventListener('DOMContentLoaded', buildMap);
    </script>
  </body>
</html>
`;
  }, [bottomInset, initialPayload]);
  const htmlSource = useMemo(() => ({ html }), [html]);

  const handleMessage = useCallback((event: WebViewMessageEvent) => {
    try {
      const payload = JSON.parse(event.nativeEvent.data) as
        | ({ type: 'markerPress'; id: string })
        | ({ type: 'ready' })
        | ({ type: 'boundsChange' } & OpenStreetMapBounds);

      if (payload.type === 'ready') {
        setReadyCount((count) => count + 1);
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

  // Sends the current configuration whenever it changes, and again to a reloaded page.
  useEffect(() => {
    if (readyCount === 0 || !webViewRef.current) {
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
  }, [readyCount, payload]);

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

  const handleFitToMarkers = useCallback(() => {
    if (!isMapReady || !webViewRef.current) {
      return;
    }

    void Haptics.selectionAsync();
    webViewRef.current.injectJavaScript(`
      if (window.__soundscapeFitToMarkers) {
        window.__soundscapeFitToMarkers();
      }
      true;
    `);
  }, [isMapReady]);

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
            accessibilityLabel={t('Zoom in')}
          >
            <MaterialIcons name="add" size={24} color={Colors.text} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.controlButton, styles.zoomButton, styles.zoomButtonLast]}
            onPress={handleZoomOut}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={t('Zoom out')}
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
            accessibilityLabel={t('Center map on my location')}
            accessibilityHint={t('Move the map back to your current location')}
          >
            <MaterialIcons name="my-location" size={18} color={Colors.text} />
          </TouchableOpacity>
        ) : null}
        {/* Last, so that it keeps its place when the location button appears. */}
        <TouchableOpacity
          style={[styles.controlButton, !hasLocatedMarkers && styles.controlButtonDisabled]}
          onPress={handleFitToMarkers}
          disabled={!hasLocatedMarkers}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel={t('Zoom to recordings')}
        >
          <MaterialCommunityIcons
            name="fit-to-screen-outline"
            size={20}
            color={hasLocatedMarkers ? Colors.text : Colors.textDisabled}
          />
        </TouchableOpacity>
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
  controlButtonDisabled: {
    opacity: 0.7,
    shadowOpacity: 0,
    elevation: 0,
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
