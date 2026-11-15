import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Colors } from '../../theme/colors';

interface Props {
  min: number;
  max: number;
  /** null = not rated yet. */
  value: number | null;
  onChange: (value: number) => void;
  accentColor: string;
  accessibilityLabel: string;
}

/**
 * One-tap rating scale: a row of numbered dots. Quicker than a slider when
 * many items are rated in a row, and every dot is a full-size touch target.
 */
export function DotScale({ min, max, value, onChange, accentColor, accessibilityLabel }: Props) {
  const points = Array.from({ length: max - min + 1 }, (_, index) => min + index);

  return (
    <View style={styles.row} accessibilityRole="radiogroup" accessibilityLabel={accessibilityLabel}>
      {points.map((point) => {
        const isSelected = value === point;
        const isBelow = value !== null && point < value;

        return (
          <TouchableOpacity
            key={point}
            style={styles.touchTarget}
            onPress={() => {
              void Haptics.selectionAsync();
              onChange(point);
            }}
            activeOpacity={0.7}
            accessibilityRole="radio"
            accessibilityLabel={`${point} of ${max}`}
            accessibilityState={{ selected: isSelected }}
          >
            <View
              style={[
                styles.dot,
                isBelow && { backgroundColor: `${accentColor}33`, borderColor: `${accentColor}66` },
                isSelected && { backgroundColor: accentColor, borderColor: accentColor },
              ]}
            >
              <Text style={[styles.dotText, isBelow && { color: accentColor }, isSelected && styles.dotTextSelected]}>
                {point}
              </Text>
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  touchTarget: {
    flex: 1,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#DCD5C7',
  },
  dotText: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textMuted,
    fontVariant: ['tabular-nums'],
  },
  dotTextSelected: {
    color: '#FFFFFF',
  },
});
