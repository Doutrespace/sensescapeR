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
import type { ExportActivity, ActivityStatus } from '../../stores/useActivityStore';
import type { SyncActivity } from '../../stores/useSyncStore';
import { t, getLocaleTag } from '../../i18n';

interface Props {
  exportHistory: ExportActivity[];
  syncHistory: SyncActivity[];
  visible: boolean;
  onClose: () => void;
}

function getActivityTone(status: ActivityStatus) {
  switch (status) {
    case 'success':
      return { backgroundColor: Colors.successMuted, color: Colors.success };
    case 'warning':
      return { backgroundColor: Colors.warningMuted, color: Colors.warning };
    case 'error':
      return { backgroundColor: Colors.errorMuted, color: Colors.error };
    default:
      return { backgroundColor: Colors.primaryMuted, color: Colors.primary };
  }
}

function HistorySection({
  title,
  emptyLabel,
  iconName,
  items,
}: {
  title: string;
  emptyLabel: string;
  iconName: 'cloud-sync' | 'ios-share';
  items: Array<{ message: string; status: ActivityStatus; at: string; subtitle: string }>;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <MaterialIcons name={iconName} size={18} color={Colors.textMuted} />
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>

      <View style={styles.card}>
        {items.length === 0 ? (
          <Text style={styles.emptyText}>{emptyLabel}</Text>
        ) : (
          items.map((item, index) => {
            const tone = getActivityTone(item.status);
            return (
              <View
                key={`${title}-${item.at}-${index}`}
                style={[styles.row, index < items.length - 1 && styles.rowBorder]}
              >
                <View style={[styles.iconWrap, { backgroundColor: tone.backgroundColor }]}>
                  <MaterialIcons name={iconName} size={16} color={tone.color} />
                </View>
                <View style={styles.content}>
                  <Text style={styles.message}>{item.message}</Text>
                  <Text style={styles.subtitle}>{t(item.subtitle)}</Text>
                  <Text style={styles.time}>{new Date(item.at).toLocaleString(getLocaleTag())}</Text>
                </View>
              </View>
            );
          })
        )}
      </View>
    </View>
  );
}

export function ActivityHistorySheet({
  exportHistory,
  syncHistory,
  visible,
  onClose,
}: Props) {
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.backdrop} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.handle} />

          <View style={styles.header}>
            <Text style={styles.title}>{t('Activity History')}</Text>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <MaterialIcons name="close" size={24} color={Colors.textMuted} />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            <HistorySection
              title="Recent Syncs"
              emptyLabel="No sync activity yet."
              iconName="cloud-sync"
              items={syncHistory.map((item) => ({
                ...item,
                subtitle: `Sync status: ${item.status}`,
              }))}
            />

            <HistorySection
              title="Recent Exports"
              emptyLabel="No exports yet."
              iconName="ios-share"
              items={exportHistory.map((item) => ({
                ...item,
                subtitle: `Format: ${item.format.toUpperCase()}`,
              }))}
            />
          </ScrollView>
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
    backgroundColor: 'rgba(18, 18, 18, 0.28)',
  },
  sheet: {
    maxHeight: '82%',
    backgroundColor: Colors.background,
    borderTopLeftRadius: Radius.lg,
    borderTopRightRadius: Radius.lg,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xl,
    ...Shadows.lg,
  },
  handle: {
    alignSelf: 'center',
    width: 42,
    height: 4,
    borderRadius: Radius.full,
    backgroundColor: Colors.surfaceHighlight,
    marginBottom: Spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.text,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
  },
  scroll: {
    flexGrow: 0,
  },
  scrollContent: {
    paddingBottom: Spacing.lg,
  },
  section: {
    marginBottom: Spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    overflow: 'hidden',
  },
  emptyText: {
    padding: Spacing.md,
    fontSize: 14,
    color: Colors.textMuted,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
  },
  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.surfaceHighlight,
  },
  iconWrap: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  content: {
    flex: 1,
  },
  message: {
    fontSize: 14,
    lineHeight: 20,
    color: Colors.text,
    fontWeight: '600',
  },
  subtitle: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
  },
  time: {
    fontSize: 11,
    color: Colors.textDisabled,
    marginTop: 4,
  },
});
