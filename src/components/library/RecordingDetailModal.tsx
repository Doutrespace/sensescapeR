import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { formatDate } from '../../i18n/dates';
import * as Haptics from 'expo-haptics';
import { Colors, Spacing, Radius, Shadows } from '../../theme/colors';
import { CommunityVisibility, RecordingWithPerception, SyncStatus } from '../../types/recording';
import { getProtocolLabel, formatDuration } from '../../constants/protocols';
import { getHabitatLabel, getHabitatIcon } from '../../constants/habitats';
import { groupImageClassifications } from '../../utils/imageClassification';
import { getIncludedImageClassifications } from '../../utils/imageClassification';
import {
  getCircumplexQuadrantLabel,
  getIsoAxisLabel,
  getIsoAxisPercent,
} from '../../services/database/perceptions';
import { extractNoteThemes } from '../../utils/noteAnalysis';
import {
  assessVisualContext,
  formatVisualIndicatorSummary,
} from '../../utils/visualContext';
import { PlaybackBar } from './PlaybackBar';
import { ExportOptionsSheet } from '../export/ExportOptionsSheet';
import { StaticSpectrogram } from '../recording/SpectrogramView';
import DetectionOverlayImage, { getDetectionAccent } from '../photo/DetectionOverlayImage';
import { parseDetectedSounds, getIncludedDetectedSounds } from '../../utils/detectedSounds';
import { MultisensorySummary } from '../multisensory/MultisensorySummary';
import { parseMultisensory } from '../../types/multisensory';
import { t } from '../../i18n';

interface Props {
  recording: RecordingWithPerception | null;
  visible: boolean;
  onClose: () => void;
  onDelete?: (recording: RecordingWithPerception) => Promise<void> | void;
  onResyncMedia?: (recording: RecordingWithPerception) => Promise<void> | void;
  onVisibilityChange?: (
    recording: RecordingWithPerception,
    communityVisibility: CommunityVisibility
  ) => Promise<void> | void;
  isDeleting?: boolean;
  isResyncingMedia?: boolean;
  isUpdatingVisibility?: boolean;
  showExportButton?: boolean;
  showSharingSection?: boolean;
  showSyncStatusSection?: boolean;
}

const STATUS_CONFIG: Record<SyncStatus, { color: string; icon: string; label: string }> = {
  local: { color: Colors.statusLocal, icon: 'save', label: 'Local Only' },
  queued: { color: Colors.statusQueued, icon: 'schedule', label: 'Queued for Upload' },
  uploading: { color: Colors.statusUploading, icon: 'cloud-upload', label: 'Uploading...' },
  uploaded: { color: Colors.statusUploaded, icon: 'cloud-done', label: 'Uploaded' },
  failed: { color: Colors.statusFailed, icon: 'error', label: 'Upload Failed' },
};

