import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { Colors } from '../../theme/colors';
import { CommunityVisibility, RecordingWithPerception, SyncStatus } from '../../types/recording';
import { getProtocolLabel, formatDuration } from '../../constants/protocols';
import { getHabitatIcon, getHabitatLabel } from '../../constants/habitats';

interface Props {
  recording: RecordingWithPerception;
  onPress: () => void;
}

const STATUS_CONFIG: Record<SyncStatus, { color: string; icon: string; label: string }> = {
  local: { color: '#6B7280', icon: 'save', label: 'Local' },
  queued: { color: '#F59E0B', icon: 'schedule', label: 'Queued' },
  uploading: { color: '#3B82F6', icon: 'cloud-upload', label: 'Uploading' },
  uploaded: { color: '#22C55E', icon: 'cloud-done', label: 'Uploaded' },
  failed: { color: '#EF4444', icon: 'error', label: 'Failed' },
};

const VISIBILITY_CONFIG: Record<CommunityVisibility, { color: string; icon: string; label: string }> = {
  private: { color: Colors.textMuted, icon: 'lock', label: 'Private' },
  community: { color: Colors.primary, icon: 'public', label: 'Community' },
};

export default function RecordingListItem({ recording, onPress }: Props) {
  const statusConfig = STATUS_CONFIG[recording.syncStatus];
  const visibilityConfig = VISIBILITY_CONFIG[recording.communityVisibility];
  const recordedDate = new Date(recording.recordedAt);

  return (
    <TouchableOpacity style={styles.container} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.header}>
        <View style={styles.dateContainer}>
          <Text style={styles.date}>{format(recordedDate, 'MMM d, yyyy')}</Text>
          <Text style={styles.time}>{format(recordedDate, 'h:mm a')}</Text>
        </View>

        <View style={styles.badgeRow}>
          <View style={[styles.statusBadge, { backgroundColor: `${statusConfig.color}20` }]}>
            <MaterialIcons
              name={statusConfig.icon as any}
              size={14}
              color={statusConfig.color}
            />
            <Text style={[styles.statusText, { color: statusConfig.color }]}>
              {statusConfig.label}
            </Text>
          </View>

          <View style={[styles.statusBadge, { backgroundColor: `${visibilityConfig.color}18` }]}>
            <MaterialIcons
              name={visibilityConfig.icon as any}
              size={14}
              color={visibilityConfig.color}
            />
            <Text style={[styles.statusText, { color: visibilityConfig.color }]}>
              {visibilityConfig.label}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.details}>
        <View style={styles.detailRow}>
          <View style={styles.detailItem}>
            <MaterialIcons name="timer" size={16} color={Colors.textMuted} />
            <Text style={styles.detailText}>{formatDuration(recording.durationMs)}</Text>
          </View>

          <View style={styles.detailItem}>
            <MaterialIcons name="mic" size={16} color={Colors.textMuted} />
            <Text style={styles.detailText}>
              {getProtocolLabel(recording.protocolType)}
            </Text>
          </View>

          {recording.habitatType && (
            <View style={styles.detailItem}>
              <Text style={styles.habitatIcon}>
                {getHabitatIcon(recording.habitatType)}
              </Text>
              <Text style={styles.detailText}>
                {getHabitatLabel(recording.habitatType)}
              </Text>
            </View>
          )}
        </View>

        {/* Perception indicators */}
        {recording.perception && (
          <View style={styles.perceptionRow}>
            <View style={styles.perceptionItem}>
              <Text style={styles.perceptionLabel}>Pleasant</Text>
              <View style={styles.perceptionBar}>
                <View
                  style={[
                    styles.perceptionFill,
                    {
                      width: `${((recording.perception.isoPleasant + 1) / 2) * 100}%`,
                      backgroundColor: recording.perception.isoPleasant > 0
                        ? Colors.success
                        : Colors.error,
                    },
                  ]}
                />
              </View>
            </View>

            <View style={styles.perceptionItem}>
              <Text style={styles.perceptionLabel}>Eventful</Text>
              <View style={styles.perceptionBar}>
                <View
                  style={[
                    styles.perceptionFill,
                    {
                      width: `${((recording.perception.isoEventful + 1) / 2) * 100}%`,
                      backgroundColor: Colors.secondary,
                    },
                  ]}
                />
              </View>
            </View>
          </View>
        )}

        {/* Quality warnings */}
        {(recording.hasClipping || recording.hasWindHandling || recording.hasLowSNR) && (
          <View style={styles.warningRow}>
            {recording.hasClipping && (
              <View style={styles.warningBadge}>
                <Text style={styles.warningText}>Clipping</Text>
              </View>
            )}
            {recording.hasWindHandling && (
              <View style={styles.warningBadge}>
                <Text style={styles.warningText}>Wind</Text>
              </View>
            )}
            {recording.hasLowSNR && (
              <View style={styles.warningBadge}>
                <Text style={styles.warningText}>Low Signal</Text>
              </View>
            )}
          </View>
        )}
      </View>

      <MaterialIcons name="chevron-right" size={24} color={Colors.textMuted} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.surfaceHighlight,
  },
  // Narrow column: keep the date on one line and let badges wrap beneath it.
  header: {
    width: 104,
    marginRight: 12,
  },
  dateContainer: {
    marginBottom: 8,
  },
  date: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
  },
  time: {
    fontSize: 13,
    color: Colors.textMuted,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 100,
    gap: 4,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  details: {
    flex: 1,
    minWidth: 0,
  },
  detailRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 8,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  detailText: {
    fontSize: 13,
    color: Colors.textMuted,
  },
  habitatIcon: {
    fontSize: 14,
  },
  perceptionRow: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 8,
  },
  perceptionItem: {
    flex: 1,
  },
  perceptionLabel: {
    fontSize: 11,
    color: Colors.textMuted,
    marginBottom: 4,
  },
  perceptionBar: {
    height: 4,
    backgroundColor: Colors.surfaceHighlight,
    borderRadius: 2,
    overflow: 'hidden',
  },
  perceptionFill: {
    height: '100%',
    borderRadius: 2,
  },
  warningRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 8,
  },
  warningBadge: {
    backgroundColor: `${Colors.error}20`,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  warningText: {
    fontSize: 10,
    color: Colors.error,
    fontWeight: '600',
  },
});
