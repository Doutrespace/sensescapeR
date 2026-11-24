import React, { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, Spacing, Radius } from '../../theme/colors';
import { CommunityVisibility, PrivacyMode } from '../../types/recording';
import { usePreferencesStore } from '../../stores/usePreferencesStore';
import { t } from '../../i18n';

interface Props {
  visible: boolean;
  privacyMode: PrivacyMode;
  communityVisibility: CommunityVisibility;
  onClose: () => void;
  /** Called with the chosen visibility; the caller then saves the measurement. */
  onConfirm: (visibility: CommunityVisibility) => void;
}

/**
 * Asked right before saving when cloud sync is available: keep the
 * measurement in the private archive or show it on the community map.
 */
export default function SaveVisibilitySheet({
  visible,
  privacyMode,
  communityVisibility,
  onClose,
  onConfirm,
}: Props) {
  const { defaultCommunityVisibility, setDefaultCommunityVisibility } = usePreferencesStore();
  const [pendingVisibility, setPendingVisibility] = useState<CommunityVisibility>(communityVisibility);
  const [applyAsDefault, setApplyAsDefault] = useState(false);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (visible) {
      setPendingVisibility(communityVisibility);
      setApplyAsDefault(false);
    }
  }, [communityVisibility, visible]);

  const handleConfirmVisibility = () => {
    if (applyAsDefault) {
      void setDefaultCommunityVisibility(pendingVisibility);
    }
    onConfirm(pendingVisibility);
  };

  return (
  <Modal
    visible={visible}
    transparent
    animationType="fade"
    onRequestClose={onClose}
  >
    <Pressable
      style={styles.sheetBackdrop}
      onPress={onClose}
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
          onPress={onClose}
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
  );
}

const styles = StyleSheet.create({
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
