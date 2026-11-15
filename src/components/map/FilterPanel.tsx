import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors } from '../../theme/colors';
import { RecordingFilters, ProtocolType, HabitatType, SyncStatus } from '../../types/recording';
import { PROTOCOLS } from '../../constants/protocols';
import { HABITATS } from '../../constants/habitats';

interface Props {
  filters: RecordingFilters;
  onFiltersChange: (filters: RecordingFilters) => void;
  onClear: () => void;
  onClose: () => void;
}

const SYNC_STATUSES: { value: SyncStatus; label: string; color: string }[] = [
  { value: 'local', label: 'Local', color: '#6B7280' },
  { value: 'queued', label: 'Queued', color: '#F59E0B' },
  { value: 'uploading', label: 'Uploading', color: '#3B82F6' },
  { value: 'uploaded', label: 'Uploaded', color: '#22C55E' },
  { value: 'failed', label: 'Failed', color: '#EF4444' },
];

export default function FilterPanel({
  filters,
  onFiltersChange,
  onClear,
  onClose,
}: Props) {
  const toggleProtocol = (protocol: ProtocolType) => {
    const current = filters.protocols ?? [];
    const updated = current.includes(protocol)
      ? current.filter((p) => p !== protocol)
      : [...current, protocol];
    onFiltersChange({ ...filters, protocols: updated.length > 0 ? updated : undefined });
  };

  const toggleHabitat = (habitat: HabitatType) => {
    const current = filters.habitats ?? [];
    const updated = current.includes(habitat)
      ? current.filter((h) => h !== habitat)
      : [...current, habitat];
    onFiltersChange({ ...filters, habitats: updated.length > 0 ? updated : undefined });
  };

  const toggleSyncStatus = (status: SyncStatus) => {
    const current = filters.syncStatus ?? [];
    const updated = current.includes(status)
      ? current.filter((s) => s !== status)
      : [...current, status];
    onFiltersChange({ ...filters, syncStatus: updated.length > 0 ? updated : undefined });
  };

  const hasActiveFilters =
    (filters.protocols?.length ?? 0) > 0 ||
    (filters.habitats?.length ?? 0) > 0 ||
    (filters.syncStatus?.length ?? 0) > 0;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Filters</Text>
        <View style={styles.headerActions}>
          {hasActiveFilters && (
            <TouchableOpacity onPress={onClear}>
              <Text style={styles.clearButton}>Clear All</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <MaterialIcons name="close" size={24} color={Colors.text} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Protocol filters */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Protocol</Text>
          <View style={styles.chipRow}>
            {PROTOCOLS.map((protocol) => {
              const isSelected = filters.protocols?.includes(protocol.value);
              return (
                <TouchableOpacity
                  key={protocol.value}
                  style={[styles.chip, isSelected && styles.chipSelected]}
                  onPress={() => toggleProtocol(protocol.value)}
                >
                  <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>
                    {protocol.shortLabel}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Sync status filters */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Status</Text>
          <View style={styles.chipRow}>
            {SYNC_STATUSES.map((status) => {
              const isSelected = filters.syncStatus?.includes(status.value);
              return (
                <TouchableOpacity
                  key={status.value}
                  style={[
                    styles.chip,
                    isSelected && { backgroundColor: `${status.color}30`, borderColor: status.color },
                  ]}
                  onPress={() => toggleSyncStatus(status.value)}
                >
                  <View style={[styles.statusDot, { backgroundColor: status.color }]} />
                  <Text style={[styles.chipText, isSelected && { color: status.color }]}>
                    {status.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Habitat filters */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Location Type</Text>
          <View style={styles.chipRow}>
            {HABITATS.slice(0, 6).map((habitat) => {
              const isSelected = filters.habitats?.includes(habitat.value);
              return (
                <TouchableOpacity
                  key={habitat.value}
                  style={[styles.chip, isSelected && styles.chipSelected]}
                  onPress={() => toggleHabitat(habitat.value)}
                >
                  <Text style={styles.chipIcon}>{habitat.icon}</Text>
                  <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>
                    {habitat.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.surfaceHighlight,
    maxHeight: 320,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    paddingBottom: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  clearButton: {
    color: Colors.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  closeButton: {
    padding: 4,
  },
  scroll: {
    paddingHorizontal: 16,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textMuted,
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.background,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: Colors.surfaceHighlight,
  },
  chipSelected: {
    backgroundColor: `${Colors.primary}20`,
    borderColor: Colors.primary,
  },
  chipIcon: {
    fontSize: 14,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.textMuted,
  },
  chipTextSelected: {
    color: Colors.primary,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
