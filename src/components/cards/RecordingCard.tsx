import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { formatDate } from '../../i18n/dates';
import { Colors } from '../../theme/colors';
import { RecordingWithPerception, SyncStatus } from '../../types/recording';
import { getProtocolLabel, formatDuration } from '../../constants/protocols';
import { getHabitatIcon, getHabitatLabel } from '../../constants/habitats';
import { useAudioPlayer } from '../../hooks/useAudioPlayer';
import PlaybackControls from '../review/PlaybackControls';
import WaveformViewer from '../review/WaveformViewer';
import { t } from '../../i18n';

interface Props {
  recording: RecordingWithPerception;
  onClose: () => void;
  onDelete?: () => void;
  onRetryUpload?: () => void;
}

const STATUS_CONFIG: Record<SyncStatus, { color: string; icon: string; label: string }> = {
  local: { color: '#7A756C', icon: 'save', label: 'Saved Locally' },
  queued: { color: '#B0956A', icon: 'schedule', label: 'Queued for Upload' },
  uploading: { color: '#4F6F86', icon: 'cloud-upload', label: 'Uploading...' },
  uploaded: { color: '#5E8068', icon: 'cloud-done', label: 'Uploaded' },
  failed: { color: '#B0463A', icon: 'error', label: 'Upload Failed' },
};

