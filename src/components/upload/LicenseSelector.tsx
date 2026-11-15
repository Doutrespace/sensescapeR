import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors } from '../../theme/colors';
import { LicenseType } from '../../types/recording';
import { t } from '../../i18n';

type IconName = keyof typeof MaterialIcons.glyphMap;

interface Props {
  value: LicenseType;
  onChange: (value: LicenseType) => void;
}

interface LicenseOption {
  value: LicenseType;
  label: string;
  shortLabel: string;
  description: string;
  icon: IconName;
}

const LICENSES: LicenseOption[] = [
  {
    value: 'CC-BY',
    label: 'Attribution',
    shortLabel: 'CC BY',
    description: 'Others can share and adapt, must give credit',
    icon: 'edit',
  },
  {
    value: 'CC-BY-NC',
    label: 'Non-Commercial',
    shortLabel: 'CC BY-NC',
    description: 'Others can share and adapt for non-commercial use',
    icon: 'money-off',
  },
  {
    value: 'CC0',
    label: 'Public Domain',
    shortLabel: 'CC0',
    description: 'No rights reserved, anyone can use freely',
    icon: 'public',
  },
];

export default function LicenseSelector({ value, onChange }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t('License')}</Text>
      <Text style={styles.subtitle}>
        {t('Choose how others can use your recording')}
      </Text>

      <View style={styles.options}>
        {LICENSES.map((license) => {
          const isSelected = value === license.value;
          return (
            <TouchableOpacity
              key={license.value}
              style={[styles.option, isSelected && styles.optionSelected]}
              onPress={() => onChange(license.value)}
              activeOpacity={0.7}
            >
              <View style={styles.optionHeader}>
                <MaterialIcons
                  name={license.icon}
                  size={22}
                  color={isSelected ? Colors.primary : Colors.textMuted}
                  style={styles.optionIcon}
                />
                <View style={styles.optionLabels}>
                  <Text style={[styles.optionLabel, isSelected && styles.optionLabelSelected]}>
                    {t(license.label)}
                  </Text>
                  <Text style={[styles.optionShort, isSelected && styles.optionShortSelected]}>
                    {t(license.shortLabel)}
                  </Text>
                </View>
                <View style={[styles.radio, isSelected && styles.radioSelected]}>
                  {isSelected && <View style={styles.radioInner} />}
                </View>
              </View>
              <Text style={styles.optionDescription}>{t(license.description)}</Text>
            </TouchableOpacity>
          );
        })}
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
    marginBottom: 20,
  },
  options: {
    gap: 12,
  },
  option: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  optionSelected: {
    borderColor: Colors.primary,
    backgroundColor: `${Colors.primary}10`,
  },
  optionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  optionIcon: {
    marginRight: 12,
  },
  optionLabels: {
    flex: 1,
  },
  optionLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
  },
  optionLabelSelected: {
    color: Colors.primary,
  },
  optionShort: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
  },
  optionShortSelected: {
    color: Colors.primary,
  },
  optionDescription: {
    fontSize: 14,
    color: Colors.textMuted,
    lineHeight: 20,
    marginLeft: 32,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: Colors.surfaceHighlight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelected: {
    borderColor: Colors.primary,
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: Colors.primary,
  },
});
