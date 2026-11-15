import React, { useMemo } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { Colors, Radius, Spacing } from '../../theme/colors';
import { SoundClassification } from '../../hooks/useAudioClassifier';
import { MacroClassification } from '../../utils/audioClassification';
import { t } from '../../i18n';

interface ResultsPanelProps {
  classifications: SoundClassification[];
  broadClassifications: SoundClassification[];
  macroClassifications: MacroClassification[];
  isLoading: boolean;
  isReady: boolean;
  error: string | null;
  progressPct: number;
  remainingLabel: string;
  durationLabel: string;
  locationLabel: string;
  bottomInset: number;
}

function ClassRow({ item }: { item: SoundClassification }) {
  const repeated = item.occurrenceCount > 1;
  return (
    <View style={[styles.row, repeated && styles.rowRepeated, { borderLeftColor: item.accentColor }]}>
      <View style={styles.rowBody}>
        <View style={styles.rowHeader}>
          <View style={styles.rowLabelWrap}>
            <View style={styles.rowLabelLine}>
              <Text style={styles.rowLabel} numberOfLines={2} ellipsizeMode="tail">
                {t(item.label)}
              </Text>
              {repeated ? (
                <View style={styles.repeatBadge}>
                  <Text style={styles.repeatBadgeText}>{item.occurrenceCount}x</Text>
                </View>
              ) : null}
            </View>
            <Text style={styles.rowFamily} numberOfLines={1}>
              {item.macroFamily}
            </Text>
          </View>
          <Text style={styles.rowScore}>{Math.round(item.adjustedScore * 100)}%</Text>
        </View>
        <View style={[styles.rowTrack, { backgroundColor: item.trackColor }]}>
          <View
            style={[
              styles.rowFill,
              {
                width: `${Math.max(0, Math.min(100, item.adjustedScore * 100))}%`,
                backgroundColor: item.accentColor,
              },
            ]}
          />
        </View>
      </View>
    </View>
  );
}

