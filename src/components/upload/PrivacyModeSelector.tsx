import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors } from '../../theme/colors';
import { PrivacyMode } from '../../types/recording';

type IconName = keyof typeof MaterialIcons.glyphMap;

interface Props {
  value: PrivacyMode;
  onChange: (value: PrivacyMode) => void;
}

interface PrivacyOption {
  value: PrivacyMode;
  label: string;
  description: string;
  icon: IconName;
  accuracy: string;
}

const PRIVACY_OPTIONS: PrivacyOption[] = [
  {
    value: 'exact',
    label: 'Exact Location',
    description: 'Save and share precise GPS coordinates for maximum scientific value',
    icon: 'gps-fixed',
    accuracy: '~10m accuracy',
  },
  {
    value: 'fuzzed',
    label: 'Approximate',
    description: 'Save and share rounded neighborhood-level coordinates',
    icon: 'my-location',
    accuracy: '~500m accuracy',
  },
  {
    value: 'hidden',
    label: 'Hidden',
    description: 'Do not store or share coordinates with this recording',
    icon: 'lock',
    accuracy: 'City level',
  },
];

export default function PrivacyModeSelector({ value, onChange }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Location Privacy</Text>
      <Text style={styles.subtitle}>
        Control how your recording location is shared
      </Text>

      <View style={styles.options}>
        {PRIVACY_OPTIONS.map((option) => {
          const isSelected = value === option.value;
          return (
            <TouchableOpacity
              key={option.value}
              style={[styles.option, isSelected && styles.optionSelected]}
              onPress={() => onChange(option.value)}
              activeOpacity={0.7}
            >
              <View style={styles.optionRow}>
                <MaterialIcons
                  name={option.icon}
                  size={24}
                  color={isSelected ? Colors.primary : Colors.textMuted}
                  style={styles.optionIcon}
                />
                <View style={styles.optionContent}>
                  <View style={styles.optionHeader}>
                    <Text style={[styles.optionLabel, isSelected && styles.optionLabelSelected]}>
                      {option.label}
                    </Text>
                    <Text style={styles.optionAccuracy}>{option.accuracy}</Text>
                  </View>
                  <Text style={styles.optionDescription}>{option.description}</Text>
                </View>
                <View style={[styles.radio, isSelected && styles.radioSelected]}>
                  {isSelected && <View style={styles.radioInner} />}
                </View>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.infoBox}>
        <MaterialIcons name="info-outline" size={18} color={Colors.primary} />
        <Text style={styles.infoText}>
          Your choice applies to the saved record as well as cloud sharing.
          Choose "Approximate" for neighborhood-level context or "Hidden" to omit coordinates entirely.
        </Text>
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
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  optionIcon: {
    marginRight: 14,
  },
  optionContent: {
    flex: 1,
  },
  optionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  optionLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginRight: 8,
  },
  optionLabelSelected: {
    color: Colors.primary,
  },
  optionAccuracy: {
    fontSize: 12,
    color: Colors.textMuted,
    backgroundColor: Colors.surfaceHighlight,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  optionDescription: {
    fontSize: 14,
    color: Colors.textMuted,
    lineHeight: 20,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: Colors.surfaceHighlight,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
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
  infoBox: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    padding: 14,
    borderRadius: 10,
    marginTop: 20,
    gap: 10,
    alignItems: 'flex-start',
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: Colors.textMuted,
    lineHeight: 18,
  },
});
