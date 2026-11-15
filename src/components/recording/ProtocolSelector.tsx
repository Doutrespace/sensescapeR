import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, Radius, Spacing } from '../../theme/colors';
import { ProtocolType } from '../../types/recording';
import { PROTOCOLS, DURATION_OPTIONS, formatDuration } from '../../constants/protocols';
import { t } from '../../i18n';

interface Props {
  selectedProtocol: ProtocolType;
  selectedDuration: number;
  onProtocolChange: (protocol: ProtocolType) => void;
  onDurationChange: (duration: number) => void;
  onConfirm: () => void;
}

export default function ProtocolSelector({
  selectedProtocol,
  selectedDuration,
  onProtocolChange,
  onDurationChange,
  onConfirm,
}: Props) {
  const currentProtocol = PROTOCOLS.find((p) => p.value === selectedProtocol);
  const allowedDurations = currentProtocol?.allowedDurations ?? [];
  const isDurationLocked = allowedDurations.length === 1;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.eyebrow}>{t('Choose Capture Mode')}</Text>
      <Text style={styles.title}>{t('Recording Protocol')}</Text>
      <Text style={styles.subtitle}>
        {t('Select a protocol that matches your recording context')}
      </Text>

      <View style={styles.section}>
        {PROTOCOLS.map((protocol, index) => {
          const isSelected = selectedProtocol === protocol.value;
          const isLast = index === PROTOCOLS.length - 1;
          return (
            <TouchableOpacity
              key={protocol.value}
              style={[
                styles.protocolRow,
                isSelected && styles.protocolRowSelected,
                isLast && styles.protocolRowLast,
              ]}
              accessibilityRole="button"
              accessibilityLabel={`${t(protocol.label)} protocol`}
              accessibilityHint={protocol.description}
              accessibilityState={{ selected: isSelected }}
              onPress={() => {
                onProtocolChange(protocol.value);
                onDurationChange(protocol.defaultDuration);
              }}
              activeOpacity={0.7}
            >
              <View style={styles.protocolMain}>
                <View style={[styles.protocolIconWrap, isSelected && styles.protocolIconWrapSelected]}>
                  <MaterialIcons
                    name={protocol.icon}
                    size={22}
                    color={isSelected ? Colors.primary : Colors.textMuted}
                  />
                </View>
                <View style={styles.protocolTextWrap}>
                  <Text style={[styles.protocolLabel, isSelected && styles.protocolLabelSelected]}>
                    {t(protocol.label)}
                  </Text>
                  <Text style={[styles.protocolDesc, isSelected && styles.protocolDescSelected]}>
                    {t(protocol.description)}
                  </Text>
                </View>
              </View>
              <MaterialIcons
                name={isSelected ? 'check-circle' : 'radio-button-unchecked'}
                size={20}
                color={isSelected ? Colors.primary : '#C7CDD8'}
              />
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.durationSection}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{t('Duration')}</Text>
          {isDurationLocked && (
            <Text style={styles.sectionMeta}>{t('Fixed by selected protocol')}</Text>
          )}
        </View>
        {isDurationLocked ? (
          <View style={styles.durationLocked}>
            <Text style={styles.durationLockedValue}>{formatDuration(selectedDuration)}</Text>
          </View>
        ) : (
          <View style={styles.durationGroup}>
            {DURATION_OPTIONS.filter((d) =>
              allowedDurations.includes(d.value)
            ).map((duration) => {
              const isSelected = selectedDuration === duration.value;
              return (
                <TouchableOpacity
                  key={duration.value}
                  style={[styles.durationChip, isSelected && styles.durationChipSelected]}
                  accessibilityRole="button"
                  accessibilityLabel={`${t(duration.label)} duration`}
                  accessibilityState={{ selected: isSelected }}
                  onPress={() => onDurationChange(duration.value)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.durationChipText,
                      isSelected && styles.durationChipTextSelected,
                    ]}
                  >
                    {t(duration.label)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </View>

      <TouchableOpacity
        style={styles.startButton}
        onPress={onConfirm}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel={t('Continue to recording')}
        accessibilityHint={t('Moves to the next step with the selected protocol and duration')}
      >
        <Text style={styles.startButtonText}>{t('Continue')}</Text>
        <MaterialIcons name="arrow-forward" size={20} color={Colors.background} />
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: 40,
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    color: Colors.primary,
    marginBottom: 8,
  },
  title: {
    fontSize: 36,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: 10,
    letterSpacing: -0.8,
  },
  subtitle: {
    fontSize: 16,
    color: Colors.textMuted,
    marginBottom: 28,
    lineHeight: 24,
  },
  section: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.surfaceHighlight,
    marginBottom: 28,
  },
  protocolRow: {
    minHeight: 94,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#EEF0F4',
  },
  protocolRowSelected: {
    backgroundColor: '#F2EDE2',
  },
  protocolRowLast: {
    borderBottomWidth: 0,
  },
  protocolMain: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  protocolIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F1EBE0',
  },
  protocolIconWrapSelected: {
    backgroundColor: '#E5D9C6',
  },
  protocolTextWrap: {
    gap: 4,
    flex: 1,
    marginLeft: 14,
  },
  protocolLabel: {
    fontSize: 19,
    fontWeight: '700',
    color: Colors.text,
  },
  protocolLabelSelected: {
    color: Colors.primary,
  },
  protocolDesc: {
    fontSize: 15,
    color: Colors.textMuted,
    lineHeight: 22,
  },
  protocolDescSelected: {
    color: Colors.text,
  },
  durationSection: {
    marginBottom: 32,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.text,
  },
  sectionMeta: {
    fontSize: 13,
    color: Colors.textMuted,
  },
  durationLocked: {
    backgroundColor: Colors.surface,
    paddingVertical: 18,
    borderRadius: Radius.xl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.surfaceHighlight,
  },
  durationLockedValue: {
    color: Colors.text,
    fontSize: 18,
    fontWeight: '700',
  },
  durationGroup: {
    flexDirection: 'row',
    backgroundColor: '#E7E0D2',
    borderRadius: Radius.full,
    padding: 4,
  },
  durationChip: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: Radius.full,
    alignItems: 'center',
  },
  durationChipSelected: {
    backgroundColor: Colors.surface,
  },
  durationChipText: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textMuted,
  },
  durationChipTextSelected: {
    color: Colors.primary,
  },
  startButton: {
    backgroundColor: Colors.primary,
    height: 58,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  startButtonText: {
    color: Colors.background,
    fontSize: 17,
    fontWeight: '700',
  },
});
