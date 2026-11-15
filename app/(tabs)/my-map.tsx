import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Alert,
  ListRenderItemInfo,
  useWindowDimensions,
} from 'react-native';
import * as Location from 'expo-location';
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { Colors, Spacing, Radius } from '../../src/theme/colors';
import { useLibraryStore } from '../../src/stores/useLibraryStore';
import { CommunityVisibility, RecordingWithPerception, SyncStatus } from '../../src/types/recording';
import RecordingListItem from '../../src/components/cards/RecordingListItem';
import FilterPanel from '../../src/components/map/FilterPanel';
import { RecordingDetailModal } from '../../src/components/library/RecordingDetailModal';
import OpenStreetMapView from '../../src/components/map/OpenStreetMapView';
import {
  deleteRemoteRecording,
  resyncRemoteRecordingMedia,
  updateRemoteRecordingVisibility,
} from '../../src/services/sync/uploader';
import { queueForUpload } from '../../src/services/sync';
import { isSupabaseConfigured } from '../../src/utils/supabase';
import { getRecording, updateRecording } from '../../src/services/database/recordings';
import { t, tPlural } from '../../src/i18n';

type ViewMode = 'map' | 'list';
type Basemap = 'light' | 'satellite';
type MappableRecording = RecordingWithPerception & { latitude: number; longitude: number };

const BASEMAP_SEQUENCE: Basemap[] = ['light', 'satellite'];
const BASEMAP_META: Record<
  Basemap,
  { label: string; icon: React.ComponentProps<typeof MaterialIcons>['name'] }
> = {
  light: { label: 'Grey', icon: 'layers' },
  satellite: { label: 'Image', icon: 'satellite-alt' },
};

// Use centralized status colors from theme
const STATUS_COLORS: Record<SyncStatus, string> = {
  local: Colors.statusLocal,
  queued: Colors.statusQueued,
  uploading: Colors.statusUploading,
  uploaded: Colors.statusUploaded,
  failed: Colors.statusFailed,
};

