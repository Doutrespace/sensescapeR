import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, Radius, Spacing } from '../../theme/colors';
import { QualityFlags } from '../../types/recording';
import { formatDuration } from '../../constants/protocols';
import { useAudioPlayer } from '../../hooks/useAudioPlayer';
import { formatAudioLevel, formatDbfs } from '../../utils/audioLevel';
import SpectrogramPlayer from './SpectrogramPlayer';
import PlaybackControls from './PlaybackControls';
import QualityHints from '../recording/QualityHints';
import { StoredDetectedSound, getIncludedDetectedSounds } from '../../utils/detectedSounds';

interface Props {
  audioUri: string;
  duration: number;
  qualityFlags: QualityFlags;
  spectrogramUri?: string | null;
  normalizationApplied?: boolean;
  normalizationGain?: number | null;
  detectedSounds?: StoredDetectedSound[];
  onContinue: (detectedSounds: StoredDetectedSound[]) => void;
  onRetake: () => void;
}

export default function ReviewScreen({
  audioUri,
  duration,
  qualityFlags,
  spectrogramUri,
  normalizationApplied = false,
  normalizationGain = null,
  detectedSounds = [],
  onContinue,
  onRetake,
}: Props) {
  const {
    isPlaying,
    isLoaded,
    duration: audioDuration,
    position,
    play,
    pause,
    seekTo,
  } = useAudioPlayer(audioUri);

  const { height: windowHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const compact = windowHeight < 860;
  const spectrogramHeight = compact ? 108 : 132;
  const actionsBottomPadding = tabBarHeight + insets.bottom + 12;
  const gainDb = normalizationApplied && normalizationGain && normalizationGain > 1
    ? 20 * Math.log10(normalizationGain)
    : 0;
  const displayPeakDb = Math.min(0, qualityFlags.peakDb + gainDb);
  const displayRmsDb = Math.min(0, qualityFlags.rmsDb + gainDb);
  const peakLevel = formatAudioLevel(displayPeakDb);
  const rmsLevel = formatAudioLevel(displayRmsDb);
  const hasIssues =
    qualityFlags.hasClipping ||
    qualityFlags.hasWindHandling ||
    qualityFlags.hasLowSNR;
  const [reviewedSounds, setReviewedSounds] = React.useState<StoredDetectedSound[]>(detectedSounds);

  React.useEffect(() => {
    setReviewedSounds(detectedSounds);
  }, [detectedSounds]);

  const includedSounds = getIncludedDetectedSounds(reviewedSounds);

  const toggleSound = React.useCallback((label: string) => {
    setReviewedSounds((current) => current.map((sound) => (
      sound.label === label
        ? {
            ...sound,
            reviewStatus: sound.reviewStatus === 'excluded' ? 'included' : 'excluded',
          }
        : sound
    )));
  }, []);

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: actionsBottomPadding + 92 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.eyebrow}>Quality Check</Text>
          <Text style={[styles.title, compact && styles.titleCompact]}>Review Recording</Text>
          <Text style={styles.subtitle}>
            Listen back and verify the take before continuing
          </Text>
        </View>

        <View style={styles.main}>
          <View style={styles.playerSurface}>
            <SpectrogramPlayer
              spectrogramUri={spectrogramUri}
              duration={audioDuration || duration}
              position={position}
              isPlaying={isPlaying}
              height={spectrogramHeight}
              showFrequencyLabels={false}
              displayBoost={normalizationApplied ? normalizationGain ?? undefined : undefined}
            />

            <PlaybackControls
              isPlaying={isPlaying}
              isLoaded={isLoaded}
              duration={audioDuration || duration}
              position={position}
              onPlay={play}
              onPause={pause}
              onSeek={seekTo}
            />
          </View>

          <View style={styles.metricsRow}>
            <View style={styles.metricBlock}>
              <View style={styles.metricMeta}>
                <View style={styles.metricIconWrap}>
                  <MaterialIcons name="timer" size={14} color={Colors.textMuted} />
                </View>
                <Text style={styles.metricLabel}>Duration</Text>
              </View>
              <Text style={styles.metricValue}>{formatDuration(duration)}</Text>
            </View>

            <View style={styles.metricDivider} />

            <View style={styles.metricBlock}>
              <View style={styles.metricMeta}>
                <View style={styles.metricIconWrap}>
                  <MaterialIcons name="graphic-eq" size={14} color={Colors.textMuted} />
                </View>
                <Text style={styles.metricLabel}>Peak level</Text>
              </View>
              <Text style={styles.metricValue}>{peakLevel.percent}%</Text>
              <Text style={styles.metricDetail}>{peakLevel.label}</Text>
              <View style={styles.levelBar}>
                <View
                  style={[
                    styles.levelFill,
                    getLevelFillStyle(peakLevel.tone),
                    { width: `${peakLevel.percent}%` },
                  ]}
                />
              </View>
              <Text style={styles.metricDbfs}>
                {normalizationApplied ? `${formatDbfs(displayPeakDb)} leveled` : formatDbfs(qualityFlags.peakDb)}
              </Text>
            </View>

            <View style={styles.metricDivider} />

            <View style={styles.metricBlock}>
              <View style={styles.metricMeta}>
                <View style={styles.metricIconWrap}>
                  <MaterialIcons name="equalizer" size={14} color={Colors.textMuted} />
                </View>
                <Text style={styles.metricLabel}>Average level</Text>
              </View>
              <Text style={styles.metricValue}>{rmsLevel.percent}%</Text>
              <Text style={styles.metricDetail}>{rmsLevel.label}</Text>
              <View style={styles.levelBar}>
                <View
                  style={[
                    styles.levelFill,
                    getLevelFillStyle(rmsLevel.tone),
                    { width: `${rmsLevel.percent}%` },
                  ]}
                />
              </View>
              <Text style={styles.metricDbfs}>
                {normalizationApplied ? `${formatDbfs(displayRmsDb)} leveled` : formatDbfs(qualityFlags.rmsDb)}
              </Text>
            </View>
          </View>

          {normalizationApplied && normalizationGain && normalizationGain > 1.01 && (
            <View style={styles.normalizationNote}>
              <MaterialIcons name="hearing" size={14} color={Colors.textMuted} />
              <Text style={styles.normalizationNoteText}>
                Playback leveled for a quiet device ({normalizationGain.toFixed(1)}x).
              </Text>
            </View>
          )}

          {hasIssues && (
            <View style={styles.issueStrip}>
              <View style={styles.issueHeader}>
                <Text style={styles.issueTitle}>Quality flags</Text>
                <Text style={styles.issueMeta}>Retake if you need a cleaner sample</Text>
              </View>
              <QualityHints flags={qualityFlags} />
            </View>
          )}

          {reviewedSounds.length > 0 && (
            <View style={styles.detectedSoundsSection}>
              <View style={styles.detectedSoundsHeader}>
                <Text style={styles.detectedSoundsTitle}>Detected sounds</Text>
                <Text style={styles.detectedSoundsMeta}>Tap sounds that were not present</Text>
              </View>
              <View style={styles.detectedSoundList}>
                {reviewedSounds.map((sound, index) => {
                  const excluded = sound.reviewStatus === 'excluded';
                  const repeated = (sound.occurrenceCount ?? 1) > 1;

                  return (
                    <TouchableOpacity
                      key={`${sound.label}-${index}`}
                      style={[
                        styles.detectedSoundRow,
                        repeated && !excluded && styles.detectedSoundRowRepeated,
                        excluded && styles.detectedSoundRowExcluded,
                      ]}
                      onPress={() => toggleSound(sound.label)}
                      activeOpacity={0.78}
                      accessibilityRole="button"
                      accessibilityLabel={`${excluded ? 'Re-include' : 'Exclude'} detected sound ${sound.label}`}
                    >
                      <View style={styles.detectedSoundTextWrap}>
                        <View style={styles.detectedSoundLabelLine}>
                          <Text style={[styles.detectedSoundLabel, excluded && styles.detectedSoundLabelExcluded]}>
                            {sound.label}
                          </Text>
                          <View style={styles.detectedSoundHierarchyBadge}>
                            <Text style={styles.detectedSoundHierarchyBadgeText}>
                              {sound.hierarchy === 'broad' ? 'Broad' : 'Specific'}
                            </Text>
                          </View>
                          {repeated ? (
                            <View style={styles.detectedSoundRepeatBadge}>
                              <Text style={styles.detectedSoundRepeatBadgeText}>{sound.occurrenceCount}x</Text>
                            </View>
                          ) : null}
                        </View>
                        {typeof sound.adjustedScore === 'number' || typeof sound.score === 'number' ? (
                          <Text style={styles.detectedSoundScore}>
                            {Math.round(((sound.adjustedScore ?? sound.score) ?? 0) * 100)}%
                          </Text>
                        ) : null}
                      </View>
                      <View style={[styles.detectedSoundAction, excluded && styles.detectedSoundActionExcluded]}>
                        <MaterialIcons
                          name={excluded ? 'undo' : 'close'}
                          size={16}
                          color={excluded ? Colors.textMuted : Colors.error}
                        />
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <Text style={styles.detectedSoundsFootnote}>
                {includedSounds.length > 0
                  ? `${includedSounds.length} sound${includedSounds.length === 1 ? '' : 's'} will be kept with this recording.`
                  : 'No sounds selected. You can still continue.'}
              </Text>
            </View>
          )}
        </View>
      </ScrollView>

      <View style={[styles.actionsDock, { paddingBottom: actionsBottomPadding }]}>
        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.retakeButton}
            onPress={onRetake}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Retake recording"
            accessibilityHint="Discard this take and return to the recording step"
          >
            <Text style={styles.retakeButtonText}>Retake</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.continueButton}
            onPress={() => onContinue(reviewedSounds)}
            activeOpacity={0.82}
            accessibilityRole="button"
            accessibilityLabel="Continue after review"
            accessibilityHint="Accept this recording and continue to the photo step"
          >
            <Text style={styles.continueButtonText}>Continue</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

function getLevelFillStyle(tone: 'low' | 'good' | 'hot') {
  if (tone === 'low') {
    return styles.levelFillLow;
  }
  if (tone === 'hot') {
    return styles.levelFillHot;
  }
  return styles.levelFillGood;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  header: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: 18,
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    color: Colors.primary,
    marginBottom: 8,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: -0.9,
    color: Colors.text,
    marginBottom: 8,
  },
  titleCompact: {
    fontSize: 28,
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 23,
    color: Colors.textMuted,
    maxWidth: 360,
  },
  main: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
  },
  playerSurface: {
    backgroundColor: Colors.surface,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: Colors.surfaceHighlight,
    padding: 14,
  },
  metricsRow: {
    marginTop: 14,
    paddingHorizontal: 6,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: Colors.surfaceHighlight,
  },
  metricBlock: {
    flex: 1,
    paddingHorizontal: 14,
  },
  metricMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  metricIconWrap: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EEE6D8',
  },
  metricLabel: {
    fontSize: 13,
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  metricValue: {
    fontSize: 19,
    fontWeight: '700',
    color: Colors.text,
    fontVariant: ['tabular-nums'],
  },
  metricDetail: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
    marginBottom: 10,
  },
  metricDbfs: {
    fontSize: 11,
    color: Colors.textDisabled,
    marginTop: 8,
    fontVariant: ['tabular-nums'],
  },
  metricDivider: {
    width: 1,
    height: '100%',
    backgroundColor: Colors.surfaceHighlight,
  },
  levelBar: {
    height: 6,
    borderRadius: Radius.full,
    backgroundColor: Colors.primaryMuted,
    overflow: 'hidden',
  },
  levelFill: {
    height: '100%',
    borderRadius: Radius.full,
  },
  levelFillLow: {
    backgroundColor: Colors.warning,
  },
  levelFillGood: {
    backgroundColor: Colors.success,
  },
  levelFillHot: {
    backgroundColor: Colors.error,
  },
  normalizationNote: {
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 16,
    backgroundColor: '#EEE6D8',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  normalizationNoteText: {
    flex: 1,
    color: Colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
  },
  issueStrip: {
    marginTop: 14,
    padding: 16,
    borderRadius: 24,
    backgroundColor: '#F5EDE4',
    borderWidth: 1,
    borderColor: '#E4D1BE',
  },
  issueHeader: {
    marginBottom: 10,
  },
  issueTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.error,
    marginBottom: 2,
  },
  issueMeta: {
    fontSize: 13,
    lineHeight: 18,
    color: Colors.textMuted,
  },
  detectedSoundsSection: {
    marginTop: 14,
    padding: 14,
    backgroundColor: Colors.surface,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: Colors.surfaceHighlight,
  },
  detectedSoundsHeader: {
    marginBottom: 10,
    gap: 3,
  },
  detectedSoundsTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
  },
  detectedSoundsMeta: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  detectedSoundList: {
    gap: 8,
  },
  detectedSoundRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 16,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.surfaceHighlight,
  },
  detectedSoundRowRepeated: {
    backgroundColor: '#FFF8E0',
  },
  detectedSoundRowExcluded: {
    opacity: 0.55,
  },
  detectedSoundTextWrap: {
    flex: 1,
    gap: 2,
  },
  detectedSoundLabelLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  detectedSoundLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
    flexShrink: 1,
  },
  detectedSoundLabelExcluded: {
    textDecorationLine: 'line-through',
    color: Colors.textMuted,
  },
  detectedSoundScore: {
    fontSize: 12,
    color: Colors.textMuted,
    fontVariant: ['tabular-nums'],
  },
  detectedSoundAction: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F7E5E0',
  },
  detectedSoundActionExcluded: {
    backgroundColor: '#EEE6D8',
  },
  detectedSoundRepeatBadge: {
    borderRadius: Radius.full,
    backgroundColor: 'rgb(225,173,1)',
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  detectedSoundHierarchyBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Radius.full,
    backgroundColor: Colors.secondaryMuted,
  },
  detectedSoundHierarchyBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.textMuted,
    letterSpacing: 0.2,
    textTransform: 'uppercase',
  },
  detectedSoundRepeatBadgeText: {
    color: '#4A3712',
    fontSize: 10,
    fontWeight: '800',
  },
  detectedSoundsFootnote: {
    marginTop: 10,
    fontSize: 12,
    color: Colors.textMuted,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    paddingTop: 16,
  },
  actionsDock: {
    paddingHorizontal: Spacing.lg,
    paddingTop: 8,
    backgroundColor: Colors.background,
  },
  retakeButton: {
    flex: 1,
    height: 56,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.surfaceHighlight,
  },
  retakeButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
  },
  continueButton: {
    flex: 1,
    height: 56,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
  },
  continueButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.background,
  },
});
