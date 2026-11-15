import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { StyleSheet, View, Text, ActivityIndicator, TouchableOpacity } from 'react-native';
import * as Location from 'expo-location';
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { Colors, Spacing, Radius } from '../../src/theme/colors';
import { useExploreStore } from '../../src/stores/useExploreStore';
import { isSupabaseConfigured } from '../../src/utils/supabase';
import { formatDuration } from '../../src/constants/protocols';
import OpenStreetMapView, { OpenStreetMapBounds } from '../../src/components/map/OpenStreetMapView';
import { CommunityRecordingModal } from '../../src/components/explore/CommunityRecordingModal';
type Basemap = 'light' | 'satellite';

const BASEMAP_SEQUENCE: Basemap[] = ['light', 'satellite'];
const BASEMAP_META: Record<
  Basemap,
  { label: string; icon: React.ComponentProps<typeof MaterialIcons>['name'] }
> = {
  light: { label: 'Grey', icon: 'layers' },
  satellite: { label: 'Image', icon: 'satellite-alt' },
};

export default function ExploreScreen() {
  const tabBarHeight = useBottomTabBarHeight();
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [isLoadingLocation, setIsLoadingLocation] = useState(true);
  const [basemap, setBasemap] = useState<Basemap>('light');
  const [expandedGroupKey, setExpandedGroupKey] = useState<string | null>(null);
  const lastBoundsRef = useRef<OpenStreetMapBounds | null>(null);
  const currentBasemapMeta = BASEMAP_META[basemap];

  const {
    recordings,
    isLoading,
    error,
    fetchRecordingsInBounds,
    selectedRecording,
    selectRecording,
  } = useExploreStore();

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setIsLoadingLocation(false);
        return;
      }

      const loc = await Location.getCurrentPositionAsync({});
      setLocation(loc);
      setIsLoadingLocation(false);

      // Fetch recordings for initial region
      if (isSupabaseConfigured) {
        fetchRecordingsInBounds({
          northeast: {
            latitude: loc.coords.latitude + 0.05,
            longitude: loc.coords.longitude + 0.05,
          },
          southwest: {
            latitude: loc.coords.latitude - 0.05,
            longitude: loc.coords.longitude - 0.05,
          },
        });
      }
    })();
  }, []);

  const handleBoundsChange = useCallback((bounds: OpenStreetMapBounds) => {
    lastBoundsRef.current = bounds;
    if (isSupabaseConfigured) {
      fetchRecordingsInBounds({
        northeast: bounds.northeast,
        southwest: bounds.southwest,
      });
    }
  }, [fetchRecordingsInBounds]);

  const handleMarkerPress = useCallback((recording: typeof recordings[0]) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    selectRecording(recording);
  }, [selectRecording]);

  const handleRefresh = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (lastBoundsRef.current && isSupabaseConfigured) {
      fetchRecordingsInBounds({
        northeast: lastBoundsRef.current.northeast,
        southwest: lastBoundsRef.current.southwest,
      });
    }
  }, [fetchRecordingsInBounds]);

  const cycleBasemap = useCallback(() => {
    Haptics.selectionAsync();
    setBasemap((current) => {
      const currentIndex = BASEMAP_SEQUENCE.indexOf(current);
      return BASEMAP_SEQUENCE[(currentIndex + 1) % BASEMAP_SEQUENCE.length];
    });
  }, []);

  const getMarkerColor = (isoPleasant: number | null) => {
    if (isoPleasant === null) return Colors.textMuted;
    if (isoPleasant > 0.3) return Colors.success;
    if (isoPleasant < -0.3) return Colors.error;
    return Colors.warning;
  };

  const mappableRecordings = recordings.filter(
    (recording) =>
      Number.isFinite(recording.latitude) &&
      Number.isFinite(recording.longitude) &&
      !(recording.latitude === 0 && recording.longitude === 0)
  );

  const groupedRecordings = useMemo(() => {
    const groups = new Map<string, typeof mappableRecordings>();

    mappableRecordings.forEach((recording) => {
      const key = `${recording.latitude.toFixed(5)}:${recording.longitude.toFixed(5)}`;
      const existing = groups.get(key);
      if (existing) {
        existing.push(recording);
      } else {
        groups.set(key, [recording]);
      }
    });

    return Array.from(groups.entries()).map(([key, group]) => ({ key, group }));
  }, [mappableRecordings]);

  const positionedMarkers = useMemo(() => {
    return groupedRecordings.flatMap(({ key, group }) => {
      const only = group[0];
      if (group.length === 1 || expandedGroupKey === key) {
        if (group.length === 1) {
          return [{
            id: only.id,
            latitude: only.latitude,
            longitude: only.longitude,
            color: getMarkerColor(only.perception?.isoPleasant ?? null),
            title: only.visualContext?.dominantContext || only.habitatType?.replace('_', ' ') || 'Soundscape',
            subtitle: `${formatDuration(only.durationMs)}${only.perception?.isoPleasant != null ? ` · ${only.perception.isoPleasant > 0 ? 'pleasant' : only.perception.isoPleasant < 0 ? 'unpleasant' : 'neutral'}` : ''}`,
          }];
        }

        return group.map((recording, index) => {
          const angle = (Math.PI * 2 * index) / group.length;
          const radius = group.length <= 3 ? 0.00012 : 0.00018;
          const latitudeOffset = Math.sin(angle) * radius;
          const longitudeOffset =
            Math.cos(angle) * radius / Math.max(Math.cos((recording.latitude * Math.PI) / 180), 0.35);

          return {
            id: recording.id,
            latitude: recording.latitude + latitudeOffset,
            longitude: recording.longitude + longitudeOffset,
            color: getMarkerColor(recording.perception?.isoPleasant ?? null),
            title: recording.visualContext?.dominantContext || recording.habitatType?.replace('_', ' ') || 'Soundscape',
            subtitle: `${formatDuration(recording.durationMs)}${recording.perception?.isoPleasant != null ? ` · ${recording.perception.isoPleasant > 0 ? 'pleasant' : recording.perception.isoPleasant < 0 ? 'unpleasant' : 'neutral'}` : ''}`,
          };
        });
      }

      return [{
        id: `group:${key}`,
        latitude: only.latitude,
        longitude: only.longitude,
        color: getMarkerColor(only.perception?.isoPleasant ?? null),
        title: `${group.length} recordings here`,
        subtitle: 'Tap to expand',
        count: group.length,
        isCluster: true,
      }];
    });
  }, [expandedGroupKey, getMarkerColor, groupedRecordings]);

  const uniqueLocationCount = useMemo(() => {
    const locations = new Set(
      mappableRecordings.map(
        (recording) => `${recording.latitude.toFixed(5)}:${recording.longitude.toFixed(5)}`
      )
    );
    return locations.size;
  }, [mappableRecordings]);

  if (isLoadingLocation) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Loading map...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <OpenStreetMapView
          style={styles.map}
          bottomInset={tabBarHeight}
          basemap={basemap}
          initialCenter={
            location
              ? {
                  latitude: location.coords.latitude,
                  longitude: location.coords.longitude,
                  zoom: 13,
                }
              : null
          }
          userLocation={
            location
              ? {
                  latitude: location.coords.latitude,
                  longitude: location.coords.longitude,
                }
              : null
          }
          markers={positionedMarkers}
          selectedMarkerId={selectedRecording?.id ?? null}
          onMarkerPress={(id) => {
            if (id.startsWith('group:')) {
              const groupKey = id.slice('group:'.length);
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setExpandedGroupKey((current) => (current === groupKey ? null : groupKey));
              selectRecording(null);
              return;
            }
            const recording = mappableRecordings.find((item) => item.id === id);
            if (recording) {
              handleMarkerPress(recording);
            }
          }}
          onBoundsChange={handleBoundsChange}
        />

      {/* Header overlay */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Explore Soundscapes</Text>
          <Text style={styles.headerSubtitle}>
            {isSupabaseConfigured
              ? uniqueLocationCount < mappableRecordings.length
                ? `${mappableRecordings.length} recordings across ${uniqueLocationCount} locations`
                : `${mappableRecordings.length} recordings in this area`
              : 'Configure cloud to see community recordings'}
          </Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.basemapButton}
            onPress={cycleBasemap}
            accessibilityRole="button"
            accessibilityLabel={`Current basemap ${currentBasemapMeta.label}. Tap to switch basemap`}
          >
            <MaterialIcons
              name={currentBasemapMeta.icon}
              size={18}
              color={Colors.text}
            />
            <Text style={styles.basemapButtonText}>{currentBasemapMeta.label}</Text>
          </TouchableOpacity>
          {isSupabaseConfigured && (
            <TouchableOpacity
              style={styles.refreshButton}
              onPress={handleRefresh}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color={Colors.primary} />
              ) : (
                <MaterialIcons name="refresh" size={24} color={Colors.primary} />
              )}
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Error overlay */}
      {error && (
        <View style={styles.errorOverlay}>
          <MaterialIcons name="error-outline" size={24} color={Colors.error} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {/* Empty state overlay */}
      {!isLoading && mappableRecordings.length === 0 && isSupabaseConfigured && (
        <View style={styles.emptyOverlay}>
          <MaterialIcons name="explore" size={48} color={Colors.textMuted} />
          <Text style={styles.emptyTitle}>No recordings here yet</Text>
          <Text style={styles.emptyText}>
            Only recordings published to the community with location enabled appear here. Be the first to share one in this area.
          </Text>
        </View>
      )}

      {/* Not configured overlay */}
      {!isSupabaseConfigured && (
        <View style={styles.emptyOverlay}>
          <MaterialIcons name="cloud-off" size={48} color={Colors.textMuted} />
          <Text style={styles.emptyTitle}>Cloud Not Configured</Text>
          <Text style={styles.emptyText}>
            Set up Supabase to explore community recordings from around the world
          </Text>
        </View>
      )}

      {/* Legend */}
      <View style={[styles.legend, { bottom: tabBarHeight + 12 }]}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: Colors.success }]} />
          <Text style={styles.legendText}>Pleasant</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: Colors.warning }]} />
          <Text style={styles.legendText}>Neutral</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: Colors.error }]} />
          <Text style={styles.legendText}>Unpleasant</Text>
        </View>
      </View>

      <CommunityRecordingModal
        visible={!!selectedRecording}
        recording={selectedRecording}
        onClose={() => selectRecording(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background,
  },
  loadingText: {
    marginTop: 16,
    color: Colors.textMuted,
    fontSize: 16,
  },
  map: {
    flex: 1,
  },
  header: {
    position: 'absolute',
    top: 60,
    left: 16,
    right: 16,
    backgroundColor: '#FBF8F1F2',
    padding: Spacing.md,
    borderRadius: Radius.lg,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.surfaceHighlight,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    color: Colors.text,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 2,
  },
  headerSubtitle: {
    color: Colors.textMuted,
    fontSize: 13,
  },
  refreshButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  basemapButton: {
    height: 40,
    paddingHorizontal: Spacing.md,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  basemapButtonText: {
    color: Colors.text,
    fontSize: 13,
    fontWeight: '600',
  },
  errorOverlay: {
    position: 'absolute',
    top: 140,
    left: 16,
    right: 16,
    backgroundColor: Colors.errorMuted,
    padding: Spacing.md,
    borderRadius: Radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  errorText: {
    flex: 1,
    color: Colors.error,
    fontSize: 14,
  },
  emptyOverlay: {
    position: 'absolute',
    bottom: 120,
    left: 16,
    right: 16,
    backgroundColor: '#FBF8F1F2',
    padding: Spacing.xl,
    borderRadius: Radius.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.surfaceHighlight,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  emptyTitle: {
    marginTop: Spacing.md,
    color: Colors.text,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: Spacing.xs,
  },
  emptyText: {
    color: Colors.textMuted,
    fontSize: 14,
    textAlign: 'center',
  },
  legend: {
    position: 'absolute',
    bottom: 0,
    left: 16,
    backgroundColor: '#FBF8F1F2',
    padding: Spacing.sm,
    borderRadius: Radius.md,
    flexDirection: 'row',
    gap: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.surfaceHighlight,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendText: {
    fontSize: 11,
    color: Colors.textMuted,
  },
});
