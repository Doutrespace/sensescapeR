import React, { useEffect, useRef } from 'react';
import { Animated, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import { Colors, Spacing } from '../../theme/colors';
import { t } from '../../i18n';
import { formatDate } from '../../i18n/dates';
import { getStudyGroup } from '../../study/groups';
import { tx } from '../../study/types';
import type { SavedRunSummary } from '../../stores/useRecordingStore';

type IconName = keyof typeof MaterialCommunityIcons.glyphMap;

interface Props {
  summary: SavedRunSummary;
  participantCode: string;
  /** Whether measurements are also uploaded to the course database. */
  cloudConfigured: boolean;
  onNewMeasurement: () => void;
  onOpenMap: () => void;
  onExport: () => void;
  onGoHome: () => void;
}

/** Shown after a measurement was saved: what was stored, and what to do next. */
export default function DoneScreen({
  summary,
  participantCode,
  cloudConfigured,
  onNewMeasurement,
  onOpenMap,
  onExport,
  onGoHome,
}: Props) {
  const tabBarHeight = useBottomTabBarHeight();
  const pop = useRef(new Animated.Value(0)).current;
  const group = getStudyGroup(summary.groupId);

  useEffect(() => {
    Animated.spring(pop, {
      toValue: 1,
      friction: 5,
      tension: 120,
      useNativeDriver: true,
    }).start();
  }, [pop]);

  const rows: Array<{ icon: IconName; label: string; value: string }> = [
    {
      icon: 'clock-outline',
      label: t('Recorded'),
      value: `${formatDate(new Date(summary.recordedAt), 'short')}, ${formatDate(new Date(summary.recordedAt), 'time')}`,
    },
    {
      icon: summary.hasLocation ? 'map-marker-outline' : 'map-marker-off-outline',
      label: t('Location'),
      value: summary.hasLocation ? t('Stored with the measurement') : t('Not stored'),
    },
    {
      icon: 'account-group-outline',
      label: t('Project group'),
      value: group
        ? `${tx(group.topic)} · ${t('{answered} of {total} answered', {
          answered: summary.answeredGroupItems,
          total: summary.totalGroupItems,
        })}`
        : t('Main questionnaire only'),
    },
    {
      icon: 'identifier',
      label: t('Participant code'),
      value: participantCode,
    },
  ];

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View
          style={[
            styles.checkWrap,
            { transform: [{ scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }) }], opacity: pop },
          ]}
        >
          <MaterialIcons name="check" size={44} color="#FFFFFF" />
        </Animated.View>

        <Text style={styles.eyebrow}>{t('Measurement no. {number}', { number: summary.runNumber })}</Text>
        <Text style={styles.title}>{t('Measurement saved')}</Text>
        <Text style={styles.subtitle}>{t('Thank you. Every measurement makes the picture of this city more complete.')}</Text>

        <View style={styles.card}>
          {rows.map((row, index) => (
            <View key={row.label} style={[styles.row, index > 0 && styles.rowDivider]}>
              <MaterialCommunityIcons name={row.icon} size={20} color={Colors.textMuted} />
              <View style={styles.rowText}>
                <Text style={styles.rowLabel}>{row.label}</Text>
                <Text style={styles.rowValue}>{row.value}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.notice}>
          <MaterialCommunityIcons name="database-outline" size={18} color={Colors.textMuted} />
          <Text style={styles.noticeText}>
            {cloudConfigured
              ? t('The measurement is stored on this device and is uploaded to the course database when you are online.')
              : t('The measurement is stored on this device only. Export your data regularly so that nothing gets lost.')}
          </Text>
        </View>

        <View style={styles.secondaryRow}>
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={onOpenMap}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={t('Show on my map')}
          >
            <MaterialCommunityIcons name="map-marker-multiple-outline" size={20} color={Colors.text} />
            <Text style={styles.secondaryButtonText}>{t('My map')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={onExport}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={t('Export all measurements as CSV')}
          >
            <MaterialCommunityIcons name="file-delimited-outline" size={20} color={Colors.text} />
            <Text style={styles.secondaryButtonText}>{t('Export CSV')}</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.homeLink}
          onPress={onGoHome}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={t('Back to the start screen')}
        >
          <Text style={styles.homeLinkText}>{t('Back to the start screen')}</Text>
        </TouchableOpacity>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: tabBarHeight + 16 }]}>
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={onNewMeasurement}
          activeOpacity={0.9}
          accessibilityRole="button"
          accessibilityLabel={t('Start a new measurement')}
        >
          <MaterialIcons name="mic-none" size={22} color="#FFFFFF" />
          <Text style={styles.primaryButtonText}>{t('New measurement')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.lg,
    alignItems: 'center',
    gap: 10,
  },
  checkWrap: {
    width: 84,
    height: 84,
    borderRadius: 42,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.success,
    marginBottom: 6,
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: Colors.success,
  },
  title: {
    fontSize: 28,
    lineHeight: 33,
    fontWeight: '800',
    letterSpacing: -0.5,
    color: Colors.text,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 21,
    color: Colors.textMuted,
    textAlign: 'center',
    paddingHorizontal: Spacing.sm,
    marginBottom: 6,
  },
  card: {
    alignSelf: 'stretch',
    backgroundColor: Colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.surfaceHighlight,
    paddingHorizontal: Spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
  },
  rowDivider: {
    borderTopWidth: 1,
    borderTopColor: Colors.surfaceHighlight,
  },
  rowText: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  rowLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: Colors.textMuted,
  },
  rowValue: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '600',
    color: Colors.text,
  },
  notice: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 14,
    borderRadius: 16,
    backgroundColor: '#ECE6DA',
  },
  noticeText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    color: Colors.textMuted,
  },
  secondaryRow: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    gap: 10,
  },
  secondaryButton: {
    flex: 1,
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 12,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: Colors.surfaceHighlight,
    backgroundColor: Colors.surface,
  },
  secondaryButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
  },
  homeLink: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  homeLinkText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textMuted,
    textDecorationLine: 'underline',
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: Colors.surfaceHighlight,
    backgroundColor: Colors.background,
    paddingTop: 12,
    paddingHorizontal: Spacing.md,
  },
  primaryButton: {
    height: 58,
    borderRadius: 29,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.text,
  },
  primaryButtonText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});
