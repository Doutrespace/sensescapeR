import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View, ScrollView, TouchableOpacity, Alert, Modal, Switch, Image } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { Colors, Spacing, Radius, Shadows } from '../../src/theme/colors';
import { useLibraryStore } from '../../src/stores/useLibraryStore';
import { useSyncStore } from '../../src/stores/useSyncStore';
import { useAuthStore } from '../../src/stores/useAuthStore';
import { useActivityStore } from '../../src/stores/useActivityStore';
import { usePreferencesStore } from '../../src/stores/usePreferencesStore';
import { useBadgeStore } from '../../src/stores/useBadgeStore';
import { AuthForm } from '../../src/components/auth/AuthForm';
import { ProfileBadge } from '../../src/components/badges';
import { ActivityHistorySheet } from '../../src/components/profile/ActivityHistorySheet';
import { ResearchProfileFields } from '../../src/components/profile/ResearchProfileFields';
import LicenseSelector from '../../src/components/upload/LicenseSelector';
import PrivacyModeSelector from '../../src/components/upload/PrivacyModeSelector';
import type { CommunityVisibility } from '../../src/types/recording';
import type { ResearchProfile } from '../../src/types/researchProfile';
import {
  hasResearchProfileData,
  normalizeResearchProfile,
} from '../../src/types/researchProfile';
import { getRecordingsWithPerceptions } from '../../src/services/database/recordings';
import { ExportService, type ExportFormat } from '../../src/services/export';
import {
  cleanupExpiredLocalRecordingData,
  clearLocalRecordingData,
  formatStorageSize,
  getLocalStorageUsage,
  type LocalStorageUsage,
} from '../../src/services/storage/localStorage';
import { forceSyncNow } from '../../src/services/sync/syncManager';
import { t, tPlural, getLocaleTag } from '../../src/i18n';
import { LanguageToggle } from '../../src/components/ui/LanguageToggle';

