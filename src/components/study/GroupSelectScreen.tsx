import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Colors, Spacing } from '../../theme/colors';
import { t, tPlural } from '../../i18n';
import { runSections } from '../../study/groups';
import { allItems, tx, type StudyGroup } from '../../study/types';

type IconName = keyof typeof MaterialCommunityIcons.glyphMap;

interface Props {
  groups: StudyGroup[];
  /** Group chosen at the previous measurement; listed first. */
  lastGroupId: string | null;
  onSelect: (group: StudyGroup) => void;
  /** Save the measurement with the main questionnaire only. */
  onSaveWithoutGroup: () => void;
  onBack: () => void;
}

/**
 * The fork after the main questionnaire: every project group of the course,
 * shown by its topic. Choosing one continues with that group's own
 * questions; the measurement can also be saved without them.
 */
export default function GroupSelectScreen({
  groups,
  lastGroupId,
  onSelect,
  onSaveWithoutGroup,
  onBack,
}: Props) {
  const tabBarHeight = useBottomTabBarHeight();

  const ordered = useMemo(() => {
    const last = groups.find((group) => group.id === lastGroupId);
    return last ? [last, ...groups.filter((group) => group.id !== lastGroupId)] : groups;
  }, [groups, lastGroupId]);

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View style={styles.headerBadge}>
            <MaterialCommunityIcons name="check-decagram" size={18} color={Colors.success} />
            <Text style={styles.headerBadgeText}>{t('Main questionnaire complete')}</Text>
          </View>
          <Text style={styles.title}>{t('Your project group')}</Text>
          <Text style={styles.subtitle}>
            {t('Choose your group to continue with the questions of your own project.')}
          </Text>
        </View>

        {ordered.map((group) => {
          const questionCount = allItems(runSections(group)).length;
          const isLast = group.id === lastGroupId;
          return (
            <TouchableOpacity
              key={group.id}
              style={[styles.card, isLast && { borderColor: group.color, borderWidth: 2 }]}
              onPress={() => {
                void Haptics.selectionAsync();
                onSelect(group);
              }}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel={tx(group.topic)}
              accessibilityHint={t('Continues with the questions of this group')}
            >
              <View style={[styles.cardIcon, { backgroundColor: group.color }]}>
                <MaterialCommunityIcons name={group.icon as IconName} size={26} color="#FFFFFF" />
              </View>
              <View style={styles.cardText}>
                {isLast ? (
                  <Text style={[styles.cardEyebrow, { color: group.color }]}>{t('Last chosen')}</Text>
                ) : null}
                <Text style={styles.cardTitle}>{tx(group.topic)}</Text>
                <Text style={styles.cardMeta}>
                  {tPlural(questionCount, '{count} question', '{count} questions')}
                </Text>
              </View>
              <MaterialIcons name="chevron-right" size={26} color={Colors.textDisabled} />
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: tabBarHeight + 16 }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => {
            void Haptics.selectionAsync();
            onBack();
          }}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel={t('Back')}
        >
          <MaterialIcons name="arrow-back" size={22} color={Colors.text} />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.saveButton}
          onPress={() => {
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            onSaveWithoutGroup();
          }}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel={t('Save without group questions')}
        >
          <Text style={styles.saveButtonText}>{t('Save without group questions')}</Text>
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
    paddingTop: 4,
    paddingBottom: Spacing.lg,
    gap: 10,
  },
  header: {
    gap: 6,
    paddingHorizontal: 4,
    paddingBottom: 6,
  },
  headerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerBadgeText: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: Colors.success,
  },
  title: {
    fontSize: 26,
    lineHeight: 31,
    fontWeight: '800',
    letterSpacing: -0.5,
    color: Colors.text,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 21,
    color: Colors.textMuted,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.surfaceHighlight,
    backgroundColor: Colors.surface,
  },
  cardIcon: {
    width: 52,
    height: 52,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardText: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  cardEyebrow: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  cardTitle: {
    fontSize: 16,
    lineHeight: 21,
    fontWeight: '700',
    color: Colors.text,
  },
  cardMeta: {
    fontSize: 12,
    color: Colors.textDisabled,
    marginTop: 2,
  },
  footer: {
    flexDirection: 'row',
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.surfaceHighlight,
    backgroundColor: Colors.background,
    paddingTop: 12,
    paddingHorizontal: Spacing.md,
  },
  backButton: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.surfaceHighlight,
  },
  saveButton: {
    flex: 1,
    minHeight: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    backgroundColor: Colors.surface,
    borderWidth: 1.5,
    borderColor: Colors.text,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
    textAlign: 'center',
  },
});
