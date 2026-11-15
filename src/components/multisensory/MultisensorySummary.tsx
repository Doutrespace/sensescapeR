import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Colors, Radius, Spacing } from '../../theme/colors';
import {
  ENVIRONMENT_ITEMS,
  MULTISENSORY_MODULES,
  MultisensoryAssessment,
  MultisensoryModuleKey,
  RESTORATIVENESS_ITEMS,
  SAM_SCALE,
  SMELL_SOURCES,
  ScaleItem,
  THERMAL_ITEMS,
  VISUAL_ITEMS,
} from '../../types/multisensory';
import { t } from '../../i18n';

interface Props {
  assessment: MultisensoryAssessment | null;
}

interface Row {
  label: string;
  value: string;
  /** 0..1 position on the scale, for the bar. Omitted for text-only rows. */
  ratio?: number;
}

const SCALE_ITEMS: Partial<Record<MultisensoryModuleKey, ScaleItem[]>> = {
  visual: VISUAL_ITEMS,
  thermal: THERMAL_ITEMS,
  restorativeness: RESTORATIVENESS_ITEMS,
  environment: ENVIRONMENT_ITEMS,
};

function scaleRows(items: ScaleItem[], values: Record<string, number | undefined>): Row[] {
  return items
    .filter((item) => typeof values[item.key] === 'number')
    .map((item) => {
      const value = values[item.key]!;
      const anchor = item.valueLabels?.[value];
      const number = item.bipolar && value > 0 ? `+${value}` : String(value);
      return {
        label: t(item.label),
        value: anchor ? `${t(anchor)} (${number})` : `${number} / ${item.max}`,
        ratio: (value - item.min) / (item.max - item.min),
      };
    });
}

function rowsForModule(assessment: MultisensoryAssessment, moduleKey: MultisensoryModuleKey): Row[] {
  if (moduleKey === 'smell') {
    const smell = assessment.smell ?? {};
    const rows: Row[] = [];
    if (typeof smell.pleasantness === 'number') {
      rows.push({
        label: t('Pleasantness'),
        value: `${smell.pleasantness > 0 ? '+' : ''}${Math.round(smell.pleasantness * 100)}%`,
        ratio: (smell.pleasantness + 1) / 2,
      });
    }
    if (typeof smell.intensity === 'number') {
      rows.push({
        label: t('Intensity'),
        value: `${Math.round(smell.intensity * 100)}%`,
        ratio: smell.intensity,
      });
    }
    if (smell.sources && smell.sources.length > 0) {
      rows.push({
        label: t('Sources'),
        value: smell.sources
          .map((key) => t(SMELL_SOURCES.find((source) => source.key === key)?.label ?? key))
          .join(', '),
      });
    }
    return rows;
  }

  if (moduleKey === 'emotion') {
    const emotion = assessment.emotion ?? {};
    const span = SAM_SCALE.max - SAM_SCALE.min;
    return ([
      [t('Pleasure'), emotion.valence],
      [t('Arousal'), emotion.arousal],
      [t('Dominance'), emotion.dominance],
    ] as Array<[string, number | undefined]>)
      .filter(([, value]) => typeof value === 'number')
      .map(([label, value]) => ({
        label,
        value: `${value} / ${SAM_SCALE.max}`,
        ratio: (value! - SAM_SCALE.min) / span,
      }));
  }

  return scaleRows(
    SCALE_ITEMS[moduleKey] ?? [],
    (assessment[moduleKey] ?? {}) as Record<string, number | undefined>
  );
}

/** Read-only overview of a saved multisensory assessment. */
export function MultisensorySummary({ assessment }: Props) {
  if (!assessment) {
    return null;
  }

  const modules = MULTISENSORY_MODULES
    .map((module) => ({ module, rows: rowsForModule(assessment, module.key) }))
    .filter(({ rows }) => rows.length > 0);

  if (modules.length === 0) {
    return null;
  }

  return (
    <View style={styles.card}>
      {modules.map(({ module, rows }, index) => (
        <View key={module.key} style={[styles.module, index > 0 && styles.moduleDivider]}>
          <Text style={styles.moduleTitle}>{t(module.title)}</Text>
          <Text style={styles.moduleFramework}>{t(module.framework)}</Text>
          {rows.map((row) => (
            <View key={row.label} style={styles.row}>
              <Text style={styles.rowLabel}>{row.label}</Text>
              {typeof row.ratio === 'number' ? (
                <View style={styles.barTrack}>
                  <View style={[styles.barFill, { width: `${Math.max(4, row.ratio * 100)}%` }]} />
                </View>
              ) : null}
              <Text
                style={[styles.rowValue, typeof row.ratio !== 'number' && styles.rowValueWide]}
                numberOfLines={typeof row.ratio === 'number' ? 2 : 4}
              >
                {row.value}
              </Text>
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.surfaceHighlight,
  },
  module: {
    gap: 6,
  },
  moduleDivider: {
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.surfaceHighlight,
  },
  moduleTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
  },
  moduleFramework: {
    fontSize: 12,
    color: Colors.textMuted,
    marginBottom: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 24,
  },
  rowLabel: {
    width: 104,
    fontSize: 13,
    color: Colors.text,
  },
  barTrack: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.surfaceHighlight,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: Colors.secondary,
  },
  rowValue: {
    width: 96,
    fontSize: 12,
    fontWeight: '600',
    color: Colors.text,
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },
  rowValueWide: {
    flex: 1,
    width: undefined,
    textAlign: 'left',
  },
});