export function ResultsPanel({
  classifications,
  broadClassifications,
  macroClassifications,
  isLoading,
  isReady,
  error,
  progressPct,
  remainingLabel,
  durationLabel,
  locationLabel,
  bottomInset,
}: ResultsPanelProps) {
  const sorted = useMemo(
    () => [...classifications].sort((left, right) => (
      right.adjustedScore - left.adjustedScore || right.score - left.score
    )),
    [classifications]
  );
  const specificRows = sorted.slice(0, 4);
  const broadRows = useMemo(
    () => [...broadClassifications].sort((left, right) => (
      right.adjustedScore - left.adjustedScore || right.score - left.score
    )).slice(0, 4),
    [broadClassifications]
  );
  const topDetection = specificRows[0] ?? null;

  const header = (
    <View style={styles.headerBlock}>
      <View style={styles.resultsHeader}>
        <Text style={styles.resultsTitle}>{t('Results')}</Text>
        <Text style={styles.resultsMeta}>{locationLabel}</Text>
      </View>

      <View style={styles.statusRow}>
        <View style={styles.statusChip}>
          <View style={styles.liveDot} />
          <Text style={styles.statusChipText}>{t('Recording {duration}', { duration: durationLabel })}</Text>
        </View>
        <Text style={styles.remainingText}>{t('{duration} remaining', { duration: remainingLabel })}</Text>
      </View>

      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${Math.max(0, Math.min(100, progressPct))}%` }]} />
      </View>

      {macroClassifications.length > 0 && (
        <View style={styles.macroRow}>
          {macroClassifications.map((item, index) => (
            <View
              key={`${t(item.label)}-${index}`}
              style={[
                styles.macroChip,
                {
                  backgroundColor: index === 0 ? Colors.surface : Colors.background,
                },
              ]}
            >
              <Text style={styles.macroChipLabel}>{t(item.label)}</Text>
              <Text style={styles.macroChipScore}>{Math.round(item.score * 100)}%</Text>
            </View>
          ))}
        </View>
      )}

      {(specificRows.length > 0 || broadRows.length > 0) && (
        <View style={styles.dualPanel}>
          <View style={styles.panelColumn}>
            <View style={styles.panelHeader}>
              <Text style={styles.panelEyebrow}>{t('Specific classes')}</Text>
              {topDetection ? (
                <Text style={styles.panelMeta}>{t('{percent}% top', { percent: Math.round(topDetection.adjustedScore * 100) })}</Text>
              ) : null}
            </View>
            <View style={styles.panelBody}>
              {specificRows.map((item) => (
                <View key={item.rawLabel} style={styles.panelRowWrap}>
                  <ClassRow item={item} />
                </View>
              ))}
            </View>
          </View>

          <View style={styles.panelColumn}>
            <View style={styles.panelHeader}>
              <Text style={styles.panelEyebrow}>{t('Higher hierarchy')}</Text>
              {broadRows.length > 0 ? (
                <Text style={styles.panelMeta}>{broadRows.length}</Text>
              ) : null}
            </View>
            <View style={styles.panelBody}>
              {broadRows.length > 0 ? (
                broadRows.map((item) => (
                  <View key={item.rawLabel} style={styles.panelRowWrap}>
                    <ClassRow item={item} />
                  </View>
                ))
              ) : (
                <Text style={styles.panelEmptyText}>{t('No confident broad labels yet.')}</Text>
              )}
            </View>
          </View>
        </View>
      )}

      {!topDetection && !error && (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>
            {isLoading ? t('Initializing YAMNet…') : isReady ? t('Listening…') : t('Loading…')}
          </Text>
        </View>
      )}

      {error && (
        <View style={styles.errorState}>
          <Text style={styles.errorText}>⚠ {error.slice(0, 80)}</Text>
        </View>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={[]}
        keyExtractor={(_, index) => `empty-${index}`}
        renderItem={() => null}
        ListHeaderComponent={header}
        style={styles.list}
        contentContainerStyle={[styles.listContent, { paddingBottom: bottomInset }]}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
  },
  headerBlock: {
    marginBottom: 10,
  },
  resultsHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  resultsTitle: {
    fontSize: 30,
    fontWeight: '800',
    letterSpacing: -0.8,
    color: Colors.text,
  },
  resultsMeta: {
    // Shrinks and wraps so a long (translated) status never runs into the title.
    flex: 1,
    marginLeft: 12,
    textAlign: 'right',
    fontSize: 12,
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
    marginBottom: 10,
  },
  statusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.surfaceHighlight,
    borderRadius: Radius.full,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#C07D72',
  },
  statusChipText: {
    color: Colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  remainingText: {
    fontSize: 13,
    color: Colors.textMuted,
    fontWeight: '600',
  },
  progressTrack: {
    height: 5,
    borderRadius: Radius.full,
    backgroundColor: '#DED7CA',
    overflow: 'hidden',
    marginBottom: 14,
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.primary,
  },
  macroRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 10,
  },
  macroChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.surfaceHighlight,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  macroChipLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.text,
  },
  macroChipScore: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textMuted,
  },
  dualPanel: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 8,
  },
  panelColumn: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.surfaceHighlight,
    borderRadius: Radius.md,
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    // Longer (translated) headings wrap instead of running into the count.
    flexWrap: 'wrap',
    columnGap: 6,
    marginBottom: 8,
  },
  panelEyebrow: {
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    color: Colors.textMuted,
    fontWeight: '700',
  },
  panelMeta: {
    fontSize: 10,
    color: Colors.textMuted,
    fontWeight: '700',
  },
  panelBody: {
    gap: 5,
  },
  panelRowWrap: {
    minHeight: 40,
  },
  panelEmptyText: {
    fontSize: 13,
    lineHeight: 18,
    color: Colors.textMuted,
  },
  row: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 9,
    paddingVertical: 6,
    backgroundColor: Colors.background,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.surfaceHighlight,
    borderLeftWidth: 3,
  },
  rowBody: {
    flex: 1,
    gap: 4,
  },
  rowHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
  },
  rowLabelWrap: {
    flex: 1,
    gap: 2,
  },
  rowLabelLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  rowLabel: {
    fontSize: 13,
    lineHeight: 15,
    fontWeight: '600',
    color: Colors.text,
    flexShrink: 1,
  },
  rowRepeated: {
    backgroundColor: '#FFF8E0',
  },
  repeatBadge: {
    borderRadius: Radius.full,
    backgroundColor: 'rgb(225,173,1)',
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  repeatBadgeText: {
    color: '#4A3712',
    fontSize: 10,
    fontWeight: '800',
  },
  rowFamily: {
    fontSize: 9,
    fontWeight: '700',
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  rowScore: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.text,
    minWidth: 34,
    textAlign: 'right',
  },
  rowTrack: {
    height: 3,
    borderRadius: Radius.full,
    overflow: 'hidden',
    backgroundColor: '#DED7CA',
  },
  rowFill: {
    height: '100%',
    backgroundColor: Colors.primary,
  },
  emptyState: {
    padding: 18,
    borderRadius: Radius.xl,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.surfaceHighlight,
  },
  emptyText: {
    fontSize: 14,
    color: Colors.textMuted,
  },
  errorState: {
    padding: 14,
    borderRadius: Radius.lg,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: '#E4D1BE',
  },
  errorText: {
    fontSize: 13,
    color: Colors.error,
  },
});
