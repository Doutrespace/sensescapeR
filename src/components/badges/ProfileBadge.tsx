/**
 * ProfileBadge - Wraps an avatar/profile image and shows the highest earned badge
 */
import React, { useState, useCallback } from 'react';
import { StyleSheet, View, Pressable } from 'react-native';
import * as Haptics from 'expo-haptics';
import { BadgeDefinition } from '../../badges/types';
import { useBadgeStore } from '../../stores/useBadgeStore';
import { BadgeIcon } from './BadgeIcon';
import { BadgeDetailModal } from './BadgeDetailModal';

interface ProfileBadgeProps {
  children: React.ReactNode;
  size?: 'small' | 'medium' | 'large';
  showModal?: boolean;
}

const BADGE_OFFSET = {
  small: { bottom: -4, right: -4, size: 'small' as const },
  medium: { bottom: -6, right: -6, size: 'small' as const },
  large: { bottom: -8, right: -8, size: 'medium' as const },
};

export function ProfileBadge({
  children,
  size = 'medium',
  showModal = true,
}: ProfileBadgeProps) {
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedBadge, setSelectedBadge] = useState<BadgeDefinition | null>(null);

  const highestBadge = useBadgeStore((state) => state.getHighestBadge());
  const earnedBadges = useBadgeStore((state) => state.earnedBadges);
  const totalRecordings = useBadgeStore((state) => state.totalRecordings);

  const offset = BADGE_OFFSET[size];

  const handleBadgePress = useCallback(() => {
    if (!showModal) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedBadge(highestBadge);
    setModalVisible(true);
  }, [showModal, highestBadge]);

  const handleCloseModal = useCallback(() => {
    setModalVisible(false);
  }, []);

  const handleBadgeSelect = useCallback((badge: BadgeDefinition) => {
    setSelectedBadge(badge);
  }, []);

  return (
    <>
      <View style={styles.container}>
        {children}
        {highestBadge && (
          <Pressable
            style={[
              styles.badgeOverlay,
              { bottom: offset.bottom, right: offset.right },
            ]}
            onPress={handleBadgePress}
          >
            <BadgeIcon
              badge={highestBadge}
              size={offset.size}
              showGlow
              animated={false}
            />
          </Pressable>
        )}
      </View>

      <BadgeDetailModal
        visible={modalVisible}
        selectedBadge={selectedBadge}
        earnedBadges={earnedBadges}
        totalRecordings={totalRecordings}
        onClose={handleCloseModal}
        onBadgeSelect={handleBadgeSelect}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  badgeOverlay: {
    position: 'absolute',
    zIndex: 10,
  },
});