export default function RecordingCard({
  recording,
  onClose,
  onDelete,
  onRetryUpload,
}: Props) {
  const {
    isPlaying,
    isLoaded,
    duration,
    position,
    play,
    pause,
    seekTo,
  } = useAudioPlayer(recording.audioUri);

  const statusConfig = STATUS_CONFIG[recording.syncStatus];
  const recordedDate = new Date(recording.recordedAt);

  // Parse source dominance if available
  let sourceDominance = null;
  if (recording.sourceDominance) {
    try {
      sourceDominance = JSON.parse(recording.sourceDominance);
    } catch {}
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <MaterialIcons name="close" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>{t('Recording Details')}</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        {/* Waveform & playback */}
        <View style={styles.section}>
          <WaveformViewer
            duration={duration || recording.durationMs}
            position={position}
            isPlaying={isPlaying}
          />
          <View style={styles.playbackContainer}>
            <PlaybackControls
              isPlaying={isPlaying}
              isLoaded={isLoaded}
              duration={duration || recording.durationMs}
              position={position}
              onPlay={play}
              onPause={pause}
              onSeek={seekTo}
            />
          </View>
        </View>

        {/* Status badge */}
        <View style={styles.section}>
          <View style={[styles.statusBadge, { backgroundColor: `${statusConfig.color}20` }]}>
            <MaterialIcons
              name={statusConfig.icon as any}
              size={20}
              color={statusConfig.color}
            />
            <Text style={[styles.statusText, { color: statusConfig.color }]}>
              {t(statusConfig.label)}
            </Text>
          </View>

          {recording.syncStatus === 'failed' && onRetryUpload && (
            <TouchableOpacity style={styles.retryButton} onPress={onRetryUpload}>
              <MaterialIcons name="refresh" size={18} color={Colors.primary} />
              <Text style={styles.retryButtonText}>{t('Retry Upload')}</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Date & time */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('Recorded')}</Text>
          <Text style={styles.dateText}>
            {formatDate(recordedDate, 'long')}
          </Text>
          <Text style={styles.timeText}>{formatDate(recordedDate, 'time')}</Text>
        </View>

        {/* Recording info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('Recording Info')}</Text>
          <View style={styles.infoGrid}>
            <View style={styles.infoItem}>
              <MaterialIcons name="timer" size={18} color={Colors.textMuted} />
              <Text style={styles.infoLabel}>{t('Duration')}</Text>
              <Text style={styles.infoValue}>{formatDuration(recording.durationMs)}</Text>
            </View>
            <View style={styles.infoItem}>
              <MaterialIcons name="mic" size={18} color={Colors.textMuted} />
              <Text style={styles.infoLabel}>{t('Protocol')}</Text>
              <Text style={styles.infoValue}>{getProtocolLabel(recording.protocolType)}</Text>
            </View>
            {recording.habitatType && (
              <View style={styles.infoItem}>
                <MaterialIcons
                  name={getHabitatIcon(recording.habitatType)}
                  size={18}
                  color={Colors.textMuted}
                />
                <Text style={styles.infoLabel}>{t('Location')}</Text>
                <Text style={styles.infoValue}>{getHabitatLabel(recording.habitatType)}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Perception */}
        {recording.perception && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('Perception')}</Text>
            <View style={styles.perceptionGrid}>
              <View style={styles.perceptionItem}>
                <Text style={styles.perceptionLabel}>{t('Pleasant')}</Text>
                <View style={styles.perceptionBarContainer}>
                  <View style={styles.perceptionBar}>
                    <View
                      style={[
                        styles.perceptionFill,
                        {
                          width: `${((recording.perception.isoPleasant + 1) / 2) * 100}%`,
                          backgroundColor:
                            recording.perception.isoPleasant > 0
                              ? Colors.success
                              : Colors.error,
                        },
                      ]}
                    />
                  </View>
                  <Text style={styles.perceptionValue}>
                    {(recording.perception.isoPleasant * 100).toFixed(0)}%
                  </Text>
                </View>
              </View>
              <View style={styles.perceptionItem}>
                <Text style={styles.perceptionLabel}>{t('Eventful')}</Text>
                <View style={styles.perceptionBarContainer}>
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
                  <Text style={styles.perceptionValue}>
                    {(recording.perception.isoEventful * 100).toFixed(0)}%
                  </Text>
                </View>
              </View>
            </View>
          </View>
        )}

        {/* Source dominance */}
        {sourceDominance && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('Sound Sources')}</Text>
            <View style={styles.sourceGrid}>
              <View style={styles.sourceItem}>
                <MaterialIcons name="eco" size={20} color="#5E8068" />
                <Text style={styles.sourceLabel}>{t('Biophony')}</Text>
                <Text style={styles.sourceValue}>{sourceDominance.biophony}%</Text>
              </View>
              <View style={styles.sourceItem}>
                <MaterialIcons name="air" size={20} color="#4F6F86" />
                <Text style={styles.sourceLabel}>{t('Geophony')}</Text>
                <Text style={styles.sourceValue}>{sourceDominance.geophony}%</Text>
              </View>
              <View style={styles.sourceItem}>
                <MaterialIcons name="directions-car" size={20} color="#B0956A" />
                <Text style={styles.sourceLabel}>{t('Anthrophony')}</Text>
                <Text style={styles.sourceValue}>{sourceDominance.anthrophony}%</Text>
              </View>
            </View>
          </View>
        )}

        {/* Quality flags */}
        {(recording.hasClipping || recording.hasWindHandling || recording.hasLowSNR) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('Quality Notes')}</Text>
            <View style={styles.warningsContainer}>
              {recording.hasClipping && (
                <View style={styles.warningBadge}>
                  <Text style={styles.warningText}>{t('Audio clipping detected')}</Text>
                </View>
              )}
              {recording.hasWindHandling && (
                <View style={styles.warningBadge}>
                  <Text style={styles.warningText}>{t('Wind/handling noise')}</Text>
                </View>
              )}
              {recording.hasLowSNR && (
                <View style={styles.warningBadge}>
                  <Text style={styles.warningText}>{t('Low signal-to-noise ratio')}</Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Delete button */}
        {onDelete && (
          <TouchableOpacity style={styles.deleteButton} onPress={onDelete}>
            <MaterialIcons name="delete" size={20} color={Colors.error} />
            <Text style={styles.deleteButtonText}>{t('Delete Recording')}</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
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
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    paddingTop: 60,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.surfaceHighlight,
  },
  closeButton: {
    padding: 4,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
  },
  placeholder: {
    width: 32,
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 48,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textMuted,
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  playbackContainer: {
    marginTop: 16,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 100,
    gap: 8,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    gap: 6,
  },
  retryButtonText: {
    color: Colors.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  dateText: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 4,
  },
  timeText: {
    fontSize: 15,
    color: Colors.textMuted,
  },
  infoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  infoItem: {
    backgroundColor: Colors.surface,
    padding: 14,
    borderRadius: 12,
    minWidth: 100,
    alignItems: 'center',
    gap: 6,
  },
  infoLabel: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
  },
  perceptionGrid: {
    gap: 16,
  },
  perceptionItem: {
    backgroundColor: Colors.surface,
    padding: 14,
    borderRadius: 12,
  },
  perceptionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 10,
  },
  perceptionBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  perceptionBar: {
    flex: 1,
    height: 8,
    backgroundColor: Colors.surfaceHighlight,
    borderRadius: 4,
    overflow: 'hidden',
  },
  perceptionFill: {
    height: '100%',
    borderRadius: 4,
  },
  perceptionValue: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
    minWidth: 50,
    textAlign: 'right',
  },
  sourceGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  sourceItem: {
    flex: 1,
    backgroundColor: Colors.surface,
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
    gap: 6,
  },
  sourceLabel: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  sourceValue: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
  },
  warningsContainer: {
    gap: 8,
  },
  warningBadge: {
    backgroundColor: `${Colors.error}15`,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: Colors.error,
  },
  warningText: {
    fontSize: 14,
    color: Colors.error,
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    marginTop: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.surfaceHighlight,
  },
  deleteButtonText: {
    color: Colors.error,
    fontSize: 16,
    fontWeight: '600',
  },
});
