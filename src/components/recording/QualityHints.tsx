import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, Radius } from '../../theme/colors';
import { QualityFlags } from '../../types/recording';

type IconName = keyof typeof MaterialIcons.glyphMap;

interface Props {
  flags: QualityFlags;
  showDetails?: boolean;
}

export default function QualityHints({ flags, showDetails = false }: Props) {
  const issues: { key: string; label: string; icon: IconName; description: string }[] = [];

  if (flags.hasClipping) {
    issues.push({
      key: 'clipping',
      label: 'Clipping',
      icon: 'warning',
      description: 'Audio levels exceeded maximum',
    });
  }

  if (flags.hasWindHandling) {
    issues.push({
      key: 'wind',
      label: 'Wind/Handling',
      icon: 'air',
      description: 'Wind or handling noise detected',
    });
  }

  if (flags.hasLowSNR) {
    issues.push({
      key: 'snr',
      label: 'Low Signal',
      icon: 'volume-off',
      description: 'Signal-to-noise ratio is low',
    });
  }

  if (issues.length === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      {issues.map((issue) => (
        <View key={issue.key} style={styles.row}>
          <View style={styles.iconWrap}>
            <MaterialIcons name={issue.icon} size={16} color={Colors.error} />
          </View>
          <View style={styles.textContainer}>
            <Text style={styles.label}>{issue.label}</Text>
            {showDetails && (
              <Text style={styles.description}>{issue.description}</Text>
            )}
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingHorizontal: 2,
    paddingVertical: 4,
  },
  iconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F2E6DA',
  },
  textContainer: {
    flex: 1,
  },
  label: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  description: {
    color: Colors.textMuted,
    fontSize: 12,
    marginTop: 3,
    lineHeight: 17,
  },
});
