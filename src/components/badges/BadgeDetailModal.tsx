/**
 * BadgeDetailModal - Shows badge details and collection
 */
import React, { useMemo } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Modal,
  Pressable,
  ScrollView,
  Dimensions,
} from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  SlideInDown,
  SlideOutDown,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { format } from 'date-fns';
import { BadgeDefinition, EarnedBadge } from '../../badges/types';
import { ALL_BADGES, getProgressToNextBadge, getNextMilestoneBadge } from '../../badges/definitions';
import { BadgeIcon } from './BadgeIcon';
import { Colors, Typography, Spacing, Radius } from '../../theme/colors';

interface BadgeDetailModalProps {
  visible: boolean;
  selectedBadge?: BadgeDefinition | null;
  earnedBadges: EarnedBadge[];
  totalRecordings: number;
  onClose: () => void;
  onBadgeSelect: (badge: BadgeDefinition) => void;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const BADGE_GRID_SIZE = Math.floor((SCREEN_WIDTH - Spacing.lg * 2 - Spacing.md * 3) / 4);

export function BadgeDetailModal({
  visible,
  selectedBadge,
  earnedBadges,
  totalRecordings,
  onClose,
  onBadgeSelect,
}: BadgeDetailModalProps) {
  const earnedBadgeIds = useMemo(
    () => new Set(earnedBadges.map(b => b.badgeId)),
    [earnedBadges]
  );

  const progress = useMemo(
    () => getProgressToNextBadge(totalRecordings),
    [totalRecordings]
  );

  const nextBadge = useMemo(
    () => getNextMilestoneBadge(totalRecordings),
    [totalRecordings]
  );

  const selectedEarnedData = useMemo(() => {
    if (!selectedBadge) return null;
    return earnedBadges.find(eb => eb.badgeId === selectedBadge.id);
  }, [selectedBadge, earnedBadges]);

  const handleBadgePress = (badge: BadgeDefinition) => {
    if (earnedBadgeIds.has(badge.id)) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onBadgeSelect(badge);
    } else {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft);
    }
  };

  const handleClose = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={handleClose}
    >
      <Animated.View
        style={styles.overlay}
        entering={FadeIn.duration(200)}
        exiting={FadeOut.duration(200)}
      >
        <Pressable style={styles.backdrop} onPress={handleClose} />

        <Animated.View
          style={styles.sheet}
          entering={SlideInDown.springify().damping(15)}
          exiting={SlideOutDown.duration(200)}
        >
          {/* Handle */}
          <View style={styles.handleContainer}>
            <View style={styles.handle} />
          </View>

          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Selected badge detail */}
            {selectedBadge && (
              <View style={styles.selectedBadgeSection}>
                <BadgeIcon
                  badge={selectedBadge}
                  size="large"
                  showGlow
                  animated={earnedBadgeIds.has(selectedBadge.id)}
                />
                <Text style={styles.selectedBadgeName}>{selectedBadge.name}</Text>
                <Text style={styles.selectedBadgeDescription}>
                  {selectedBadge.description}
                </Text>
                {selectedEarnedData && (
                  <Text style={styles.earnedDate}>
                    Earned {format(new Date(selectedEarnedData.earnedAt), 'MMMM d, yyyy')}
                  </Text>
                )}
                {!earnedBadgeIds.has(selectedBadge.id) && (
                  <View style={styles.lockedBadge}>
                    <Text style={styles.lockedText}>
                      {selectedBadge.requirement.value - totalRecordings} more recordings to unlock
                    </Text>
                  </View>
                )}
              </View>
            )}

            {/* Progress to next badge */}
            {nextBadge && (
              <View style={styles.progressSection}>
                <Text style={styles.sectionTitle}>Progress to {nextBadge.name}</Text>
                <View style={styles.progressBar}>
                  <Animated.View
                    style={[
                      styles.progressFill,
                      {
                        width: `${progress.percentage}%`,
                        backgroundColor: nextBadge.color,
                      },
                    ]}
                  />
                </View>
                <Text style={styles.progressText}>
                  {progress.current} / {progress.target} ({progress.percentage}%)
                </Text>
              </View>
            )}

            {/* Badge collection grid */}
            <View style={styles.collectionSection}>
              <Text style={styles.sectionTitle}>
                Your Collection ({earnedBadges.length}/{ALL_BADGES.length})
              </Text>
              <View style={styles.badgeGrid}>
                {ALL_BADGES.map((badge) => {
                  const isEarned = earnedBadgeIds.has(badge.id);
                  const isSelected = selectedBadge?.id === badge.id;

                  return (
                    <Pressable
                      key={badge.id}
                      style={[
                        styles.badgeGridItem,
                        isSelected && styles.badgeGridItemSelected,
                        !isEarned && styles.badgeGridItemLocked,
                      ]}
                      onPress={() => handleBadgePress(badge)}
                    >
                      <View style={!isEarned ? styles.lockedOverlay : undefined}>
                        <BadgeIcon
                          badge={badge}
                          size="small"
                          showGlow={isEarned}
                          animated={false}
                        />
                      </View>
                      {!isEarned && (
                        <View style={styles.lockIcon}>
                          <Text style={styles.lockEmoji}>🔒</Text>
                        </View>
                      )}
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </ScrollView>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  sheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    maxHeight: '85%',
  },
  handleContainer: {
    alignItems: 'center',
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.md,
  },
  handle: {
    width: 36,
    height: 4,
    backgroundColor: Colors.surfaceHighlight,
    borderRadius: 2,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xl + 34, // Extra padding for home indicator
  },
  selectedBadgeSection: {
    alignItems: 'center',
    paddingVertical: Spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.surfaceHighlight,
    marginBottom: Spacing.lg,
  },
  selectedBadgeName: {
    fontSize: Typography.title,
    fontWeight: '700',
    color: Colors.text,
    marginTop: Spacing.md,
  },
  selectedBadgeDescription: {
    fontSize: Typography.body,
    color: Colors.textMuted,
    textAlign: 'center',
    marginTop: Spacing.xs,
  },
  earnedDate: {
    fontSize: Typography.caption,
    color: Colors.success,
    marginTop: Spacing.sm,
  },
  lockedBadge: {
    marginTop: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    backgroundColor: Colors.warningMuted,
    borderRadius: Radius.sm,
  },
  lockedText: {
    fontSize: Typography.caption,
    color: Colors.warning,
    fontWeight: '500',
  },
  progressSection: {
    marginBottom: Spacing.lg,
  },
  sectionTitle: {
    fontSize: Typography.bodyLarge,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: Spacing.md,
  },
  progressBar: {
    height: 8,
    backgroundColor: Colors.surfaceHighlight,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressText: {
    fontSize: Typography.caption,
    color: Colors.textMuted,
    marginTop: Spacing.xs,
    textAlign: 'right',
  },
  collectionSection: {
    marginBottom: Spacing.lg,
  },
  badgeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -Spacing.xs,
  },
  badgeGridItem: {
    width: BADGE_GRID_SIZE,
    height: BADGE_GRID_SIZE,
    margin: Spacing.xs,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.md,
    backgroundColor: Colors.background,
  },
  badgeGridItemSelected: {
    borderWidth: 2,
    borderColor: Colors.primary,
  },
  badgeGridItemLocked: {
    opacity: 0.5,
  },
  lockedOverlay: {
    opacity: 0.4,
  },
  lockIcon: {
    position: 'absolute',
    bottom: 2,
    right: 2,
  },
  lockEmoji: {
    fontSize: 10,
  },
});
