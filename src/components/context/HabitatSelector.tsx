import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors } from '../../theme/colors';
import { HabitatType } from '../../types/recording';
import { HABITATS } from '../../constants/habitats';

interface Props {
  value: HabitatType | null;
  onChange: (value: HabitatType) => void;
}

export default function HabitatSelector({ value, onChange }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Location Type</Text>
      <Text style={styles.subtitle}>
        Select the habitat that best describes this recording location
      </Text>

      <View style={styles.grid}>
        {HABITATS.map((habitat) => {
          const isSelected = value === habitat.value;
          return (
            <TouchableOpacity
              key={habitat.value}
              style={[styles.chip, isSelected && styles.chipSelected]}
              onPress={() => onChange(habitat.value)}
              activeOpacity={0.7}
            >
              <MaterialIcons
                name={habitat.icon}
                size={18}
                color={isSelected ? Colors.primary : Colors.textMuted}
              />
              <Text style={[styles.chipLabel, isSelected && styles.chipLabelSelected]}>
                {habitat.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {value && (
        <View style={styles.selectedInfo}>
          <View style={styles.selectedHeader}>
            <MaterialIcons
              name={HABITATS.find((h) => h.value === value)?.icon ?? 'place'}
              size={20}
              color={Colors.primary}
            />
            <Text style={styles.selectedLabel}>
              {HABITATS.find((h) => h.value === value)?.label}
            </Text>
          </View>
          <Text style={styles.selectedDescription}>
            {HABITATS.find((h) => h.value === value)?.description}
          </Text>
        </View>
      )}
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
  grid: {
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
  selectedInfo: {
    marginTop: 20,
    padding: 16,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: Colors.primary,
  },
  selectedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  selectedLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 4,
  },
  selectedDescription: {
    fontSize: 14,
    color: Colors.textMuted,
  },
});
