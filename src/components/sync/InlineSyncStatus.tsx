import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, Radius, Spacing } from '../../theme/colors';
import { t, tPlural } from '../../i18n';

interface Props {
  isOnline: boolean;
  isUploading: boolean;
  queuedCount: number;
  failedCount: number;
}

export function InlineSyncStatus({
  isOnline,
  isUploading,
  queuedCount,
  failedCount,
}: Props) {
  if (isOnline && !isUploading && queuedCount === 0 && failedCount === 0) {
    return null;
  }

  const icon = !isOnline
    ? 'cloud-off'
    : failedCount > 0
      ? 'sync-problem'
      : isUploading
        ? 'cloud-upload'
        : 'schedule';

  const message = !isOnline
    ? t('Offline. New recordings stay on this device until the network returns.')
    : failedCount > 0
      ? tPlural(failedCount, '{count} upload needs attention in My Recordings.', '{count} uploads need attention in My Recordings.')
      : isUploading
        ? t('Queued recordings are syncing in the background.')
        : tPlural(queuedCount, '{count} recording waiting to sync.', '{count} recordings waiting to sync.');

  return (
    <View style={styles.container}>
      <MaterialIcons
        name={icon as any}
        size={16}
        color={!isOnline || failedCount > 0 ? Colors.warning : Colors.textMuted}
      />
      <Text style={styles.text}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: Spacing.md,
    marginTop: Spacing.sm,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: Radius.full,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.surfaceHighlight,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  text: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
    color: Colors.textMuted,
  },
});
