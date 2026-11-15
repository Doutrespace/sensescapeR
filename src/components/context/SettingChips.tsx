import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors } from '../../theme/colors';
import { SettingContext } from '../../types/recording';
import { t } from '../../i18n';

type IconName = keyof typeof MaterialIcons.glyphMap;

interface Props {
  value: SettingContext;
  onChange: (value: SettingContext) => void;
}

interface ChipOption {
  key: keyof Omit<SettingContext, 'purpose'>;
  label: string;
  icon: IconName;
}

const LOCATION_OPTIONS: ChipOption[] = [
  { key: 'indoor', label: 'Indoor', icon: 'home' },
  { key: 'outdoor', label: 'Outdoor', icon: 'nature' },
];

const SOCIAL_OPTIONS: ChipOption[] = [
  { key: 'alone', label: 'Alone', icon: 'person' },
  { key: 'inGroup', label: 'With Others', icon: 'groups' },
];

export default function SettingChips({ value, onChange }: Props) {
  const toggleOption = (key: keyof Omit<SettingContext, 'purpose'>) => {
    // For location (indoor/outdoor), toggle the pair
    if (key === 'indoor' || key === 'outdoor') {
      onChange({
        ...value,
        indoor: key === 'indoor',
        outdoor: key === 'outdoor',
      });
    }
    // For social context (alone/inGroup), toggle the pair
    else if (key === 'alone' || key === 'inGroup') {
      onChange({
        ...value,
        alone: key === 'alone',
        inGroup: key === 'inGroup',
      });
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t('Recording Context')}</Text>
      <Text style={styles.subtitle}>
        {t('Help us understand the situation during this recording')}
      </Text>

      {/* Location context */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>{t('Location')}</Text>
        <View style={styles.chipRow}>
          {LOCATION_OPTIONS.map((option) => {
            const isSelected = value[option.key];
            return (
              <TouchableOpacity
                key={option.key}
                style={[styles.chip, isSelected && styles.chipSelected]}
                onPress={() => toggleOption(option.key)}
                activeOpacity={0.7}
              >
                <MaterialIcons
                  name={option.icon}
                  size={18}
                  color={isSelected ? Colors.primary : Colors.textMuted}
                />
                <Text style={[styles.chipLabel, isSelected && styles.chipLabelSelected]}>
                  {t(option.label)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Social context */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>{t('Social Setting')}</Text>
        <View style={styles.chipRow}>
          {SOCIAL_OPTIONS.map((option) => {
            const isSelected = value[option.key];
            return (
              <TouchableOpacity
                key={option.key}
                style={[styles.chip, isSelected && styles.chipSelected]}
                onPress={() => toggleOption(option.key)}
                activeOpacity={0.7}
              >
                <MaterialIcons
                  name={option.icon}
                  size={18}
                  color={isSelected ? Colors.primary : Colors.textMuted}
                />
                <Text style={[styles.chipLabel, isSelected && styles.chipLabelSelected]}>
                  {t(option.label)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.textMuted,
    marginBottom: 24,
  },
  section: {
    marginBottom: 24,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textMuted,
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.surface,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 100,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  chipSelected: {
    borderColor: Colors.primary,
    backgroundColor: `${Colors.primary}15`,
  },
  chipLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textMuted,
  },
  chipLabelSelected: {
    color: Colors.primary,
  },
});
