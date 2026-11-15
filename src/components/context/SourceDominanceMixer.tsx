import React, { useState, useRef } from 'react';
import { StyleSheet, Text, View, PanResponder } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, Spacing, Radius } from '../../theme/colors';
import { SourceDominance } from '../../types/recording';
import { t } from '../../i18n';

interface Props {
  value: SourceDominance;
  onChange: (value: SourceDominance) => void;
}

const SLIDER_WIDTH = 280;
const THUMB_SIZE = 24;

interface SliderProps {
  label: string;
  description: string;
  icon: keyof typeof MaterialIcons.glyphMap;
  color: string;
  value: number;
  onChange: (value: number) => void;
}

function SourceSlider({
  label,
  description,
  icon,
  color,
  value,
  onChange,
}: SliderProps) {
  const [localValue, setLocalValue] = useState(value);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        const { locationX } = evt.nativeEvent;
        const newValue = Math.round(Math.max(0, Math.min(100, (locationX / SLIDER_WIDTH) * 100)));
        setLocalValue(newValue);
        onChange(newValue);
      },
      onPanResponderMove: (evt) => {
        const { locationX } = evt.nativeEvent;
        const newValue = Math.round(Math.max(0, Math.min(100, (locationX / SLIDER_WIDTH) * 100)));
        setLocalValue(newValue);
        onChange(newValue);
      },
    })
  ).current;

  // Update local value when prop changes
  React.useEffect(() => {
    setLocalValue(value);
  }, [value]);

  return (
    <View style={styles.sliderContainer}>
      <View style={styles.sliderHeader}>
        <View style={styles.sliderLabelRow}>
          <MaterialIcons name={icon} size={18} color={color} />
          <Text style={styles.sliderLabel}>{label}</Text>
        </View>
        <Text style={[styles.sliderValue, { color }]}>{localValue}%</Text>
      </View>
      <Text style={styles.sliderDescription}>{description}</Text>

      <View style={styles.sliderTrackContainer} {...panResponder.panHandlers}>
        <View style={styles.sliderTrack}>
          <View
            style={[
              styles.sliderFill,
              { backgroundColor: color, width: `${localValue}%` },
            ]}
          />
        </View>
        <View
          style={[
            styles.sliderThumb,
            {
              backgroundColor: color,
              borderColor: color,
              left: (localValue / 100) * SLIDER_WIDTH - THUMB_SIZE / 2,
            },
          ]}
        />
      </View>
    </View>
  );
}

export default function SourceDominanceMixer({ value, onChange }: Props) {
  const [localValue, setLocalValue] = useState(value);

  // Normalize values to sum to 100
  const normalizeValues = (
    changed: keyof SourceDominance,
    newValue: number
  ): SourceDominance => {
    const others = (['biophony', 'geophony', 'anthrophony'] as const).filter(
      (k) => k !== changed
    );

    const remaining = 100 - newValue;
    const currentOthersSum = others.reduce((sum, k) => sum + localValue[k], 0);

    if (currentOthersSum === 0) {
      // Distribute remaining evenly
      const each = Math.floor(remaining / 2);
      return {
        biophony: changed === 'biophony' ? newValue : (others[0] === 'biophony' ? each : remaining - each),
        geophony: changed === 'geophony' ? newValue : (others[0] === 'geophony' ? each : remaining - each),
        anthrophony: changed === 'anthrophony' ? newValue : (others[0] === 'anthrophony' ? each : remaining - each),
      };
    }

    // Proportionally adjust others
    const ratio = remaining / currentOthersSum;
    const adjustedOthers = others.map((k) => Math.round(localValue[k] * ratio));

    // Handle rounding errors
    const adjustedSum = adjustedOthers.reduce((sum, v) => sum + v, 0);
    const diff = remaining - adjustedSum;
    adjustedOthers[0] += diff;

    const result: SourceDominance = {
      biophony: changed === 'biophony' ? newValue : (others[0] === 'biophony' ? Math.max(0, adjustedOthers[0]) : Math.max(0, adjustedOthers[1])),
      geophony: changed === 'geophony' ? newValue : (others[0] === 'geophony' ? Math.max(0, adjustedOthers[0]) : Math.max(0, adjustedOthers[1])),
      anthrophony: changed === 'anthrophony' ? newValue : (others[0] === 'anthrophony' ? Math.max(0, adjustedOthers[0]) : Math.max(0, adjustedOthers[1])),
    };
    return result;
  };

  const handleChange = (key: keyof SourceDominance, newValue: number) => {
    const normalized = normalizeValues(key, newValue);
    setLocalValue(normalized);
    onChange(normalized);
  };

  const total = localValue.biophony + localValue.geophony + localValue.anthrophony;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t('Sound Source Dominance')}</Text>
      <Text style={styles.subtitle}>
        {t('Adjust sliders to indicate the balance of sound sources. Total must equal 100%.')}
      </Text>

      <SourceSlider
        label="Biophony"
        description="Birds, insects, animals"
        icon="eco"
        color="#22C55E"
        value={localValue.biophony}
        onChange={(v) => handleChange('biophony', v)}
      />

      <SourceSlider
        label="Geophony"
        description="Wind, water, thunder"
        icon="air"
        color="#3B82F6"
        value={localValue.geophony}
        onChange={(v) => handleChange('geophony', v)}
      />

      <SourceSlider
        label="Anthrophony"
        description="Traffic, voices, machines"
        icon="directions-car"
        color="#F59E0B"
        value={localValue.anthrophony}
        onChange={(v) => handleChange('anthrophony', v)}
      />

      {/* Total indicator */}
      <View style={[styles.totalContainer, total !== 100 && styles.totalError]}>
        <Text style={styles.totalLabel}>{t('Total:')}</Text>
        <Text style={[styles.totalValue, total !== 100 && styles.totalValueError]}>
          {total}%
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
    marginBottom: 24,
    lineHeight: 20,
  },
  sliderContainer: {
    marginBottom: 24,
    backgroundColor: Colors.surface,
    padding: 16,
    borderRadius: 12,
  },
  sliderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  sliderLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sliderLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
  },
  sliderValue: {
    fontSize: 18,
    fontWeight: '700',
  },
  sliderDescription: {
    fontSize: 13,
    color: Colors.textMuted,
    marginBottom: 16,
  },
  sliderTrackContainer: {
    height: 40,
    justifyContent: 'center',
    position: 'relative',
  },
  sliderTrack: {
    height: 8,
    backgroundColor: Colors.surfaceHighlight,
    borderRadius: 4,
    overflow: 'hidden',
  },
  sliderFill: {
    height: '100%',
    borderRadius: 4,
  },
  sliderThumb: {
    position: 'absolute',
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    borderWidth: 3,
    backgroundColor: Colors.background,
    top: 8,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  totalContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    backgroundColor: Colors.surface,
    borderRadius: 8,
  },
  totalError: {
    backgroundColor: `${Colors.error}20`,
  },
  totalLabel: {
    fontSize: 16,
    color: Colors.textMuted,
  },
  totalValue: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.success,
  },
  totalValueError: {
    color: Colors.error,
  },
});
