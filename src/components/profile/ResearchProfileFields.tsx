import React from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Colors, Radius, Spacing } from '../../theme/colors';
import {
  AGE_RANGE_OPTIONS,
  GENDER_OPTIONS,
  LIVING_AREA_OPTIONS,
  ResearchProfile,
} from '../../types/researchProfile';
import { t } from '../../i18n';

interface Props {
  value: ResearchProfile;
  onChange: (value: ResearchProfile) => void;
  showIntro?: boolean;
}

function OptionGroup({
  label,
  options,
  selectedValue,
  onSelect,
}: {
  label: string;
  options: readonly string[];
  selectedValue?: string;
  onSelect: (value: string) => void;
}) {
  return (
    <View style={styles.group}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.optionWrap}>
        {options.map((option) => {
          const isSelected = selectedValue === option;
          return (
            <TouchableOpacity
              key={option}
              style={[styles.optionChip, isSelected && styles.optionChipActive]}
              onPress={() => onSelect(option)}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
              accessibilityLabel={`${label}: ${option}`}
            >
              <Text style={[styles.optionText, isSelected && styles.optionTextActive]}>
                {option}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

export function ResearchProfileFields({ value, onChange, showIntro = true }: Props) {
  return (
    <View style={styles.container}>
      {showIntro && (
        <View style={styles.infoBox}>
          <Text style={styles.infoTitle}>{t('Optional research profile')}</Text>
          <Text style={styles.infoText}>
            {t('These details are optional and stored securely with your account. They are intended for soundscape research context and are not shown publicly on the map.')}
          </Text>
        </View>
      )}

      <OptionGroup
        label="Age range"
        options={AGE_RANGE_OPTIONS}
        selectedValue={value.ageRange}
        onSelect={(ageRange) => onChange({ ...value, ageRange })}
      />

      <OptionGroup
        label="Gender"
        options={GENDER_OPTIONS}
        selectedValue={value.gender}
        onSelect={(gender) => onChange({ ...value, gender })}
      />

      <OptionGroup
        label="Living area"
        options={LIVING_AREA_OPTIONS}
        selectedValue={value.livingArea}
        onSelect={(livingArea) => onChange({ ...value, livingArea })}
      />

      <View style={styles.group}>
        <Text style={styles.label}>{t('Occupation')}</Text>
        <TextInput
          style={styles.input}
          value={value.occupation ?? ''}
          onChangeText={(occupation) => onChange({ ...value, occupation })}
          placeholder={t('Optional')}
          placeholderTextColor={Colors.textMuted}
          autoCapitalize="words"
          accessibilityLabel={t('Occupation')}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.lg,
  },
  infoBox: {
    padding: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.surfaceHighlight,
  },
  infoTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 4,
  },
  infoText: {
    fontSize: 13,
    lineHeight: 18,
    color: Colors.textMuted,
  },
  group: {
    gap: Spacing.sm,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
  },
  optionWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  optionChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: Radius.full,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.surfaceHighlight,
  },
  optionChipActive: {
    backgroundColor: Colors.primaryMuted,
    borderColor: Colors.primary,
  },
  optionText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textMuted,
  },
  optionTextActive: {
    color: Colors.primary,
  },
  input: {
    minHeight: 48,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.surfaceHighlight,
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.md,
    fontSize: 15,
    color: Colors.text,
  },
});
