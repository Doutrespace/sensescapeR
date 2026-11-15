import React from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, Radius, Spacing } from '../../theme/colors';
import { t, tPlural } from '../../i18n';

interface Props {
  isOnline: boolean;
  isUploading: boolean;
  pendingCount: number;
  failedCount: number;
  failureDetail?: string | null;
  isConfigured: boolean;
  onRetry: () => void;
  onViewDetails?: () => void;
}

export function SyncStatusBanner({
  isOnline,
  isUploading,
  pendingCount,
  failedCount,
  failureDetail,
  isConfigured,
  onRetry,
  onViewDetails,
}: Props) {
  if (!isConfigured || (isOnline && pendingCount === 0 && failedCount === 0 && !isUploading)) {
    return null;
  }

  const iconName = !isOnline
    ? 'cloud-off'
    : failedCount > 0
      ? 'sync-problem'
      : isUploading
        ? 'cloud-upload'
        : 'schedule';

  const title = !isOnline
    ? t('Offline mode')
    : failedCount > 0
      ? tPlural(failedCount, '{count} upload failed', '{count} uploads failed')
      : isUploading
        ? t('Uploading recordings')
        : tPlural(pendingCount, '{count} recording waiting to sync', '{count} recordings waiting to sync');

  const detail = !isOnline
    ? tPlural(pendingCount, '{count} item will sync when the network returns.', '{count} items will sync when the network returns.')
    : failedCount > 0
      ? failureDetail ?? t('Retry failed uploads or inspect the affected recordings.')
      : isUploading
        ? t('Your queued recordings are being synced in the background.')
        : t('Cloud sync is available for queued local recordings.');

  return (
    <View style={styles.container}>
      <View style={styles.summary}>
        <View style={styles.iconWrap}>
          {isUploading ? (
            <ActivityIndicator size="small" color={Colors.primary} />
          ) : (
            <MaterialIcons name={iconName as any} size={18} color={Colors.primary} />
          )}
        </View>
        <View style={styles.textBlock}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.detail}>{detail}</Text>
        </View>
      </View>

      {isOnline && (pendingCount > 0 || failedCount > 0) && !isUploading && (
        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.action}
            onPress={onRetry}
            activeOpacity={0.8}
          >
            <MaterialIcons name="refresh" size={16} color={Colors.background} />
            <Text style={styles.actionText}>
              {failedCount > 0 ? t('Retry Sync') : t('Sync Now')}
            </Text>
          </TouchableOpacity>
          {onViewDetails ? (
            <TouchableOpacity
              style={styles.secondaryAction}
              onPress={onViewDetails}
              activeOpacity={0.8}
            >
              <MaterialIcons name="list-alt" size={16} color={Colors.primary} />
              <Text style={styles.secondaryActionText}>{t('Details')}</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: Spacing.md,
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
    padding: 14,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.surfaceHighlight,
    backgroundColor: Colors.surface,
    gap: 12,
  },
  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primaryMuted,
  },
  textBlock: {
    flex: 1,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 2,
  },
  detail: {
    fontSize: 13,
    lineHeight: 18,
    color: Colors.textMuted,
  },
  action: {
    minHeight: 38,
    paddingHorizontal: 14,
    borderRadius: Radius.full,
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.background,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    alignSelf: 'flex-start',
  },
  secondaryAction: {
    minHeight: 38,
    paddingHorizontal: 14,
    borderRadius: Radius.full,
    backgroundColor: Colors.primaryMuted,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  secondaryActionText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.primary,
  },
});
