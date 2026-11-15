import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Colors, Spacing, Radius, Shadows } from '../../theme/colors';
import { RecordingWithPerception } from '../../types/recording';
import { ExportService, ExportFormat } from '../../services/export';
import { useActivityStore } from '../../stores/useActivityStore';

interface Props {
  recording: RecordingWithPerception | null;
  visible: boolean;
  onClose: () => void;
}

interface ExportOption {
  id: ExportFormat;
  icon: string;
  label: string;
  description: string;
  available: (recording: RecordingWithPerception) => boolean;
}

const EXPORT_OPTIONS: ExportOption[] = [
  {
    id: 'audio',
    icon: 'audiotrack',
    label: 'Share Audio',
    description: 'Share the original audio recording file',
    available: () => true,
  },
  {
    id: 'spectrogram',
    icon: 'image',
    label: 'Share Spectrogram',
    description: 'Share the visual spectrogram image',
    available: (r) => !!r.spectrogramUri,
  },
  {
    id: 'json',
    icon: 'code',
    label: 'Export as JSON',
    description: 'Full data export for analysis',
    available: () => true,
  },
  {
    id: 'csv',
    icon: 'table-chart',
    label: 'Export as CSV',
    description: 'Spreadsheet-compatible format',
    available: () => true,
  },
  {
    id: 'geojson',
    icon: 'map',
    label: 'Export as GeoJSON',
    description: 'Mapping-friendly geospatial format',
    available: () => true,
  },
  {
    id: 'soundscapy',
    icon: 'science',
    label: 'Export for Soundscapy',
    description: 'Research CSV with ISO and derived PAQ fields',
    available: () => true,
  },
  {
    id: 'summary',
    icon: 'description',
    label: 'Share Summary',
    description: 'Human-readable text summary',
    available: () => true,
  },
];

export function ExportOptionsSheet({ recording, visible, onClose }: Props) {
  const [isExporting, setIsExporting] = useState<ExportFormat | null>(null);
  const { setLastExport } = useActivityStore();

  if (!recording) return null;

  const getSuccessMessage = (format: ExportFormat): string => {
    switch (format) {
      case 'audio':
        return 'Audio sharing completed from the record detail view.';
      case 'spectrogram':
        return 'Spectrogram sharing completed from the record detail view.';
      case 'json':
        return 'A JSON export was prepared from the record detail view.';
      case 'csv':
        return 'A CSV export was prepared from the record detail view.';
      case 'geojson':
        return 'A GeoJSON export was prepared from the record detail view.';
      case 'soundscapy':
        return 'A Soundscapy-compatible CSV export was prepared from the record detail view.';
      case 'summary':
        return 'A text summary was shared from the record detail view.';
    }
  };

  const handleExport = async (format: ExportFormat) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsExporting(format);

    try {
      let result;

      switch (format) {
        case 'audio':
          result = await ExportService.shareAudio(recording);
          break;
        case 'spectrogram':
          result = await ExportService.shareSpectrogram(recording);
          break;
        case 'json':
          result = await ExportService.exportAsJSON(recording);
          break;
        case 'csv':
          result = await ExportService.exportAsCSV(recording);
          break;
        case 'geojson':
          result = await ExportService.exportAsGeoJSON(recording);
          break;
        case 'soundscapy':
          result = await ExportService.exportAsSoundscapyCSV(recording);
          break;
        case 'summary':
          result = await ExportService.shareSummary(recording);
          break;
      }

      if (result && !result.success) {
        setLastExport({
          format,
          message: result.error || 'The export could not be completed.',
          status: 'error',
        });
        Alert.alert('Export failed', result.error || 'The selected export could not be completed.');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      } else {
        setLastExport({
          format,
          message: getSuccessMessage(format),
          status: 'success',
        });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (error: any) {
      setLastExport({
        format,
        message: error.message || 'The selected export could not be completed.',
        status: 'error',
      });
      Alert.alert('Export failed', error.message || 'The selected export could not be completed.');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsExporting(null);
    }
  };

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
          {/* Handle */}
          <View style={styles.handle} />

          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Export & Share</Text>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onClose();
              }}
              accessibilityRole="button"
              accessibilityLabel="Close export options"
            >
              <MaterialIcons name="close" size={24} color={Colors.textMuted} />
            </TouchableOpacity>
          </View>

          {/* Options */}
          <View style={styles.options}>
            {EXPORT_OPTIONS.map((option) => {
              const isAvailable = option.available(recording);
              const isLoading = isExporting === option.id;

              return (
                <TouchableOpacity
                  key={option.id}
                  style={[
                    styles.optionItem,
                    !isAvailable && styles.optionItemDisabled,
                  ]}
                  onPress={() => handleExport(option.id)}
                  disabled={!isAvailable || isExporting !== null}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel={option.label}
                  accessibilityHint={isAvailable ? option.description : 'Not available for this recording'}
                  accessibilityState={{ disabled: !isAvailable || isExporting !== null }}
                >
                  <View style={[
                    styles.optionIcon,
                    !isAvailable && styles.optionIconDisabled,
                  ]}>
                    {isLoading ? (
                      <ActivityIndicator size="small" color={Colors.primary} />
                    ) : (
                      <MaterialIcons
                        name={option.icon as any}
                        size={24}
                        color={isAvailable ? Colors.primary : Colors.textDisabled}
                      />
                    )}
                  </View>
                  <View style={styles.optionContent}>
                    <Text style={[
                      styles.optionLabel,
                      !isAvailable && styles.optionLabelDisabled,
                    ]}>
                      {option.label}
                    </Text>
                    <Text style={[
                      styles.optionDescription,
                      !isAvailable && styles.optionDescriptionDisabled,
                    ]}>
                      {isAvailable ? option.description : 'Not available for this recording'}
                    </Text>
                  </View>
                  <MaterialIcons
                    name="chevron-right"
                    size={24}
                    color={isAvailable ? Colors.textMuted : Colors.textDisabled}
                  />
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Info */}
          <View style={styles.info}>
            <MaterialIcons name="info-outline" size={16} color={Colors.textMuted} />
            <Text style={styles.infoText}>
              JSON and CSV preserve the full payload, while Soundscapy CSV uses research-friendly column names for downstream analysis.
            </Text>
          </View>
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
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  sheet: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    paddingBottom: 40,
    ...Shadows.lg,
  },
  handle: {
    width: 36,
    height: 5,
    backgroundColor: Colors.surfaceHighlight,
    borderRadius: 3,
    alignSelf: 'center',
    marginTop: Spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.surfaceHighlight,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text,
  },
  closeButton: {
    padding: Spacing.xs,
  },
  options: {
    padding: Spacing.md,
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    gap: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.surfaceHighlight,
  },
  optionItemDisabled: {
    opacity: 0.5,
  },
  optionIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionIconDisabled: {
    backgroundColor: Colors.surfaceHighlight,
  },
  optionContent: {
    flex: 1,
  },
  optionLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 2,
  },
  optionLabelDisabled: {
    color: Colors.textDisabled,
  },
  optionDescription: {
    fontSize: 13,
    color: Colors.textMuted,
  },
  optionDescriptionDisabled: {
    color: Colors.textDisabled,
  },
  info: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: Colors.primaryMuted,
    marginHorizontal: Spacing.md,
    padding: Spacing.md,
    borderRadius: Radius.md,
    gap: Spacing.sm,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: Colors.textMuted,
    lineHeight: 18,
  },
});