export default function MyMapScreen() {
  const tabBarHeight = useBottomTabBarHeight();
  // Phone-width screens cannot fit the title next to all header controls.
  const isCompactHeader = useWindowDimensions().width < 420;
  const [viewMode, setViewMode] = useState<ViewMode>('map');
  const [basemap, setBasemap] = useState<Basemap>('light');
  const [showFilters, setShowFilters] = useState(false);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [selectedRecording, setSelectedRecording] = useState<RecordingWithPerception | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [isDeletingRecording, setIsDeletingRecording] = useState(false);
  const [isResyncingMedia, setIsResyncingMedia] = useState(false);
  const [isUpdatingVisibility, setIsUpdatingVisibility] = useState(false);
  const currentBasemapMeta = BASEMAP_META[basemap];

  const {
    recordings,
    isLoading,
    isLoadingMore,
    hasMore,
    totalCount,
    uploadedCount,
    pendingCount,
    failedCount,
    loadRecordings,
    loadMoreRecordings,
    filters,
    setFilters,
    clearFilters,
    deleteRecording: removeRecording,
    updateRecordingLocally,
  } = useLibraryStore();
  const mappableRecordings: MappableRecording[] = recordings.filter(
    (recording): recording is MappableRecording =>
      typeof recording.latitude === 'number' &&
      typeof recording.longitude === 'number'
  );

  useEffect(() => {
    loadRecordings(viewMode === 'map' ? 'all' : 'page');
  }, [loadRecordings, viewMode]);

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;

      const loc = await Location.getCurrentPositionAsync({});
      setUserLocation({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
      });
    })();
  }, []);

  const getMarkerColor = (status: SyncStatus) => STATUS_COLORS[status];

  const handleRecordingPress = useCallback((recording: RecordingWithPerception) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedRecording(recording);
    setShowDetailModal(true);
  }, []);

  const cycleBasemap = useCallback(() => {
    Haptics.selectionAsync();
    setBasemap((current) => {
      const currentIndex = BASEMAP_SEQUENCE.indexOf(current);
      return BASEMAP_SEQUENCE[(currentIndex + 1) % BASEMAP_SEQUENCE.length];
    });
  }, []);

  const handleDeleteRecording = useCallback(async (recording: RecordingWithPerception) => {
    if (isDeletingRecording) return;

    setIsDeletingRecording(true);

    try {
      let remoteWarning: string | null = null;

      if (recording.remoteId) {
        const remoteResult = await deleteRemoteRecording(recording);
        if (!remoteResult.success) {
          remoteWarning = remoteResult.error ?? t('The uploaded copy could not be deleted.');
        }
      }

      await removeRecording(recording.id);
      setShowDetailModal(false);
      setSelectedRecording(null);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      if (remoteWarning) {
        Alert.alert(
          t('Deleted locally'),
          `${t('The recording was removed from this device, but the uploaded copy may still exist.')}\n\n${remoteWarning}`
        );
      }
    } catch (error) {
      Alert.alert(
        t('Delete failed'),
        error instanceof Error ? error.message : t('Failed to delete the recording.')
      );
    } finally {
      setIsDeletingRecording(false);
    }
  }, [isDeletingRecording, removeRecording]);

  const handleResyncMedia = useCallback(async (recording: RecordingWithPerception) => {
    if (isResyncingMedia) {
      return;
    }

    setIsResyncingMedia(true);

    try {
      const result = await resyncRemoteRecordingMedia(recording);
      if (!result.success) {
        throw new Error(result.error ?? t('Unable to resync media.'));
      }

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(
        t('Media synced'),
        result.updated.length > 0
          ? t('Uploaded to the cloud record: {items}.', { items: result.updated.map((item) => t(item)).join(', ') })
          : t('No media needed updating.')
      );
    } catch (error) {
      Alert.alert(
        t('Media resync failed'),
        error instanceof Error ? error.message : t('Unable to upload media assets right now.')
      );
    } finally {
      setIsResyncingMedia(false);
    }
  }, [isResyncingMedia]);

  const handleVisibilityChange = useCallback(async (
    recording: RecordingWithPerception,
    communityVisibility: CommunityVisibility
  ) => {
    if (isUpdatingVisibility || communityVisibility === recording.communityVisibility) {
      return;
    }

    setIsUpdatingVisibility(true);

    try {
      await updateRecording(recording.id, { communityVisibility });
      updateRecordingLocally(recording.id, { communityVisibility });
      setSelectedRecording((current) => (
        current && current.id === recording.id ? { ...current, communityVisibility } : current
      ));

      if (recording.remoteId) {
        const remoteResult = await updateRemoteRecordingVisibility(recording, communityVisibility);
        if (!remoteResult.success) {
          throw new Error(remoteResult.error ?? t('Failed to update community visibility remotely.'));
        }
      } else if (communityVisibility === 'community' && recording.syncStatus !== 'uploading') {
        await queueForUpload(recording.id);
      }

      Alert.alert(
        communityVisibility === 'community' ? t('Published to community') : t('Saved as private'),
        communityVisibility === 'community'
          ? (recording.remoteId
            ? t('This recording can now appear on the Explore map.')
            : t('This recording was marked for community sharing and queued for upload.'))
          : t('This recording will stay in your private archive.')
      );
    } catch (error) {
      Alert.alert(
        t('Sharing update failed'),
        error instanceof Error ? error.message : t('Unable to update community visibility.')
      );
    } finally {
      setIsUpdatingVisibility(false);
    }
  }, [isUpdatingVisibility, updateRecordingLocally]);

  
  const renderListItem = useCallback(
    ({ item }: ListRenderItemInfo<RecordingWithPerception>) => (
      <RecordingListItem recording={item} onPress={() => handleRecordingPress(item)} />
    ),
    [handleRecordingPress]
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTitleBlock}>
          <Text
            style={[styles.headerTitle, isCompactHeader && styles.headerTitleCompact]}
            numberOfLines={1}
          >
            {t('My Recordings')}
          </Text>
          <Text style={styles.headerStats}>
            {tPlural(totalCount, '{count} recording', '{count} recordings')}
          </Text>
        </View>

        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setShowFilters(!showFilters);
            }}
          >
            <MaterialIcons
              name="filter-list"
              size={24}
              color={Object.keys(filters).length > 0 ? Colors.primary : Colors.text}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.basemapButton}
            onPress={cycleBasemap}
            accessibilityRole="button"
            accessibilityLabel={t('Current basemap {name}. Tap to switch basemap', { name: t(currentBasemapMeta.label) })}
          >
            <MaterialIcons
              name={currentBasemapMeta.icon}
              size={20}
              color={Colors.text}
            />
            {!isCompactHeader && (
              <Text style={styles.basemapButtonText}>{t(currentBasemapMeta.label)}</Text>
            )}
          </TouchableOpacity>

          <View style={styles.viewToggle}>
            <TouchableOpacity
              style={[
                styles.toggleButton,
                viewMode === 'map' && styles.toggleButtonActive,
              ]}
              onPress={() => {
                Haptics.selectionAsync();
                setViewMode('map');
              }}
            >
              <MaterialIcons
                name="map"
                size={20}
                color={viewMode === 'map' ? Colors.primary : Colors.textMuted}
              />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.toggleButton, viewMode === 'list' && styles.toggleButtonActive]}
              onPress={() => {
                Haptics.selectionAsync();
                setViewMode('list');
              }}
            >
              <MaterialIcons
                name="list"
                size={20}
                color={viewMode === 'list' ? Colors.primary : Colors.textMuted}
              />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Filter panel */}
      {showFilters && (
        <FilterPanel
          filters={filters}
          onFiltersChange={setFilters}
          onClear={clearFilters}
          onClose={() => setShowFilters(false)}
        />
      )}

      {/* Loading state */}
      {isLoading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      )}

      {/* Map view */}
      {viewMode === 'map' && !isLoading && (
        <OpenStreetMapView
          style={styles.map}
          bottomInset={tabBarHeight}
          basemap={basemap}
          initialCenter={
            userLocation
              ? { latitude: userLocation.latitude, longitude: userLocation.longitude, zoom: 13 }
              : mappableRecordings[0]
                ? {
                    latitude: mappableRecordings[0].latitude,
                    longitude: mappableRecordings[0].longitude,
                    zoom: 13,
                  }
                : null
          }
          userLocation={userLocation}
          fitToMarkers={mappableRecordings.length > 0}
          selectedMarkerId={selectedRecording?.id ?? null}
          markers={mappableRecordings.map((recording) => ({
            id: recording.id,
            latitude: recording.latitude,
            longitude: recording.longitude,
            color: getMarkerColor(recording.syncStatus),
            title: recording.habitatType ? recording.habitatType.replace(/_/g, ' ') : t('Recording'),
            subtitle: `${Math.round(recording.durationMs / 1000)}s`,
          }))}
          onMarkerPress={(id) => {
            const recording = mappableRecordings.find((item) => item.id === id);
            if (recording) {
              handleRecordingPress(recording);
            }
          }}
        />
      )}

      {/* List view */}
      {viewMode === 'list' && !isLoading && (
        <FlatList
          data={recordings}
          keyExtractor={(item) => item.id}
          renderItem={renderListItem}
          contentContainerStyle={styles.listContent}
          onEndReachedThreshold={0.4}
          onEndReached={() => {
            void loadMoreRecordings();
          }}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListFooterComponent={
            isLoadingMore ? (
              <View style={styles.listFooter}>
                <ActivityIndicator size="small" color={Colors.primary} />
                <Text style={styles.listFooterText}>{t('Loading more recordings...')}</Text>
              </View>
            ) : hasMore ? (
              <View style={styles.listFooter}>
                <Text style={styles.listFooterText}>
                  {t('Showing {shown} of {total}', { shown: recordings.length, total: totalCount })}
                </Text>
              </View>
            ) : totalCount > 0 ? (
              <View style={styles.listFooter}>
                <Text style={styles.listFooterText}>{t('All recordings loaded')}</Text>
              </View>
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <MaterialIcons name="mic-none" size={48} color={Colors.textMuted} />
              <Text style={styles.emptyTitle}>{t('No recordings yet')}</Text>
              <Text style={styles.emptyText}>
                {t('Start recording soundscapes to see them here')}
              </Text>
            </View>
          }
        />
      )}

      {/* Empty map state */}
      {viewMode === 'map' && !isLoading && mappableRecordings.length === 0 && (
        <View style={styles.emptyOverlay}>
          <MaterialIcons name="mic-none" size={48} color={Colors.textMuted} />
          <Text style={styles.emptyTitle}>{t('No mapped recordings yet')}</Text>
          <Text style={styles.emptyText}>
            {t('Recordings with saved coordinates will appear here')}
          </Text>
        </View>
      )}

      {/* Legend */}
      {viewMode === 'map' && mappableRecordings.length > 0 && (
        <View style={[styles.legend, { bottom: tabBarHeight + 12 }]}>
          {Object.entries(STATUS_COLORS).map(([status, color]) => (
            <View key={status} style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: color }]} />
              <Text style={styles.legendText}>{status}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Recording detail modal */}
      <RecordingDetailModal
        recording={selectedRecording}
        visible={showDetailModal}
        isDeleting={isDeletingRecording}
        isResyncingMedia={isResyncingMedia}
        isUpdatingVisibility={isUpdatingVisibility}
        onClose={() => {
          setShowDetailModal(false);
          setSelectedRecording(null);
        }}
        onDelete={handleDeleteRecording}
        onResyncMedia={handleResyncMedia}
        onVisibilityChange={handleVisibilityChange}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    paddingTop: 60,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.surfaceHighlight,
  },
  headerTitleBlock: {
    flex: 1,
    minWidth: 0,
    marginRight: 8,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.text,
  },
  headerTitleCompact: {
    fontSize: 21,
  },
  headerStats: {
    fontSize: 13,
    color: Colors.textMuted,
    marginTop: 4,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0,
  },
  iconButton: {
    padding: 8,
  },
  basemapButton: {
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 4,
    paddingHorizontal: 10,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.surfaceHighlight,
  },
  basemapButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.text,
  },
  viewToggle: {
    flexDirection: 'row',
    backgroundColor: Colors.surfaceHighlight,
    borderRadius: 8,
    padding: 4,
  },
  toggleButton: {
    padding: 8,
    borderRadius: 6,
  },
  toggleButtonActive: {
    backgroundColor: Colors.surface,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  map: {
    flex: 1,
  },
  listContent: {
    padding: 16,
  },
  listFooter: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 18,
  },
  listFooterText: {
    fontSize: 13,
    color: Colors.textMuted,
  },
  separator: {
    height: 12,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
  },
  emptyOverlay: {
    position: 'absolute',
    bottom: 100,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(30, 41, 59, 0.95)',
    padding: 24,
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.surfaceHighlight,
  },
  emptyTitle: {
    marginTop: 12,
    color: Colors.text,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  emptyText: {
    color: Colors.textMuted,
    fontSize: 14,
    textAlign: 'center',
  },
  legend: {
    position: 'absolute',
    bottom: 0,
    left: 20,
    backgroundColor: 'rgba(30, 41, 59, 0.9)',
    padding: 12,
    borderRadius: 8,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendText: {
    fontSize: 11,
    color: Colors.textMuted,
    textTransform: 'capitalize',
  },
});