export default function ProfileScreen() {
  const { totalCount, uploadedCount, pendingCount, loadRecordings } = useLibraryStore();
  const { isOnline, totalUploaded, totalFailed, queue, isUploading, clearQueue, syncHistory } = useSyncStore();
  const { user, session, signOut, initialize, isConfigured, statusMessage, updateProfileMetadata } = useAuthStore();
  const {
    autoUploadWifiOnly,
    defaultPrivacyMode,
    defaultLicense,
    defaultCommunityVisibility,
    autoCleanupRetentionDays,
    autoCleanupUploadedOnly,
    profileAvatarMode,
    profileAvatarEmoji,
    profileAvatarImageUri,
    setAutoUploadWifiOnly,
    setDefaultPrivacyMode,
    setDefaultLicense,
    setDefaultCommunityVisibility,
    setAutoCleanupRetentionDays,
    setAutoCleanupUploadedOnly,
    setProfileAvatarEmoji,
    setProfileAvatarImageUri,
    clearProfileAvatar,
  } = usePreferencesStore();
  const { exportHistory, setLastExport } = useActivityStore();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [showLicenseModal, setShowLicenseModal] = useState(false);
  const [showAvatarModal, setShowAvatarModal] = useState(false);
  const [showResearchProfileModal, setShowResearchProfileModal] = useState(false);
  const [showActivityHistory, setShowActivityHistory] = useState(false);
  const [storageUsage, setStorageUsage] = useState<LocalStorageUsage | null>(null);
  const [isLoadingStorage, setIsLoadingStorage] = useState(true);
  const [isClearingStorage, setIsClearingStorage] = useState(false);
  const [isRunningRetentionCleanup, setIsRunningRetentionCleanup] = useState(false);
  const [activeExportFormat, setActiveExportFormat] = useState<ExportFormat | null>(null);
  const [draftResearchProfile, setDraftResearchProfile] = useState<ResearchProfile>({});
  const isSignedIn = !!session;
  const remoteAvatarEmoji = typeof user?.user_metadata?.avatar_emoji === 'string'
    ? user.user_metadata.avatar_emoji
    : null;
  const effectiveAvatarMode = profileAvatarMode === 'default'
    ? (remoteAvatarEmoji ? 'emoji' : 'default')
    : profileAvatarMode;
  const effectiveAvatarEmoji = profileAvatarEmoji ?? remoteAvatarEmoji;
  const researchProfile = useMemo(
    () => normalizeResearchProfile(user?.user_metadata?.research_profile),
    [user?.user_metadata?.research_profile]
  );
  const researchProfileSummary = useMemo(() => {
    const parts = [
      researchProfile.ageRange,
      researchProfile.gender,
      researchProfile.livingArea,
      researchProfile.occupation,
    ].filter(Boolean);
    return parts.length > 0 ? parts.join(' · ') : t('Optional demographic context for soundscape research');
  }, [researchProfile]);
  const emojiAvatarOptions = ['🌿', '🌍', '🎧', '🌧️', '🕊️', '🌳', '🏙️', '🌊', '🎙️', '🚶'];

  const loadStorageUsage = useCallback(async () => {
    setIsLoadingStorage(true);
    try {
      const usage = await getLocalStorageUsage();
      setStorageUsage(usage);
    } catch (error) {
      Alert.alert(
        t('Storage unavailable'),
        error instanceof Error ? error.message : t('Unable to inspect local storage.')
      );
    } finally {
      setIsLoadingStorage(false);
    }
  }, []);

  useEffect(() => {
    loadRecordings('page');
    initialize();
    loadStorageUsage();
  }, [initialize, loadRecordings, loadStorageUsage]);

  const stats = [
    {
      icon: 'mic' as const,
      label: 'Total Recordings',
      value: totalCount,
      color: Colors.text,
    },
    {
      icon: 'cloud-done' as const,
      label: 'Uploaded',
      value: uploadedCount,
      color: Colors.success,
    },
    {
      icon: 'schedule' as const,
      label: 'Pending',
      value: pendingCount,
      color: Colors.secondary,
    },
    {
      icon: 'cloud-upload' as const,
      label: 'In Queue',
      value: queue.length,
      color: Colors.warning,
    },
  ];

  const getPrivacyLabel = (value: typeof defaultPrivacyMode) => {
    switch (value) {
      case 'hidden':
        return 'Hidden';
      case 'fuzzed':
        return 'Approximate';
      default:
        return 'Exact location';
    }
  };

  const getLicenseLabel = (value: typeof defaultLicense) => {
    switch (value) {
      case 'CC-BY-NC':
        return 'CC BY-NC';
      case 'CC0':
        return 'CC0';
      default:
        return 'CC BY';
    }
  };

  const getCommunityVisibilityLabel = (value: CommunityVisibility) => {
    return value === 'community' ? t('Community by default') : t('Private by default');
  };

  const getRetentionLabel = (value: number | null) => {
    if (value === null) {
      return t('Disabled');
    }

    return t('{count} days', { count: value });
  };

  const handleSignOut = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(
      t('Sign Out'),
      t('Are you sure you want to sign out?'),
      [
        { text: t('Cancel'), style: 'cancel' },
        {
          text: t('Sign Out'),
          style: 'destructive',
          onPress: async () => {
            await signOut();
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          },
        },
      ]
    );
  };

  const handleSignIn = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setShowAuthModal(true);
  };

  const handlePickAvatarImage = useCallback(async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(t('Permission needed'), t('Allow photo access to choose a profile picture.'));
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });

    if (result.canceled || !result.assets[0]?.uri) {
      return;
    }

    await setProfileAvatarImageUri(result.assets[0].uri);
    setShowAvatarModal(false);
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [setProfileAvatarImageUri]);

  const handleSelectAvatarEmoji = useCallback(async (emoji: string) => {
    await setProfileAvatarEmoji(emoji);

    if (isSignedIn) {
      const { error } = await updateProfileMetadata({ avatar_emoji: emoji });
      if (error) {
        Alert.alert(t('Profile updated locally'), t('The emoji avatar was saved on this device, but could not be synced to your account.'));
      }
    }

    setShowAvatarModal(false);
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [isSignedIn, setProfileAvatarEmoji, updateProfileMetadata]);

  const handleClearAvatar = useCallback(async () => {
    await clearProfileAvatar();

    if (isSignedIn) {
      const { error } = await updateProfileMetadata({ avatar_emoji: null });
      if (error) {
        Alert.alert(t('Avatar reset locally'), t('The default avatar was restored on this device, but account sync failed.'));
      }
    }

    setShowAvatarModal(false);
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [clearProfileAvatar, isSignedIn, updateProfileMetadata]);

  const handleOpenResearchProfile = useCallback(() => {
    if (!isSignedIn) {
      Alert.alert(
        t('Sign in required'),
        t('Create or sign in to an account before saving optional research profile details securely.')
      );
      setShowAuthModal(true);
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setDraftResearchProfile(researchProfile);
    setShowResearchProfileModal(true);
  }, [isSignedIn, researchProfile]);

  const handleSaveResearchProfile = useCallback(async () => {
    const { error } = await updateProfileMetadata({
      research_profile: draftResearchProfile,
    });

    if (error) {
      Alert.alert(
        t('Profile update failed'),
        error.message || 'The research profile could not be saved right now.'
      );
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    setShowResearchProfileModal(false);
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [draftResearchProfile, updateProfileMetadata]);

  const handleClearStorage = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    if (isUploading) {
      Alert.alert(
        t('Sync in progress'),
        t('Wait until the current upload finishes before clearing local data.')
      );
      return;
    }

    Alert.alert(
      t('Clear local recordings?'),
      t('This removes all recordings, photos, spectrograms, and queued uploads from this device. Uploaded Supabase copies are not deleted.'),
      [
        { text: t('Cancel'), style: 'cancel' },
        {
          text: t('Clear'),
          style: 'destructive',
          onPress: async () => {
            setIsClearingStorage(true);
            try {
              const result = await clearLocalRecordingData();
              clearQueue();
              await loadRecordings('page');
              await loadStorageUsage();
              await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              Alert.alert(
                t('Local data cleared'),
                t('Recordings removed: {recordings}. Files removed: {files}.\n\nFreed {size}.', { recordings: result.deletedRecordings, files: result.deletedFiles, size: formatStorageSize(result.freedBytes) })
              );
            } catch (error) {
              Alert.alert(
                t('Clear failed'),
                error instanceof Error ? error.message : t('Unable to clear local data.')
              );
            } finally {
              setIsClearingStorage(false);
            }
          },
        },
      ]
    );
  }, [clearQueue, isUploading, loadRecordings, loadStorageUsage]);

  const handleAutoCleanupRetention = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Alert.alert(
      t('Auto cleanup retention'),
      t('Choose how long local recordings should remain on device before automatic cleanup runs on startup.'),
      [
        { text: t('30 days'), onPress: () => void setAutoCleanupRetentionDays(30) },
        { text: t('90 days'), onPress: () => void setAutoCleanupRetentionDays(90) },
        { text: t('180 days'), onPress: () => void setAutoCleanupRetentionDays(180) },
        { text: t('Never'), onPress: () => void setAutoCleanupRetentionDays(null) },
        { text: t('Cancel'), style: 'cancel' },
      ]
    );
  }, [setAutoCleanupRetentionDays]);

  const handleDefaultCommunityVisibility = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Alert.alert(
      t('Default sharing'),
      t('Choose whether new recordings start as community-shared or private by default.'),
      [
        { text: t('Community'), onPress: () => void setDefaultCommunityVisibility('community') },
        { text: t('Private'), onPress: () => void setDefaultCommunityVisibility('private') },
        { text: t('Cancel'), style: 'cancel' },
      ]
    );
  }, [setDefaultCommunityVisibility]);

  const handleRunRetentionCleanup = useCallback(async () => {
    if (autoCleanupRetentionDays === null) {
      Alert.alert(
        t('Auto cleanup disabled'),
        t('Choose a retention period first to remove expired local recordings.')
      );
      return;
    }

    if (isUploading) {
      Alert.alert(
        t('Sync in progress'),
        t('Wait until the current upload finishes before removing expired local recordings.')
      );
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsRunningRetentionCleanup(true);

    try {
      const result = await cleanupExpiredLocalRecordingData({
        retentionDays: autoCleanupRetentionDays,
        uploadedOnly: autoCleanupUploadedOnly,
      });
      clearQueue();
      await loadRecordings('page');
      await loadStorageUsage();
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(
        t('Cleanup complete'),
        result.deletedRecordings > 0
          ? t('Recordings removed: {recordings}. Files removed: {files}.\n\nFreed {size}.', { recordings: result.deletedRecordings, files: result.deletedFiles, size: formatStorageSize(result.freedBytes) })
          : t('No local recordings matched the current retention rule.')
      );
    } catch (error) {
      Alert.alert(
        t('Cleanup failed'),
        error instanceof Error ? error.message : t('Unable to remove expired local recordings.')
      );
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsRunningRetentionCleanup(false);
    }
  }, [
    autoCleanupRetentionDays,
    autoCleanupUploadedOnly,
    clearQueue,
    isUploading,
    loadRecordings,
    loadStorageUsage,
  ]);

  const handleExportAll = useCallback(async (format: Extract<ExportFormat, 'json' | 'csv' | 'geojson' | 'soundscapy'>) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setActiveExportFormat(format);

    try {
      const recordings = await getRecordingsWithPerceptions();
      if (recordings.length === 0) {
        Alert.alert(t('Nothing to export'), t('Create at least one recording before exporting data.'));
        return;
      }

      const result = format === 'json'
        ? await ExportService.exportAsJSON(recordings)
        : format === 'csv'
          ? await ExportService.exportAsCSV(recordings)
          : format === 'geojson'
            ? await ExportService.exportAsGeoJSON(recordings)
            : await ExportService.exportAsSoundscapyCSV(recordings);

      if (!result.success) {
        setLastExport({
          format,
          message: result.error ?? t('The dataset export could not be completed.'),
          status: 'error',
        });
        Alert.alert(t('Export failed'), result.error ?? t('Unable to export recordings.'));
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        return;
      }

      setLastExport({
        format,
        message: t('A {format} dataset export was prepared from Profile.', { format: format.toUpperCase() }),
        status: 'success',
      });
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      setLastExport({
        format,
        message: error instanceof Error ? error.message : t('The dataset export could not be completed.'),
        status: 'error',
      });
      Alert.alert(
        t('Export failed'),
        error instanceof Error ? error.message : t('Unable to export recordings.')
      );
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setActiveExportFormat(null);
    }
  }, [setLastExport]);

  const getActivityTone = (status: 'info' | 'success' | 'warning' | 'error') => {
    switch (status) {
      case 'success':
        return {
          bg: Colors.successMuted,
          icon: Colors.success,
        };
      case 'warning':
        return {
          bg: Colors.warningMuted,
          icon: Colors.warning,
        };
      case 'error':
        return {
          bg: Colors.errorMuted,
          icon: Colors.error,
        };
      default:
        return {
          bg: Colors.primaryMuted,
          icon: Colors.primary,
        };
    }
  };

  const activityPreview = useMemo(() => {
    const syncEntries = syncHistory.map((item) => ({
      ...item,
      id: `sync-${item.at}-${item.message}`,
      type: 'sync' as const,
      icon: 'cloud-sync' as const,
      title: 'Sync',
    }));

    const exportEntries = exportHistory.map((item) => ({
      ...item,
      id: `export-${item.at}-${item.format}`,
      type: 'export' as const,
      icon: 'ios-share' as const,
      title: 'Export',
    }));

    return [...syncEntries, ...exportEntries]
      .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
      .slice(0, 4);
  }, [exportHistory, syncHistory]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <ActivityHistorySheet
        exportHistory={exportHistory}
        syncHistory={syncHistory}
        visible={showActivityHistory}
        onClose={() => setShowActivityHistory(false)}
      />

      {/* Auth Modal */}
      <Modal
        visible={showAuthModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowAuthModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowAuthModal(false)}>
              <MaterialIcons name="close" size={24} color={Colors.text} />
            </TouchableOpacity>
          </View>
          <AuthForm onSuccess={() => setShowAuthModal(false)} />
        </View>
      </Modal>

      <Modal
        visible={showPrivacyModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowPrivacyModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeaderRow}>
            <Text style={styles.modalTitle}>{t('Default Privacy')}</Text>
            <TouchableOpacity onPress={() => setShowPrivacyModal(false)}>
              <MaterialIcons name="close" size={24} color={Colors.text} />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.preferenceModalContent}>
            <PrivacyModeSelector
              value={defaultPrivacyMode}
              onChange={(value) => {
                void setDefaultPrivacyMode(value);
                Haptics.selectionAsync();
              }}
            />
          </ScrollView>
        </View>
      </Modal>

      <Modal
        visible={showLicenseModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowLicenseModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeaderRow}>
            <Text style={styles.modalTitle}>{t('Default License')}</Text>
            <TouchableOpacity onPress={() => setShowLicenseModal(false)}>
              <MaterialIcons name="close" size={24} color={Colors.text} />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.preferenceModalContent}>
            <LicenseSelector
              value={defaultLicense}
              onChange={(value) => {
                void setDefaultLicense(value);
                Haptics.selectionAsync();
              }}
            />
          </ScrollView>
        </View>
      </Modal>

      <Modal
        visible={showAvatarModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowAvatarModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeaderRow}>
            <Text style={styles.modalTitle}>{t('Profile Picture')}</Text>
            <TouchableOpacity onPress={() => setShowAvatarModal(false)}>
              <MaterialIcons name="close" size={24} color={Colors.text} />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.preferenceModalContent}>
            <TouchableOpacity style={styles.avatarActionCard} onPress={() => void handlePickAvatarImage()}>
              <MaterialIcons name="photo-camera" size={22} color={Colors.primary} />
              <View style={styles.avatarActionContent}>
                <Text style={styles.avatarActionTitle}>{t('Choose Photo')}</Text>
                <Text style={styles.avatarActionText}>{t('Pick a profile image from your photo library.')}</Text>
              </View>
            </TouchableOpacity>

            <View style={styles.avatarEmojiSection}>
              <Text style={styles.avatarSectionTitle}>{t('Or choose an emoji')}</Text>
              <View style={styles.avatarEmojiGrid}>
                {emojiAvatarOptions.map((emoji) => (
                  <TouchableOpacity
                    key={emoji}
                    style={[
                      styles.avatarEmojiButton,
                      effectiveAvatarMode === 'emoji' && effectiveAvatarEmoji === emoji && styles.avatarEmojiButtonActive,
                    ]}
                    onPress={() => void handleSelectAvatarEmoji(emoji)}
                    accessibilityRole="button"
                    accessibilityLabel={`Use ${emoji} as profile picture`}
                  >
                    <Text style={styles.avatarEmojiText}>{emoji}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <TouchableOpacity style={styles.avatarResetButton} onPress={() => void handleClearAvatar()}>
              <MaterialIcons name="refresh" size={18} color={Colors.textMuted} />
              <Text style={styles.avatarResetText}>{t('Use default avatar')}</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>

      <Modal
        visible={showResearchProfileModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowResearchProfileModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeaderRow}>
            <Text style={styles.modalTitle}>{t('Research Profile')}</Text>
            <TouchableOpacity onPress={() => setShowResearchProfileModal(false)}>
              <MaterialIcons name="close" size={24} color={Colors.text} />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.preferenceModalContent}>
            <ResearchProfileFields
              value={draftResearchProfile}
              onChange={setDraftResearchProfile}
            />

            <TouchableOpacity
              style={styles.profileSaveButton}
              onPress={() => void handleSaveResearchProfile()}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel={t('Save research profile')}
              accessibilityHint={t('Save optional demographic details securely to your account')}
            >
              <Text style={styles.profileSaveButtonText}>{t('Save Research Profile')}</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>

      {/* Header */}
      <View style={styles.header}>
        <ProfileBadge size="large">
          <TouchableOpacity
            style={styles.avatar}
            onPress={() => setShowAvatarModal(true)}
            accessibilityRole="button"
            accessibilityLabel={t('Change profile picture')}
            accessibilityHint={t('Choose a profile photo or emoji')}
          >
            {effectiveAvatarMode === 'image' && profileAvatarImageUri ? (
              <Image source={{ uri: profileAvatarImageUri }} style={styles.avatarImage} />
            ) : effectiveAvatarMode === 'emoji' && effectiveAvatarEmoji ? (
              <Text style={styles.avatarEmojiDisplay}>{effectiveAvatarEmoji}</Text>
            ) : (
              <MaterialIcons name={isSignedIn ? 'person' : 'person-outline'} size={48} color={isSignedIn ? Colors.primary : Colors.textMuted} />
            )}
            <View style={styles.avatarEditBadge}>
              <MaterialIcons name="edit" size={14} color={Colors.background} />
            </View>
          </TouchableOpacity>
        </ProfileBadge>
        <Text style={styles.title}>
          {isSignedIn ? user?.email?.split('@')[0] : t('Soundscape Explorer')}
        </Text>
        {isSignedIn && user && (
          <Text style={styles.emailText}>{user.email}</Text>
        )}
        {!isSignedIn && statusMessage && (
          <Text style={styles.pendingAuthText}>{statusMessage}</Text>
        )}
        <View style={[styles.statusBadge, isOnline ? styles.statusOnline : styles.statusOffline]}>
          <View
            style={[
              styles.statusDot,
              { backgroundColor: isOnline ? Colors.success : Colors.error },
            ]}
          />
          <Text style={styles.statusText}>
            {isOnline ? t('Online') : t('Offline')}
          </Text>
        </View>

        {/* Auth Button */}
        {isConfigured && (
          <TouchableOpacity
            style={[styles.authButton, isSignedIn && styles.authButtonSignOut]}
            onPress={isSignedIn ? handleSignOut : handleSignIn}
            activeOpacity={0.8}
          >
            <MaterialIcons
              name={isSignedIn ? 'logout' : 'login'}
              size={18}
              color={isSignedIn ? Colors.error : Colors.background}
            />
            <Text style={[styles.authButtonText, isSignedIn && styles.authButtonTextSignOut]}>
              {isSignedIn ? t('Sign Out') : t('Sign In')}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Stats grid */}
      <View style={styles.statsGrid}>
        {stats.map((stat, index) => (
          <View key={index} style={styles.statCard}>
            <MaterialIcons name={stat.icon} size={24} color={stat.color} />
            <Text style={[styles.statValue, { color: stat.color }]}>
              {stat.value}
            </Text>
            <Text style={styles.statLabel}>{t(stat.label)}</Text>
          </View>
        ))}
      </View>

      {/* Contribution summary */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('Your Contributions')}</Text>
        <View style={styles.contributionCard}>
          <View style={styles.contributionRow}>
            <MaterialIcons name="check-circle" size={20} color={Colors.success} />
            <Text style={styles.contributionText}>
              {tPlural(totalUploaded, '{count} recording shared with the community', '{count} recordings shared with the community')}
            </Text>
          </View>
          {totalFailed > 0 && (
            <View style={styles.contributionRow}>
              <MaterialIcons name="error" size={20} color={Colors.error} />
              <Text style={styles.contributionText}>
                {tPlural(totalFailed, '{count} upload failed (will retry automatically)', '{count} uploads failed (will retry automatically)')}
              </Text>
            </View>
          )}
          {totalCount === 0 && (
            <View style={styles.contributionRow}>
              <MaterialIcons name="mic" size={20} color={Colors.primary} />
              <Text style={styles.contributionText}>
                {t('Start recording to contribute to soundscape research!')}
              </Text>
            </View>
          )}
        </View>
      </View>

      {activityPreview.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('Recent Activity')}</Text>
          <View style={styles.activityCard}>
            {activityPreview.map((activity) => (
              <View key={activity.id} style={styles.activityRow}>
                <View
                  style={[
                    styles.activityIconWrap,
                    { backgroundColor: getActivityTone(activity.status).bg },
                  ]}
                >
                  <MaterialIcons
                    name={activity.icon}
                    size={18}
                    color={getActivityTone(activity.status).icon}
                  />
                </View>
                <View style={styles.activityContent}>
                  <Text style={styles.activityTitle}>
                    {t(activity.title)}
                    {activity.type === 'export' && ' '}
                    {activity.type === 'export' ? `(${activity.format.toUpperCase()})` : ''}
                  </Text>
                  <Text style={styles.activityMessage}>{activity.message}</Text>
                  <Text style={styles.activityTime}>{new Date(activity.at).toLocaleString(getLocaleTag())}</Text>
                </View>
              </View>
            ))}

            {(syncHistory.length > 1 || exportHistory.length > 1) && (
              <TouchableOpacity
                style={styles.historyButton}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setShowActivityHistory(true);
                }}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel={t('View full activity history')}
                accessibilityHint={t('Open the full sync and export activity history')}
              >
                <Text style={styles.historyButtonText}>{t('View full history')}</Text>
                <MaterialIcons name="chevron-right" size={18} color={Colors.primary} />
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('Export')}</Text>
        <View style={styles.exportCard}>
          <Text style={styles.exportIntro}>
            {t('Export your full local dataset for analysis or mapping.')}
          </Text>
          <View style={styles.exportActions}>
            {[
              { key: 'json', label: 'JSON', icon: 'code' as const },
              { key: 'csv', label: 'CSV', icon: 'table-chart' as const },
              { key: 'geojson', label: 'GeoJSON', icon: 'map' as const },
              { key: 'soundscapy', label: 'Soundscapy', icon: 'science' as const },
            ].map((option) => {
              const isActive = activeExportFormat === option.key;
              return (
                <TouchableOpacity
                  key={option.key}
                  style={[styles.exportActionButton, isActive && styles.exportActionButtonDisabled]}
                  onPress={() => void handleExportAll(option.key as 'json' | 'csv' | 'geojson' | 'soundscapy')}
                  disabled={activeExportFormat !== null}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityLabel={t('Export all recordings as {format}', { format: option.label })}
                  accessibilityHint={t('Prepare a bulk export of all local recordings')}
                  accessibilityState={{ disabled: activeExportFormat !== null }}
                >
                  {isActive ? (
                    <ActivityIndicator size="small" color={Colors.primary} />
                  ) : (
                    <MaterialIcons name={option.icon} size={18} color={Colors.primary} />
                  )}
                  <Text style={styles.exportActionText}>{t(option.label)}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <Text style={styles.exportFootnote}>
            {t('JSON preserves the full payload, CSV works for spreadsheets, GeoJSON opens in GIS tools, and Soundscapy CSV mirrors research-focused field names.')}
          </Text>
        </View>
      </View>

      {/* Settings */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('Settings')}</Text>

        <TouchableOpacity
          style={styles.settingItem}
          activeOpacity={0.9}
        >
          <MaterialIcons name="cloud-upload" size={24} color={Colors.text} />
          <View style={styles.settingContent}>
            <Text style={styles.settingLabel}>{t('Auto-upload')}</Text>
            <Text style={styles.settingDescription}>
              {autoUploadWifiOnly
                ? t('Only sync queued recordings on Wi-Fi')
                : t('Allow queued recordings to sync on any connection')}
            </Text>
          </View>
          <Switch
            value={autoUploadWifiOnly}
            onValueChange={(value) => {
              void (async () => {
                await setAutoUploadWifiOnly(value);
                await Haptics.selectionAsync();

                if (!value) {
                  await forceSyncNow();
                }
              })();
            }}
            trackColor={{ false: Colors.surfaceHighlight, true: Colors.successMuted }}
            thumbColor={autoUploadWifiOnly ? Colors.success : Colors.surface}
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.settingItem}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setShowPrivacyModal(true);
          }}
          activeOpacity={0.7}
        >
          <MaterialIcons name="shield" size={24} color={Colors.text} />
          <View style={styles.settingContent}>
            <Text style={styles.settingLabel}>{t('Default privacy')}</Text>
            <Text style={styles.settingDescription}>
              {getPrivacyLabel(defaultPrivacyMode)}
            </Text>
          </View>
          <MaterialIcons name="chevron-right" size={24} color={Colors.textMuted} />
        </TouchableOpacity>

        <View style={styles.settingItem}>
          <MaterialIcons name="language" size={24} color={Colors.text} />
          <View style={styles.settingContent}>
            <Text style={styles.settingLabel}>{t('Language')}</Text>
            <Text style={styles.settingDescription}>{t('Language of the app')}</Text>
          </View>
          <LanguageToggle />
        </View>

        <TouchableOpacity
          style={styles.settingItem}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setShowLicenseModal(true);
          }}
          activeOpacity={0.7}
        >
          <MaterialIcons name="balance" size={24} color={Colors.text} />
          <View style={styles.settingContent}>
            <Text style={styles.settingLabel}>{t('Default license')}</Text>
            <Text style={styles.settingDescription}>
              {getLicenseLabel(defaultLicense)}
            </Text>
          </View>
          <MaterialIcons name="chevron-right" size={24} color={Colors.textMuted} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.settingItem}
          onPress={handleOpenResearchProfile}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={t('Research profile')}
          accessibilityHint={t('Set optional demographic details for soundscape research')}
        >
          <MaterialIcons
            name={hasResearchProfileData(researchProfile) ? 'badge' : 'fact-check'}
            size={24}
            color={Colors.text}
          />
          <View style={styles.settingContent}>
            <Text style={styles.settingLabel}>{t('Research profile')}</Text>
            <Text style={styles.settingDescription}>
              {researchProfileSummary}
            </Text>
          </View>
          <MaterialIcons name="chevron-right" size={24} color={Colors.textMuted} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.settingItem}
          onPress={handleDefaultCommunityVisibility}
          activeOpacity={0.7}
        >
          <MaterialIcons
            name={defaultCommunityVisibility === 'community' ? 'public' : 'lock'}
            size={24}
            color={Colors.text}
          />
          <View style={styles.settingContent}>
            <Text style={styles.settingLabel}>{t('Default sharing')}</Text>
            <Text style={styles.settingDescription}>
              {getCommunityVisibilityLabel(defaultCommunityVisibility)}
            </Text>
          </View>
          <MaterialIcons name="chevron-right" size={24} color={Colors.textMuted} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.settingItem}
          onPress={loadStorageUsage}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={t('Refresh storage usage')}
          accessibilityHint={t('Inspect the space used by local recordings and cached media')}
        >
          <MaterialIcons name="storage" size={24} color={Colors.text} />
          <View style={styles.settingContent}>
            <Text style={styles.settingLabel}>{t('Storage')}</Text>
            <Text style={styles.settingDescription}>
              {isLoadingStorage
                ? t('Inspecting local recordings and cache...')
                : `${formatStorageSize(storageUsage?.totalBytes ?? 0)} on this device`}
            </Text>
          </View>
          {isLoadingStorage ? (
            <ActivityIndicator size="small" color={Colors.textMuted} />
          ) : (
            <MaterialIcons name="refresh" size={20} color={Colors.textMuted} />
          )}
        </TouchableOpacity>

        <View style={styles.storageCard}>
          <View style={styles.storageSummaryRow}>
            <View style={styles.storageStat}>
              <Text style={styles.storageStatLabel}>{t('Audio')}</Text>
              <Text style={styles.storageStatValue}>
                {formatStorageSize(storageUsage?.audioBytes ?? 0)}
              </Text>
            </View>
            <View style={styles.storageStat}>
              <Text style={styles.storageStatLabel}>{t('Photos')}</Text>
              <Text style={styles.storageStatValue}>
                {formatStorageSize(storageUsage?.photoBytes ?? 0)}
              </Text>
            </View>
            <View style={styles.storageStat}>
              <Text style={styles.storageStatLabel}>{t('Spectrograms')}</Text>
              <Text style={styles.storageStatValue}>
                {formatStorageSize(storageUsage?.spectrogramBytes ?? 0)}
              </Text>
            </View>
          </View>

          <Text style={styles.storageFootnote}>
            {storageUsage?.recordingCount ?? 0} recording{storageUsage?.recordingCount === 1 ? '' : 's'} stored locally across {storageUsage?.fileCount ?? 0} media file{storageUsage?.fileCount === 1 ? '' : 's'}.
          </Text>

          <View style={styles.retentionPanel}>
            <TouchableOpacity
              style={styles.retentionRow}
              onPress={handleAutoCleanupRetention}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel={t('Automatic cleanup retention')}
              accessibilityHint={t('Choose how long local recordings remain on device before automatic cleanup')}
            >
              <View style={styles.retentionMeta}>
                <Text style={styles.retentionLabel}>{t('Automatic cleanup')}</Text>
                <Text style={styles.retentionDescription}>
                  {getRetentionLabel(autoCleanupRetentionDays)}
                </Text>
              </View>
              <MaterialIcons name="chevron-right" size={20} color={Colors.textMuted} />
            </TouchableOpacity>

            <View style={styles.retentionRow}>
              <View style={styles.retentionMeta}>
                <Text style={styles.retentionLabel}>{t('Uploaded only')}</Text>
                <Text style={styles.retentionDescription}>
                  {t('Keep unsynced recordings on device and prune only uploaded copies')}
                </Text>
              </View>
              <Switch
                value={autoCleanupUploadedOnly}
                onValueChange={(value) => void setAutoCleanupUploadedOnly(value)}
                trackColor={{ false: Colors.surfaceHighlight, true: Colors.primaryMuted }}
                thumbColor={autoCleanupUploadedOnly ? Colors.primary : Colors.surface}
                accessibilityLabel={t('Limit automatic cleanup to uploaded recordings')}
              />
            </View>

            <TouchableOpacity
              style={[
                styles.retentionRunButton,
                (isRunningRetentionCleanup || autoCleanupRetentionDays === null) && styles.retentionRunButtonDisabled,
              ]}
              onPress={() => void handleRunRetentionCleanup()}
              disabled={isRunningRetentionCleanup || autoCleanupRetentionDays === null}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel={t('Run retention cleanup now')}
              accessibilityHint={t('Remove local recordings that exceed the current retention rule')}
              accessibilityState={{ disabled: isRunningRetentionCleanup || autoCleanupRetentionDays === null }}
            >
              {isRunningRetentionCleanup ? (
                <ActivityIndicator size="small" color={Colors.text} />
              ) : (
                <MaterialIcons name="auto-delete" size={18} color={Colors.text} />
              )}
              <Text style={styles.retentionRunText}>
                {isRunningRetentionCleanup ? t('Cleaning...') : t('Run cleanup now')}
              </Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[styles.clearStorageButton, isClearingStorage && styles.clearStorageButtonDisabled]}
            onPress={handleClearStorage}
            disabled={isClearingStorage}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={t('Clear all local data')}
            accessibilityHint={t('Remove all recordings, photos, spectrograms, and queued uploads from this device')}
            accessibilityState={{ disabled: isClearingStorage }}
          >
            {isClearingStorage ? (
              <ActivityIndicator size="small" color={Colors.error} />
            ) : (
              <MaterialIcons name="delete-outline" size={18} color={Colors.error} />
            )}
            <Text style={styles.clearStorageText}>
              {isClearingStorage ? t('Clearing...') : t('Clear local data')}
            </Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.settingItem}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            Alert.alert(
              t('Notifications not implemented'),
              t('Background reminders and notification preferences are not wired yet.')
            );
          }}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={t('Notifications setting')}
          accessibilityHint={t('Notification preferences are not yet implemented')}
        >
          <MaterialIcons name="notifications" size={24} color={Colors.text} />
          <View style={styles.settingContent}>
            <Text style={styles.settingLabel}>{t('Notifications')}</Text>
            <Text style={styles.settingDescription}>
              {t('Recording reminders and upload status')}
            </Text>
          </View>
          <View style={styles.comingSoonBadge}>
            <Text style={styles.comingSoonText}>{t('Soon')}</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.settingItem}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            Alert.alert(
              t('About Soundscape Explorer'),
              t('Version 1.0.0\n\nAn ISO 12913-aligned soundscape perception capture app for acoustic research.\n\nBuilt with Expo and React Native.'),
              [{ text: t('OK') }]
            );
          }}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={t('About Soundscape Explorer')}
          accessibilityHint={t('Show app version and ISO 12913 information')}
        >
          <MaterialIcons name="info" size={24} color={Colors.text} />
          <View style={styles.settingContent}>
            <Text style={styles.settingLabel}>{t('About')}</Text>
            <Text style={styles.settingDescription}>
              {t('App version and ISO 12913 info')}
            </Text>
          </View>
          <MaterialIcons name="chevron-right" size={24} color={Colors.textMuted} />
        </TouchableOpacity>
      </View>

      {/* ISO 12913 info */}
      <View style={styles.infoBox}>
        <Text style={styles.infoTitle}>{t('About ISO 12913')}</Text>
        <Text style={styles.infoText}>
          {t('This app follows the ISO 12913 standard for soundscape research, capturing the core pleasant and eventful perceptual dimensions alongside recording, context, and location metadata for standardized soundscape assessment.')}
        </Text>
      </View>

      <Text style={styles.versionText}>{t('Version 1.0.0')}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    padding: Spacing.lg,
    paddingTop: 60,
    paddingBottom: Spacing.xxl,
  },
  header: {
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
    borderWidth: 2,
    borderColor: Colors.surfaceHighlight,
    overflow: 'hidden',
    position: 'relative',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarEmojiDisplay: {
    fontSize: 42,
  },
  avatarEditBadge: {
    position: 'absolute',
    right: 2,
    bottom: 2,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.background,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radius.full,
    gap: 6,
  },
  statusOnline: {
    backgroundColor: Colors.successMuted,
  },
  statusOffline: {
    backgroundColor: Colors.errorMuted,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 13,
    color: Colors.textMuted,
    fontWeight: '600',
  },
  avatarActionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.surfaceHighlight,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
  },
  avatarActionContent: {
    flex: 1,
  },
  avatarActionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 2,
  },
  avatarActionText: {
    fontSize: 13,
    lineHeight: 18,
    color: Colors.textMuted,
  },
  avatarEmojiSection: {
    marginBottom: Spacing.lg,
  },
  avatarSectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: Spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  avatarEmojiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  avatarEmojiButton: {
    width: 56,
    height: 56,
    borderRadius: Radius.md,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.surfaceHighlight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarEmojiButtonActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryMuted,
  },
  avatarEmojiText: {
    fontSize: 28,
  },
  avatarResetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: Radius.md,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.surfaceHighlight,
  },
  avatarResetText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textMuted,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: Spacing.xl,
  },
  statCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: Colors.surface,
    padding: Spacing.md,
    borderRadius: Radius.md,
    alignItems: 'center',
    gap: Spacing.sm,
  },
  statValue: {
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 4,
    fontVariant: ['tabular-nums'],
  },
  statLabel: {
    fontSize: 12,
    color: Colors.textMuted,
    textAlign: 'center',
  },
  section: {
    marginBottom: Spacing.xl,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: Spacing.md,
  },
  contributionCard: {
    backgroundColor: Colors.surface,
    padding: Spacing.md,
    borderRadius: Radius.md,
    gap: 12,
  },
  contributionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  contributionText: {
    flex: 1,
    fontSize: 14,
    color: Colors.text,
  },
  activityCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: Spacing.md,
    gap: Spacing.md,
  },
  activityRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
  },
  activityIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityContent: {
    flex: 1,
  },
  activityTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 2,
  },
  activityMessage: {
    fontSize: 13,
    lineHeight: 18,
    color: Colors.text,
  },
  activityTime: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 4,
  },
  historyButton: {
    minHeight: 40,
    borderRadius: Radius.full,
    backgroundColor: Colors.primaryMuted,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
  },
  historyButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.primary,
  },
  exportCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: Spacing.md,
    gap: Spacing.md,
  },
  exportIntro: {
    fontSize: 14,
    lineHeight: 20,
    color: Colors.text,
  },
  exportActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  exportActionButton: {
    // Two per row: four labels do not fit side by side on a phone-width screen.
    flexGrow: 1,
    flexBasis: '45%',
    minHeight: 44,
    borderRadius: Radius.full,
    backgroundColor: Colors.primaryMuted,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
  },
  exportActionButtonDisabled: {
    opacity: 0.6,
  },
  exportActionText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.primary,
  },
  exportFootnote: {
    fontSize: 12,
    lineHeight: 18,
    color: Colors.textMuted,
  },
  storageCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    gap: Spacing.md,
  },
  storageSummaryRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  storageStat: {
    flex: 1,
    backgroundColor: Colors.background,
    borderRadius: Radius.sm,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm,
  },
  storageStatLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  storageStatValue: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
  },
  storageFootnote: {
    fontSize: 13,
    lineHeight: 19,
    color: Colors.textMuted,
  },
  retentionPanel: {
    marginTop: Spacing.md,
    marginBottom: Spacing.md,
    borderRadius: Radius.md,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.surfaceHighlight,
    overflow: 'hidden',
  },
  retentionRow: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.surfaceHighlight,
    gap: Spacing.sm,
  },
  retentionMeta: {
    flex: 1,
  },
  retentionLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 2,
  },
  retentionDescription: {
    fontSize: 12,
    lineHeight: 18,
    color: Colors.textMuted,
  },
  retentionRunButton: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.primaryMuted,
  },
  retentionRunButtonDisabled: {
    opacity: 0.55,
  },
  retentionRunText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.text,
  },
  clearStorageButton: {
    alignSelf: 'flex-start',
    minHeight: 40,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.full,
    backgroundColor: Colors.errorMuted,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  clearStorageButtonDisabled: {
    opacity: 0.6,
  },
  clearStorageText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.error,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    padding: Spacing.md,
    borderRadius: Radius.md,
    marginBottom: Spacing.sm,
    gap: 14,
  },
  settingContent: {
    flex: 1,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 2,
  },
  settingDescription: {
    fontSize: 13,
    color: Colors.textMuted,
  },
  comingSoonBadge: {
    backgroundColor: Colors.warningMuted,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  comingSoonText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.warning,
    textTransform: 'uppercase',
  },
  infoBox: {
    backgroundColor: Colors.primaryMuted,
    padding: Spacing.md,
    borderRadius: Radius.md,
    borderLeftWidth: 4,
    borderLeftColor: Colors.primary,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.primary,
    marginBottom: Spacing.sm,
  },
  infoText: {
    fontSize: 14,
    color: Colors.text,
    lineHeight: 22,
  },
  versionText: {
    textAlign: 'center',
    color: Colors.textMuted,
    fontSize: 12,
    marginTop: Spacing.lg,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  modalHeader: {
    padding: Spacing.lg,
    paddingTop: 60,
    alignItems: 'flex-end',
  },
  modalHeaderRow: {
    paddingHorizontal: Spacing.lg,
    paddingTop: 60,
    paddingBottom: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.text,
  },
  preferenceModalContent: {
    paddingBottom: Spacing.xxl,
  },
  profileSaveButton: {
    marginTop: Spacing.xl,
    marginHorizontal: Spacing.lg,
    minHeight: 52,
    borderRadius: Radius.full,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.primary,
  },
  profileSaveButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.background,
  },
  emailText: {
    fontSize: 14,
    color: Colors.textMuted,
    marginBottom: Spacing.sm,
  },
  pendingAuthText: {
    fontSize: 13,
    color: Colors.textMuted,
    textAlign: 'center',
    marginBottom: Spacing.sm,
    paddingHorizontal: Spacing.lg,
  },
  authButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.full,
    marginTop: Spacing.md,
    gap: Spacing.xs,
  },
  authButtonSignOut: {
    backgroundColor: Colors.errorMuted,
  },
  authButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.background,
  },
  authButtonTextSignOut: {
    color: Colors.error,
  },
});