export function RecordingDetailModal({
  recording,
  visible,
  onClose,
  onDelete,
  onResyncMedia,
  onVisibilityChange,
  isDeleting = false,
  isResyncingMedia = false,
  isUpdatingVisibility = false,
  showExportButton = true,
  showSharingSection = true,
  showSyncStatusSection = true,
}: Props) {
  const [showExportSheet, setShowExportSheet] = useState(false);

  if (!recording) return null;

  const statusConfig = STATUS_CONFIG[recording.syncStatus];
  const recordedDate = new Date(recording.recordedAt);
  const photoClassification = getIncludedImageClassifications(recording.photoClassification ?? []);
  const objectDetections = photoClassification.filter((item) => item.source !== 'environment');
  const environmentSegments = photoClassification.filter((item) => item.source === 'environment');
  const groupedObjectDetections = groupImageClassifications(objectDetections);
  const groupedEnvironmentSegments = groupImageClassifications(environmentSegments);
  const visualContext = assessVisualContext(photoClassification);
  const noteThemes = extractNoteThemes(recording.fieldNotes, recording.spokenDescription);
  const detectedSounds = getIncludedDetectedSounds(parseDetectedSounds(recording.detectedSounds));

  const handleExport = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setShowExportSheet(true);
  };

  const handleDelete = () => {
    if (!onDelete) return;

    Alert.alert(
      t('Delete recording?'),
      recording.remoteId
        ? t('This will remove the recording from this device and also try to delete the uploaded copy from Supabase.')
        : t('This will permanently remove the recording from this device.'),
      [
        { text: t('Cancel'), style: 'cancel' },
        {
          text: t('Delete'),
          style: 'destructive',
          onPress: () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            void onDelete(recording);
          },
        },
      ]
    );
  };

  const handleVisibilityChange = (communityVisibility: CommunityVisibility) => {
    if (
      !onVisibilityChange
      || isUpdatingVisibility
      || communityVisibility === recording.communityVisibility
    ) {
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    void onVisibilityChange(recording, communityVisibility);
  };

  const handleResyncMedia = () => {
    if (!onResyncMedia || isResyncingMedia) {
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    void onResyncMedia(recording);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onClose();
            }}
            accessibilityRole="button"
            accessibilityLabel={t('Close recording details')}
          >
            <MaterialIcons name="close" size={24} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('Recording Details')}</Text>
          {showExportButton ? (
            <TouchableOpacity
              style={styles.exportButton}
              onPress={handleExport}
              accessibilityRole="button"
              accessibilityLabel={t('Export recording')}
              accessibilityHint={t('Open export options for this recording')}
            >
              <MaterialIcons name="ios-share" size={24} color={Colors.primary} />
            </TouchableOpacity>
          ) : (
            <View style={styles.exportButtonSpacer} />
          )}
        </View>

        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.audioHero}>
            <View style={styles.audioHeroMetaRow}>
              <View style={styles.audioHeroDateWrap}>
                <Text style={styles.audioHeroEyebrow}>{t('Captured')}</Text>
                <Text style={styles.audioHeroDate}>
                  {formatDate(recordedDate, 'long')}
                </Text>
                <Text style={styles.audioHeroTime}>
                  {formatDate(recordedDate, 'time')} ({recording.timezone || 'Local'})
                </Text>
              </View>
              <View
                style={[
                  styles.audioHeroStatusPill,
                  { borderColor: `${statusConfig.color}30`, backgroundColor: `${statusConfig.color}12` },
                ]}
              >
                <MaterialIcons name={statusConfig.icon as any} size={15} color={statusConfig.color} />
                <Text style={[styles.audioHeroStatusText, { color: statusConfig.color }]}>
                  {t(statusConfig.label)}
                </Text>
              </View>
            </View>

            {recording.spectrogramUri ? (
              <View style={styles.audioHeroSpectrogram}>
                <StaticSpectrogram imageUri={recording.spectrogramUri} height={188} />
              </View>
            ) : null}

            <View style={styles.audioHeroPlayback}>
              <PlaybackBar
                audioUri={recording.audioUri}
                durationMs={recording.durationMs}
                compact
              />
            </View>

            {detectedSounds.length > 0 && (
              <View style={styles.audioHeroSubsection}>
                <View style={styles.audioHeroSectionHeader}>
                  <Text style={styles.audioHeroSectionTitle}>{t('Verified sound classes')}</Text>
                  <Text style={styles.audioHeroSectionMeta}>
                    {t('{count} kept', { count: detectedSounds.length })}
                  </Text>
                </View>
                <View style={styles.classificationList}>
                  {detectedSounds.map((sound, index) => {
                    const accentColor = sound.occurrenceCount && sound.occurrenceCount > 1
                      ? '#E4EDEE'
                      : getDetectionAccent(index);
                    const confidencePercent = typeof sound.score === 'number'
                      ? Math.round(sound.score * 100)
                      : null;

                    return (
                      <View
                        key={`${t(sound.label)}-${index}`}
                        style={[
                          styles.classificationRow,
                          index === detectedSounds.length - 1 && styles.classificationRowLast,
                        ]}
                      >
                        <View style={styles.classificationRowHeader}>
                          <View style={styles.classificationMeta}>
                            <View
                              style={[
                                styles.classificationRank,
                                { backgroundColor: `${accentColor}18` },
                              ]}
                            >
                              <Text
                                style={[
                                  styles.classificationRankText,
                                  { color: accentColor },
                                ]}
                              >
                                {index + 1}
                              </Text>
                            </View>
                            <Text style={styles.classificationLabel}>{t(sound.label)}</Text>
                            <View style={styles.classificationCountBadge}>
                              <Text style={styles.classificationCountText}>
                                {sound.hierarchy === 'broad' ? t('Broad') : t('Specific')}
                              </Text>
                            </View>
                            {sound.occurrenceCount && sound.occurrenceCount > 1 ? (
                              <View
                                style={[
                                  styles.audioRepeatBadge,
                                  { backgroundColor: `${accentColor}18`, borderColor: `${accentColor}2f` },
                                ]}
                              >
                                <Text style={[styles.audioRepeatText, { color: accentColor }]}>
                                  {sound.occurrenceCount}x
                                </Text>
                              </View>
                            ) : null}
                          </View>
                          {confidencePercent !== null ? (
                            <Text
                              style={[
                                styles.classificationConfidence,
                                { color: accentColor },
                              ]}
                            >
                              {confidencePercent}%
                            </Text>
                          ) : null}
                        </View>
                        {confidencePercent !== null ? (
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
                        ) : null}
                      </View>
                    );
                  })}
                </View>
              </View>
            )}
          </View>

          {(recording.photoUri || photoClassification.length) && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t('Photo Analysis')}</Text>
              <View style={styles.card}>
                {recording.photoUri && (
                  <DetectionOverlayImage
                    uri={recording.photoUri}
                    detections={objectDetections}
                    maxHeight={260}
                    borderRadius={Radius.sm}
                    showBoxes={false}
                    showLabels={false}
                  />
                )}

                {objectDetections.length > 0 && (
                  <View style={styles.classificationSection}>
                    <Text style={styles.infoLabel}>{t('Saved object detections')}</Text>
                    <View style={styles.classificationList}>
                      {groupedObjectDetections.map((classification, index) => {
                        const accentColor = getDetectionAccent(index);
                        const confidencePercent = Math.round(classification.confidence * 100);
                        return (
                          <View
                            key={`object-${t(classification.label)}-${index}`}
                            style={[
                              styles.classificationRow,
                              index === objectDetections.length - 1 && styles.classificationRowLast,
                            ]}
                          >
                            <View style={styles.classificationRowHeader}>
                              <View style={styles.classificationMeta}>
                                <View
                                  style={[
                                    styles.classificationRank,
                                    { backgroundColor: `${accentColor}18` },
                                  ]}
                                >
                                  <Text
                                    style={[
                                      styles.classificationRankText,
                                      { color: accentColor },
                                    ]}
                                >
                                  {index + 1}
                                </Text>
                              </View>
                              <Text style={styles.classificationLabel}>
                                {t(classification.label)}
                              </Text>
                              {classification.count > 1 && (
                                <View style={styles.classificationCountBadge}>
                                  <Text style={styles.classificationCountText}>
                                    {classification.count}x
                                  </Text>
                                </View>
                              )}
                            </View>
                            <Text
                              style={[
                                  styles.classificationConfidence,
                                  { color: accentColor },
                                ]}
                              >
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
                          </View>
                        );
                      })}
                    </View>
                  </View>
                )}

                {environmentSegments.length > 0 && (
                  <View style={styles.classificationSection}>
                    <Text style={styles.infoLabel}>{t('Saved environmental context')}</Text>
                    <View style={styles.classificationList}>
                      {groupedEnvironmentSegments.map((classification, index) => {
                        const accentColor = getDetectionAccent(index + groupedObjectDetections.length);
                        const coveragePercent = Math.round((classification.coverage ?? classification.confidence) * 100);
                        return (
                          <View
                            key={`environment-${t(classification.label)}-${index}`}
                            style={[
                              styles.classificationRow,
                              index === environmentSegments.length - 1 && styles.classificationRowLast,
                            ]}
                          >
                            <View style={styles.classificationRowHeader}>
                              <View style={styles.classificationMeta}>
                                <View
                                  style={[
                                    styles.classificationRank,
                                    { backgroundColor: `${accentColor}18` },
                                  ]}
                                >
                                  <Text
                                    style={[
                                      styles.classificationRankText,
                                      { color: accentColor },
                                    ]}
                                  >
                                    {index + 1}
                                  </Text>
                                </View>
                                <Text style={styles.classificationLabel}>
                                  {t(classification.label)}
                                </Text>
                              </View>
                              <Text
                                style={[
                                  styles.classificationConfidence,
                                  { color: accentColor },
                                ]}
                              >
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
                          </View>
                        );
                      })}
                    </View>
                  </View>
                )}

                {photoClassification.length > 0 && (
                  <View style={styles.classificationSection}>
                    <Text style={styles.infoLabel}>{t('Visual soundscape context')}</Text>
                    <View style={styles.visualContextCard}>
                      <Text style={styles.visualContextHeadline}>{visualContext.dominantContext}</Text>
                      <Text style={styles.visualContextSummary}>
                        {formatVisualIndicatorSummary(visualContext)}
                      </Text>
                      <View style={styles.visualContextTags}>
                        {visualContext.indicators
                          .filter((item) => item.level !== 'low')
                          .slice(0, 4)
                          .map((item) => (
                            <View key={item.key} style={styles.visualContextTag}>
                              <Text style={styles.visualContextTagText}>
                                {t(item.label)} {item.level}
                              </Text>
                            </View>
                          ))}
                      </View>
                    </View>
                  </View>
                )}
              </View>
            </View>
          )}

          {/* Recording info */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('Recording Info')}</Text>
            <View style={styles.infoGridCard}>
              <View style={styles.infoGrid}>
                <View style={styles.infoGridItem}>
                  <Text style={styles.infoGridLabel}>{t('Duration')}</Text>
                  <Text style={styles.infoGridValue}>{formatDuration(recording.durationMs)}</Text>
                </View>
                <View style={styles.infoGridItem}>
                  <Text style={styles.infoGridLabel}>{t('Protocol')}</Text>
                  <Text style={styles.infoGridValue}>{getProtocolLabel(recording.protocolType)}</Text>
                </View>
                <View style={styles.infoGridItem}>
                  <Text style={styles.infoGridLabel}>{t('Sample Rate')}</Text>
                  <Text style={styles.infoGridValue}>{recording.sampleRate / 1000} kHz</Text>
                </View>
                <View style={styles.infoGridItem}>
                  <Text style={styles.infoGridLabel}>{t('Bit Depth')}</Text>
                  <Text style={styles.infoGridValue}>{recording.bitDepth}-bit</Text>
                </View>
                {recording.habitatType ? (
                  <View style={styles.infoGridItemFull}>
                    <Text style={styles.infoGridLabel}>{t('Habitat')}</Text>
                    <Text style={styles.infoGridValue}>
                      {getHabitatLabel(recording.habitatType)}
                    </Text>
                  </View>
                ) : null}
              </View>
            </View>
          </View>

          {(recording.fieldNotes || recording.spokenDescription) && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t('Observation Notes')}</Text>
              <View style={styles.card}>
                {recording.fieldNotes ? (
                  <View style={styles.notesBlock}>
                    <Text style={styles.notesLabel}>{t('Field notes')}</Text>
                    <Text style={styles.notesText}>{recording.fieldNotes}</Text>
                  </View>
                ) : null}

                {recording.spokenDescription ? (
                  <View style={styles.notesBlock}>
                    <Text style={styles.notesLabel}>{t('Spoken description transcript')}</Text>
                    <Text style={styles.notesText}>{recording.spokenDescription}</Text>
                  </View>
                ) : null}

                {noteThemes.length > 0 ? (
                  <View style={styles.notesBlock}>
                    <Text style={styles.notesLabel}>{t('Detected note themes')}</Text>
                    <View style={styles.notesThemeList}>
                      {noteThemes.map((theme) => (
                        <View key={theme.key} style={styles.notesThemeChip}>
                          <Text style={styles.notesThemeChipText}>{t(theme.label)}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                ) : null}
              </View>
            </View>
          )}

          {/* Perception data */}
          {recording.perception && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t('Perception Assessment')}</Text>
              <View style={styles.card}>
                <View style={styles.perceptionGrid}>
                  <View style={styles.perceptionItem}>
                    <Text style={styles.perceptionLabel}>
                      {getIsoAxisLabel(recording.perception.isoPleasant, 'Pleasant', 'Annoying')}
                    </Text>
                    <View style={styles.perceptionBarContainer}>
                      <View style={styles.perceptionBarBg}>
                        <View
                          style={[
                            styles.perceptionBarFill,
                            {
                              width: `${((recording.perception.isoPleasant + 1) / 2) * 100}%`,
                              backgroundColor:
                                recording.perception.isoPleasant > 0 ? Colors.success : Colors.error,
                            },
                          ]}
                        />
                      </View>
                      <Text style={styles.perceptionValue}>
                        {getIsoAxisPercent(recording.perception.isoPleasant)}%
                      </Text>
                    </View>
                  </View>

                  <View style={styles.perceptionItem}>
                    <Text style={styles.perceptionLabel}>
                      {getIsoAxisLabel(recording.perception.isoEventful, 'Eventful', 'Uneventful')}
                    </Text>
                    <View style={styles.perceptionBarContainer}>
                      <View style={styles.perceptionBarBg}>
                        <View
                          style={[
                            styles.perceptionBarFill,
                            {
                              width: `${((recording.perception.isoEventful + 1) / 2) * 100}%`,
                              backgroundColor: Colors.secondary,
                            },
                          ]}
                        />
                      </View>
                      <Text style={styles.perceptionValue}>
                        {getIsoAxisPercent(recording.perception.isoEventful)}%
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Circumplex quadrant indicator */}
                <View style={styles.quadrantContainer}>
                  <Text style={styles.quadrantLabel}>
                    {getCircumplexQuadrantLabel(
                      recording.perception.isoPleasant,
                      recording.perception.isoEventful
                    )}
                  </Text>
                </View>
              </View>
            </View>
          )}

          {/* Multisensory ratings */}
          {parseMultisensory(recording.multisensory) && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t('Multisensory Assessment')}</Text>
              <MultisensorySummary assessment={parseMultisensory(recording.multisensory)} />
            </View>
          )}

          {/* Quality flags */}
          {(recording.hasClipping || recording.hasWindHandling || recording.hasLowSNR) && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t('Quality Warnings')}</Text>
              <View style={styles.warningCard}>
                {recording.hasClipping && (
                  <View style={styles.warningItem}>
                    <MaterialIcons name="warning" size={20} color={Colors.warning} />
                    <View style={styles.warningContent}>
                      <Text style={styles.warningTitle}>{t('Audio Clipping Detected')}</Text>
                      <Text style={styles.warningText}>
                        {t('Parts of the recording may have distortion from high volume levels.')}
                      </Text>
                    </View>
                  </View>
                )}
                {recording.hasWindHandling && (
                  <View style={styles.warningItem}>
                    <MaterialIcons name="air" size={20} color={Colors.warning} />
                    <View style={styles.warningContent}>
                      <Text style={styles.warningTitle}>{t('Wind Noise Detected')}</Text>
                      <Text style={styles.warningText}>
                        {t('Wind handling noise may affect the recording quality.')}
                      </Text>
                    </View>
                  </View>
                )}
                {recording.hasLowSNR && (
                  <View style={styles.warningItem}>
                    <MaterialIcons name="hearing-disabled" size={20} color={Colors.warning} />
                    <View style={styles.warningContent}>
                      <Text style={styles.warningTitle}>{t('Low Signal-to-Noise')}</Text>
                      <Text style={styles.warningText}>
                        {t('The recording has a low signal level relative to background noise.')}
                      </Text>
                    </View>
                  </View>
                )}
              </View>
            </View>
          )}

          {/* Sync status */}
          {showSyncStatusSection && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t('Sync Status')}</Text>
              <View style={[styles.statusCard, { borderLeftColor: statusConfig.color }]}>
                <MaterialIcons
                  name={statusConfig.icon as any}
                  size={24}
                  color={statusConfig.color}
                />
                <View style={styles.statusContent}>
                  <Text style={[styles.statusLabel, { color: statusConfig.color }]}>
                    {t(statusConfig.label)}
                  </Text>
                  {recording.remoteId && (
                    <Text style={styles.remoteIdText}>ID: {recording.remoteId}</Text>
                  )}
                </View>
              </View>
            </View>
          )}

          {showSharingSection && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t('Community Sharing')}</Text>
              <View style={styles.card}>
                <Text style={styles.publishHeading}>
                  {recording.communityVisibility === 'community' ? t('Published to community') : t('Private recording')}
                </Text>
                <Text style={styles.publishDescription}>
                  {recording.communityVisibility === 'community'
                    ? t('This recording can appear on the Explore map for the community.')
                    : t('This recording stays in your private archive unless you publish it.')}
                </Text>
                <View style={styles.publishToggleRow}>
                  <TouchableOpacity
                    style={[
                      styles.publishToggleButton,
                      recording.communityVisibility === 'private' && styles.publishToggleButtonActive,
                    ]}
                    onPress={() => handleVisibilityChange('private')}
                    disabled={isUpdatingVisibility}
                    accessibilityRole="button"
                    accessibilityLabel={t('Keep this recording private')}
                    accessibilityState={{
                      selected: recording.communityVisibility === 'private',
                      disabled: isUpdatingVisibility,
                    }}
                  >
                    <MaterialIcons
                      name="lock"
                      size={18}
                      color={recording.communityVisibility === 'private' ? Colors.primary : Colors.textMuted}
                    />
                    <Text
                      style={[
                        styles.publishToggleText,
                        recording.communityVisibility === 'private' && styles.publishToggleTextActive,
                      ]}
                    >
                      {t('Private')}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.publishToggleButton,
                      recording.communityVisibility === 'community' && styles.publishToggleButtonActive,
                    ]}
                    onPress={() => handleVisibilityChange('community')}
                    disabled={isUpdatingVisibility}
                    accessibilityRole="button"
                    accessibilityLabel={t('Publish this recording to the community')}
                    accessibilityState={{
                      selected: recording.communityVisibility === 'community',
                      disabled: isUpdatingVisibility,
                    }}
                  >
                    <MaterialIcons
                      name="public"
                      size={18}
                      color={recording.communityVisibility === 'community' ? Colors.primary : Colors.textMuted}
                    />
                    <Text
                      style={[
                        styles.publishToggleText,
                        recording.communityVisibility === 'community' && styles.publishToggleTextActive,
                      ]}
                    >
                      {t('Community')}
                    </Text>
                  </TouchableOpacity>
                </View>
                <Text style={styles.publishFootnote}>
                  {recording.remoteId
                    ? t('Changes update the uploaded copy immediately.')
                    : t('If you publish a local-only recording, it will be queued for upload.')}
                </Text>
              </View>
            </View>
          )}

          {/* Device info */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('Device Info')}</Text>
            <View style={styles.card}>
              <Text style={styles.deviceText}>{recording.deviceModel}</Text>
              <Text style={styles.deviceSubtext}>
                {recording.osVersion} | {recording.micRoute}
              </Text>
            </View>
          </View>

          {/* Location */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('Location')}</Text>
            <View style={styles.card}>
              <View style={styles.locationRow}>
                <MaterialIcons name="location-on" size={20} color={Colors.textMuted} />
                <Text style={styles.locationText}>
                  {typeof recording.latitude === 'number' && typeof recording.longitude === 'number'
                    ? `${recording.latitude.toFixed(6)}, ${recording.longitude.toFixed(6)}`
                    : t('Location not stored')}
                </Text>
              </View>
              <Text style={styles.locationSubtext}>
                Accuracy: {typeof recording.gpsAccuracy === 'number' ? `${recording.gpsAccuracy.toFixed(0)}m` : 'not stored'} | Privacy: {recording.privacyMode}
              </Text>
            </View>
          </View>

          {onDelete && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t('Recording Actions')}</Text>
              {onResyncMedia && recording.remoteId && (recording.photoUri || recording.spectrogramUri) && (
                <TouchableOpacity
                  style={[styles.resyncButton, isResyncingMedia && styles.deleteButtonDisabled]}
                  onPress={handleResyncMedia}
                  disabled={isResyncingMedia}
                  activeOpacity={0.85}
                >
                  <MaterialIcons name="cloud-sync" size={20} color={Colors.primary} />
                  <View style={styles.deleteContent}>
                    <Text style={styles.resyncTitle}>
                      {isResyncingMedia ? t('Resyncing media...') : t('Resync Photo & Spectrogram')}
                    </Text>
                    <Text style={styles.deleteDescription}>
                      {t('Upload missing photo and spectrogram assets to the existing cloud record.')}
                    </Text>
                  </View>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={[styles.deleteButton, isDeleting && styles.deleteButtonDisabled]}
                onPress={handleDelete}
                disabled={isDeleting}
                activeOpacity={0.85}
              >
                <MaterialIcons name="delete-outline" size={20} color={Colors.error} />
                <View style={styles.deleteContent}>
                  <Text style={styles.deleteTitle}>
                    {isDeleting ? t('Deleting recording...') : t('Delete Recording')}
                  </Text>
                  <Text style={styles.deleteDescription}>
                    Remove this recording from the device
                    {recording.remoteId ? ' and clean up its uploaded copy when possible.' : '.'}
                  </Text>
                </View>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </View>

      {/* Export options sheet */}
      <ExportOptionsSheet
        recording={recording}
        visible={showExportSheet}
        onClose={() => setShowExportSheet(false)}
      />
    </Modal>
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
    paddingHorizontal: Spacing.md,
    paddingTop: 60,
    paddingBottom: Spacing.md,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.surfaceHighlight,
  },
  closeButton: {
    padding: Spacing.sm,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text,
  },
  exportButton: {
    padding: Spacing.sm,
  },
  exportButtonSpacer: {
    width: 40,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: Spacing.md,
    paddingBottom: Spacing.xxl,
  },
  audioHero: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.surfaceHighlight,
    padding: Spacing.md,
    ...Shadows.sm,
  },
  audioHeroMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  audioHeroDateWrap: {
    flex: 1,
  },
  audioHeroEyebrow: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: Colors.textMuted,
    marginBottom: 6,
  },
  audioHeroDate: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '700',
    color: Colors.text,
  },
  audioHeroTime: {
    marginTop: 4,
    fontSize: 14,
    color: Colors.textMuted,
  },
  audioHeroStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: Radius.full,
    paddingVertical: 7,
    paddingHorizontal: 10,
  },
  audioHeroStatusText: {
    fontSize: 12,
    fontWeight: '700',
  },
  audioHeroSpectrogram: {
    overflow: 'hidden',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.surfaceHighlight,
    backgroundColor: Colors.primary,
  },
  audioHeroPlayback: {
    marginTop: Spacing.md,
  },
  audioHeroSubsection: {
    marginTop: Spacing.md,
  },
  audioHeroSectionHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: Spacing.md,
    marginBottom: Spacing.sm,
  },
  audioHeroSectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: Colors.textMuted,
  },
  audioHeroSectionMeta: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.surfaceHighlight,
  },
  section: {
    marginTop: Spacing.lg,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textMuted,
    marginBottom: Spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  dateInfo: {
    flex: 1,
  },
  dateText: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text,
  },
  timeText: {
    fontSize: 14,
    color: Colors.textMuted,
    marginTop: 2,
  },
  spectrogramContainer: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.surfaceHighlight,
  },
  spectrogram: {
    width: '100%',
    height: 150,
    borderRadius: Radius.sm,
  },
  classificationSection: {
    marginTop: Spacing.md,
  },
  classificationList: {
    marginTop: Spacing.xs,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.surfaceHighlight,
    overflow: 'hidden',
  },
  classificationRow: {
    paddingHorizontal: 13,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.surfaceHighlight,
  },
  classificationRowLast: {
    borderBottomWidth: 0,
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
    gap: 7,
    flex: 1,
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
  classificationEmoji: {
    fontSize: 16,
  },
  classificationLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.text,
    flexShrink: 1,
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
  audioRepeatBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Radius.full,
    borderWidth: 1,
  },
  audioRepeatText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  classificationConfidence: {
    fontSize: 12,
    fontWeight: '500',
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
  visualContextCard: {
    marginTop: Spacing.xs,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.surfaceHighlight,
    backgroundColor: Colors.surface,
    padding: Spacing.md,
  },
  visualContextHeadline: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 4,
  },
  visualContextSummary: {
    fontSize: 14,
    lineHeight: 20,
    color: Colors.textMuted,
  },
  visualContextTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  visualContextTag: {
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: Radius.full,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.surfaceHighlight,
  },
  visualContextTagText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.text,
    textTransform: 'capitalize',
  },
  infoRow: {
    flexDirection: 'row',
    gap: Spacing.lg,
    marginBottom: Spacing.md,
  },
  infoGridCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.surfaceHighlight,
    overflow: 'hidden',
  },
  infoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  infoGridItem: {
    width: '50%',
    paddingHorizontal: Spacing.md,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.surfaceHighlight,
  },
  infoGridItemFull: {
    width: '100%',
    paddingHorizontal: Spacing.md,
    paddingVertical: 14,
  },
  infoGridLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: Colors.textMuted,
    marginBottom: 6,
  },
  infoGridValue: {
    fontSize: 17,
    fontWeight: '600',
    color: Colors.text,
  },
  infoItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
  },
  infoContent: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 12,
    color: Colors.textMuted,
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text,
  },
  perceptionGrid: {
    gap: Spacing.md,
  },
  perceptionItem: {
    gap: Spacing.xs,
  },
  perceptionLabel: {
    fontSize: 14,
    color: Colors.textMuted,
  },
  perceptionBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  perceptionBarBg: {
    flex: 1,
    height: 8,
    backgroundColor: Colors.surfaceHighlight,
    borderRadius: 4,
    overflow: 'hidden',
  },
  perceptionBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  perceptionValue: {
    width: 50,
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
    textAlign: 'right',
  },
  quadrantContainer: {
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.surfaceHighlight,
    alignItems: 'center',
  },
  quadrantLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.primary,
  },
  warningCard: {
    backgroundColor: Colors.warningMuted,
    borderRadius: Radius.md,
    padding: Spacing.md,
    gap: Spacing.md,
  },
  warningItem: {
    flexDirection: 'row',
    gap: Spacing.sm,
    alignItems: 'flex-start',
  },
  warningContent: {
    flex: 1,
  },
  warningTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 2,
  },
  warningText: {
    fontSize: 13,
    color: Colors.textMuted,
    lineHeight: 18,
  },
  statusCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.surfaceHighlight,
    borderLeftWidth: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  statusContent: {
    flex: 1,
  },
  publishHeading: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 6,
  },
  publishDescription: {
    fontSize: 14,
    lineHeight: 20,
    color: Colors.textMuted,
    marginBottom: Spacing.md,
  },
  publishToggleRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  publishToggleButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.surfaceHighlight,
    backgroundColor: Colors.surface,
  },
  publishToggleButtonActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.surfaceHighlight,
  },
  publishToggleText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textMuted,
  },
  publishToggleTextActive: {
    color: Colors.primary,
  },
  publishFootnote: {
    marginTop: Spacing.sm,
    fontSize: 12,
    lineHeight: 18,
    color: Colors.textMuted,
  },
  statusLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  remoteIdText: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
  },
  deviceText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text,
  },
  deviceSubtext: {
    fontSize: 13,
    color: Colors.textMuted,
    marginTop: 2,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  locationText: {
    fontSize: 15,
    color: Colors.text,
    fontVariant: ['tabular-nums'],
  },
  locationSubtext: {
    fontSize: 13,
    color: Colors.textMuted,
    marginTop: Spacing.xs,
    marginLeft: 28,
  },
  notesBlock: {
    gap: 6,
  },
  notesLabel: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    color: Colors.textMuted,
  },
  notesText: {
    fontSize: 15,
    lineHeight: 22,
    color: Colors.text,
  },
  notesThemeList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  notesThemeChip: {
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: Radius.full,
    backgroundColor: Colors.secondaryMuted,
  },
  notesThemeChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.text,
  },
  deleteButton: {
    backgroundColor: Colors.errorMuted,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: '#D7B0A8',
    padding: Spacing.md,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
  },
  resyncButton: {
    backgroundColor: Colors.primaryMuted,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.surfaceHighlight,
    padding: Spacing.md,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  deleteButtonDisabled: {
    opacity: 0.6,
  },
  deleteContent: {
    flex: 1,
  },
  deleteTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.error,
    marginBottom: 2,
  },
  resyncTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.primary,
    marginBottom: 2,
  },
  deleteDescription: {
    fontSize: 13,
    lineHeight: 18,
    color: Colors.textMuted,
  },
});
