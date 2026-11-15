import React from 'react';
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, Radius, Shadows, Spacing } from '../../theme/colors';
import { t, getLocaleTag } from '../../i18n';

export interface SyncQueueDetailItem {
  id: string;
  recordingId: string;
  title: string;
  subtitle: string;
  attempts: number;
  nextRetryAt: string;
  lastError?: string;
}

interface Props {
  visible: boolean;
  items: SyncQueueDetailItem[];
  onClose: () => void;
  onRetry: () => void;
}

function formatRetryTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? t('Retry time unavailable')
    : t('Next retry {time}', { time: date.toLocaleString(getLocaleTag()) });
}

export function SyncQueueSheet({ visible, items, onClose, onRetry }: Props) {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.backdrop} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.handle} />

          <View style={styles.header}>
            <View style={styles.headerText}>
              <Text style={styles.title}>{t('Sync Queue')}</Text>
              <Text style={styles.subtitle}>
                {t('Inspect queued recordings and the latest upload errors.')}
              </Text>
            </View>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <MaterialIcons name="close" size={22} color={Colors.textMuted} />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.list}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          >
            {items.length === 0 ? (
              <View style={styles.emptyState}>
                <MaterialIcons name="cloud-done" size={32} color={Colors.textMuted} />
                <Text style={styles.emptyTitle}>{t('No queued uploads')}</Text>
                <Text style={styles.emptyText}>
                  {t('Local recordings will appear here when they are waiting to sync.')}
                </Text>
              </View>
            ) : (
              items.map((item) => (
                <View key={item.id} style={styles.item}>
                  <View style={styles.itemHeader}>
                    <View style={styles.itemMeta}>
                      <Text style={styles.itemTitle}>{t(item.title)}</Text>
                      <Text style={styles.itemSubtitle}>{t(item.subtitle)}</Text>
                    </View>
                    <View style={styles.attemptBadge}>
                      <Text style={styles.attemptText}>{item.attempts}x</Text>
                    </View>
                  </View>

                  <Text style={styles.retryText}>{formatRetryTime(item.nextRetryAt)}</Text>

                  {item.lastError ? (
                    <View style={styles.errorBlock}>
                      <MaterialIcons name="error-outline" size={16} color={Colors.error} />
                      <Text style={styles.errorText}>{item.lastError}</Text>
                    </View>
                  ) : null}
                </View>
              ))
            )}
          </ScrollView>

          {items.length > 0 ? (
            <TouchableOpacity style={styles.retryButton} onPress={onRetry} activeOpacity={0.8}>
              <MaterialIcons name="refresh" size={18} color={Colors.background} />
              <Text style={styles.retryTextButton}>{t('Retry queued uploads')}</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
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
    backgroundColor: 'rgba(16, 16, 16, 0.35)',
  },
  sheet: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    maxHeight: '78%',
    paddingBottom: Spacing.lg,
    ...Shadows.lg,
  },
  handle: {
    width: 40,
    height: 5,
    borderRadius: Radius.full,
    backgroundColor: Colors.surfaceHighlight,
    alignSelf: 'center',
    marginTop: Spacing.sm,
  },
  header: {
    flexDirection: 'row',
    gap: Spacing.sm,
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 18,
    color: Colors.textMuted,
  },
  closeButton: {
    padding: Spacing.xs,
  },
  list: {
    maxHeight: 420,
  },
  listContent: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.sm,
    gap: Spacing.sm,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xxl,
    gap: Spacing.sm,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
  },
  emptyText: {
    maxWidth: 260,
    textAlign: 'center',
    fontSize: 13,
    lineHeight: 18,
    color: Colors.textMuted,
  },
  item: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.surfaceHighlight,
    gap: Spacing.sm,
  },
  itemHeader: {
    flexDirection: 'row',
    gap: Spacing.sm,
    alignItems: 'flex-start',
  },
  itemMeta: {
    flex: 1,
  },
  itemTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 2,
  },
  itemSubtitle: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  attemptBadge: {
    minWidth: 34,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: Radius.full,
    backgroundColor: Colors.primaryMuted,
    alignItems: 'center',
  },
  attemptText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.primary,
  },
  retryText: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  errorBlock: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.xs,
    padding: Spacing.sm,
    borderRadius: Radius.sm,
    backgroundColor: Colors.errorMuted,
  },
  errorText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
    color: Colors.error,
  },
  retryButton: {
    alignSelf: 'flex-start',
    marginHorizontal: Spacing.md,
    marginTop: Spacing.md,
    minHeight: 42,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.full,
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  retryTextButton: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.background,
  },
});
