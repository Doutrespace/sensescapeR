import React from 'react';
import { StyleSheet, Text, View, ActivityIndicator } from 'react-native';
import { Colors, Spacing, Radius, Shadows } from '../../theme/colors';
import { t } from '../../i18n';

export function SavingScreen() {
  return (
    <View style={styles.savingContainer}>
      <View style={styles.savingContent}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.savingText}>{t('Saving recording...')}</Text>
        <Text style={styles.savingSubtext}>{t('Please wait')}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  savingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.lg,
  },
  savingContent: {
    alignItems: 'center',
    backgroundColor: Colors.surface,
    padding: Spacing.xl,
    borderRadius: Radius.lg,
    ...Shadows.md,
  },
  savingText: {
    marginTop: Spacing.lg,
    color: Colors.text,
    fontSize: 18,
    fontWeight: '600',
  },
  savingSubtext: {
    marginTop: Spacing.sm,
    color: Colors.textMuted,
    fontSize: 14,
  },
});
