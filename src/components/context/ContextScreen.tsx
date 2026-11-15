import React, { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View, ScrollView, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, Spacing, Radius } from '../../theme/colors';
import { HabitatType, SettingContext, PrivacyMode, CommunityVisibility } from '../../types/recording';
import { usePreferencesStore } from '../../stores/usePreferencesStore';
import HabitatSelector from './HabitatSelector';
import SettingChips from './SettingChips';
import { t } from '../../i18n';

interface Props {
  habitatType: HabitatType | null;
  settingContext: SettingContext;
  privacyMode: PrivacyMode;
  communityVisibility: CommunityVisibility;
  locationError?: string | null;
  onHabitatChange: (value: HabitatType) => void;
  onSettingContextChange: (value: SettingContext) => void;
  onCommunityVisibilityChange: (value: CommunityVisibility) => void;
  onConfirm: () => void;
}

export default function ContextScreen({
  habitatType,
  settingContext,
  privacyMode,
  communityVisibility,
  locationError,
  onHabitatChange,
  onSettingContextChange,
  onCommunityVisibilityChange,
  onConfirm,
}: Props) {
  const { defaultCommunityVisibility, setDefaultCommunityVisibility } = usePreferencesStore();
  const [showVisibilitySheet, setShowVisibilitySheet] = useState(false);
  const [pendingVisibility, setPendingVisibility] = useState<CommunityVisibility>(communityVisibility);
  const [applyAsDefault, setApplyAsDefault] = useState(false);
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();

  useEffect(() => {
    setPendingVisibility(communityVisibility);
  }, [communityVisibility]);

  const footerBottomPadding = tabBarHeight + 16;

  const handleSavePress = () => {
    setPendingVisibility(communityVisibility);
    setApplyAsDefault(false);
    setShowVisibilitySheet(true);
  };

  const handleConfirmVisibility = () => {
    onCommunityVisibilityChange(pendingVisibility);
    if (applyAsDefault) {
      void setDefaultCommunityVisibility(pendingVisibility);
    }
    setShowVisibilitySheet(false);
    onConfirm();
  };

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        <Text style={styles.title}>{t('Measurement Context')}</Text>
        <Text style={styles.subtitle}>
          {t('Optional metadata about place and situation before you save the recording')}
        </Text>

        {locationError && (
          <View style={styles.locationWarning}>
            <MaterialIcons name="location-off" size={20} color={Colors.warning} />
            <View style={styles.locationWarningContent}>
              <Text style={styles.locationWarningTitle}>{t('Location unavailable')}</Text>
              <Text style={styles.locationWarningText}>{locationError}</Text>
            </View>
          </View>
        )}

        <View style={styles.profileDefaultsNote}>
          <MaterialIcons name="manage-accounts" size={18} color={Colors.textMuted} />
          <Text style={styles.profileDefaultsNoteText}>
            {t('License and location privacy use your current Profile defaults.')}
          </Text>
        </View>

        <View style={styles.sectionContent}>
          <HabitatSelector value={habitatType} onChange={onHabitatChange} />
          <View style={styles.sectionDivider} />
          <SettingChips value={settingContext} onChange={onSettingContextChange} />
        </View>
      </ScrollView>

      {/* Actions - Fixed at bottom */}
      <View style={[styles.actions, { paddingBottom: footerBottomPadding }]}>
        <TouchableOpacity
          style={styles.saveButton}
          onPress={handleSavePress}
          accessibilityRole="button"
          accessibilityLabel={t('Save recording')}
          accessibilityHint={t('Choose whether to keep the recording private or share it with the community before saving')}
        >
          <Text style={styles.saveButtonText}>
            {t('Save Recording')}
          </Text>
        </TouchableOpacity>
      </View>

      <Modal
        visible={showVisibilitySheet}
        transparent
        animationType="fade"
        onRequestClose={() => setShowVisibilitySheet(false)}
      >
        <Pressable
          style={styles.sheetBackdrop}
          onPress={() => setShowVisibilitySheet(false)}
          accessibilityRole="button"
          accessibilityLabel={t('Close sharing options')}
        />
        <View style={[styles.sheetContainer, { paddingBottom: Math.max(insets.bottom, 16) + 8 }]}>
          <View style={styles.sheetHandle} />
          <Text style={styles.sheetEyebrow}>{t('Sharing')}</Text>
          <Text style={styles.sheetTitle}>{t('How should this recording be saved?')}</Text>
          <Text style={styles.sheetText}>
            {t('Choose whether this recording stays in your private cloud archive or appears on the Explore map for the community.')}
          </Text>

          <View style={styles.currentDefaultRow}>
            <MaterialIcons name="history-toggle-off" size={16} color={Colors.textMuted} />
            <Text style={styles.currentDefaultText}>
              {t('Current default: {value}', { value: defaultCommunityVisibility === 'community' ? t('Community') : t('Private') })}
            </Text>
          </View>

          <View style={styles.sheetOptions}>
            <TouchableOpacity
              style={[
                styles.sheetOption,
                pendingVisibility === 'private' && styles.sheetOptionActive,
              ]}
              onPress={() => setPendingVisibility('private')}
              accessibilityRole="button"
              accessibilityState={{ selected: pendingVisibility === 'private' }}
              accessibilityLabel={t('Save as private recording')}
            >
              <MaterialIcons
                name="lock"
                size={20}
                color={pendingVisibility === 'private' ? Colors.primary : Colors.textMuted}
              />
              <View style={styles.sheetOptionContent}>
                <Text style={[
                  styles.sheetOptionTitle,
                  pendingVisibility === 'private' && styles.sheetOptionTitleActive,
                ]}>
                  {t('Private')}
                </Text>
                <Text style={styles.sheetOptionText}>
                  {t('Syncs to your own account archive, but stays off the Explore map unless you publish it later.')}
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.sheetOption,
                pendingVisibility === 'community' && styles.sheetOptionActive,
              ]}
              onPress={() => setPendingVisibility('community')}
              accessibilityRole="button"
              accessibilityState={{ selected: pendingVisibility === 'community' }}
              accessibilityLabel={t('Publish to the community')}
            >
              <MaterialIcons
                name="public"
                size={20}
                color={pendingVisibility === 'community' ? Colors.primary : Colors.textMuted}
              />
              <View style={styles.sheetOptionContent}>
                <Text style={[
                  styles.sheetOptionTitle,
                  pendingVisibility === 'community' && styles.sheetOptionTitleActive,
                ]}>
                  {t('Community')}
                </Text>
                <Text style={styles.sheetOptionText}>
                  {t('Shared to Explore after sync so others can discover it on the map.')}
                </Text>
              </View>
            </TouchableOpacity>
          </View>

          {pendingVisibility === 'community' && privacyMode === 'hidden' && (
            <View style={styles.sheetWarning}>
              <MaterialIcons name="info-outline" size={18} color={Colors.warning} />
              <Text style={styles.sheetWarningText}>
                {t('Hidden location keeps this recording off the Explore map. Use exact or approximate coordinates if you want it to appear publicly.')}
              </Text>
            </View>
          )}

          <TouchableOpacity
            style={styles.defaultToggle}
            onPress={() => setApplyAsDefault((current) => !current)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: applyAsDefault }}
            accessibilityLabel={t('Use this visibility for future recordings')}
          >
            <MaterialIcons
              name={applyAsDefault ? 'check-box' : 'check-box-outline-blank'}
              size={20}
              color={applyAsDefault ? Colors.primary : Colors.textMuted}
            />
            <Text style={styles.defaultToggleText}>
              {t('Use this as the default for future recordings')}
            </Text>
          </TouchableOpacity>

          <View style={styles.sheetActions}>
            <TouchableOpacity
              style={styles.sheetSecondaryButton}
              onPress={() => setShowVisibilitySheet(false)}
              accessibilityRole="button"
              accessibilityLabel={t('Cancel saving')}
            >
              <Text style={styles.sheetSecondaryButtonText}>{t('Back')}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.sheetPrimaryButton}
              onPress={handleConfirmVisibility}
              accessibilityRole="button"
              accessibilityLabel={pendingVisibility === 'community' ? t('Share recording with community') : t('Save private recording')}
            >
              <Text style={styles.sheetPrimaryButtonText}>
                {pendingVisibility === 'community' ? t('Share & Save') : t('Save Private')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.md,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 6,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    color: Colors.textMuted,
    marginBottom: Spacing.lg,
    textAlign: 'center',
  },
  sectionContent: {
    paddingBottom: Spacing.md,
  },
  sectionDivider: {
    height: Spacing.lg,
  },
  profileDefaultsNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.surfaceHighlight,
  },
  profileDefaultsNoteText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    color: Colors.textMuted,
  },
  locationWarning: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 14,
    marginBottom: Spacing.md,
    backgroundColor: `${Colors.warning}15`,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: `${Colors.warning}30`,
  },
  locationWarningContent: {
    flex: 1,
  },
  locationWarningTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 2,
  },
  locationWarningText: {
    fontSize: 13,
    color: Colors.textMuted,
    lineHeight: 18,
  },
  actions: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    backgroundColor: Colors.background,
    borderTopWidth: 1,
    borderTopColor: Colors.surfaceHighlight,
  },
  saveButton: {
    backgroundColor: Colors.success,
    paddingVertical: 18,
    borderRadius: Radius.full,
    alignItems: 'center',
  },
  saveButtonText: {
    color: Colors.background,
    fontSize: 17,
    fontWeight: '700',
  },
  sheetBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(17, 17, 17, 0.28)',
  },
  sheetContainer: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    gap: Spacing.md,
    borderTopWidth: 1,
    borderColor: Colors.surfaceHighlight,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: Radius.full,
    backgroundColor: Colors.surfaceHighlight,
    alignSelf: 'center',
  },
  sheetEyebrow: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textMuted,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  sheetTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.text,
  },
  sheetText: {
    fontSize: 15,
    lineHeight: 22,
    color: Colors.textMuted,
  },
  currentDefaultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  currentDefaultText: {
    fontSize: 13,
    color: Colors.textMuted,
  },
  sheetOptions: {
    gap: Spacing.sm,
  },
  sheetOption: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
    padding: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.surfaceHighlight,
  },
  sheetOptionActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryMuted,
  },
  sheetOptionContent: {
    flex: 1,
    gap: 4,
  },
  sheetOptionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
  },
  sheetOptionTitleActive: {
    color: Colors.primary,
  },
  sheetOptionText: {
    fontSize: 14,
    lineHeight: 20,
    color: Colors.textMuted,
  },
  sheetWarning: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    padding: Spacing.md,
    backgroundColor: Colors.warningMuted,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: `${Colors.warning}30`,
  },
  sheetWarningText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    color: Colors.text,
  },
  defaultToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  defaultToggleText: {
    flex: 1,
    fontSize: 14,
    color: Colors.text,
  },
  sheetActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    paddingTop: Spacing.xs,
  },
  sheetSecondaryButton: {
    flex: 1,
    minHeight: 52,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.surfaceHighlight,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
  },
  sheetSecondaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textMuted,
  },
  sheetPrimaryButton: {
    flex: 1,
    minHeight: 52,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.text,
  },
  sheetPrimaryButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.background,
  },
});
