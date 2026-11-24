import React, { useMemo, useState } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors } from '../../theme/colors';
import { t, tPlural } from '../../i18n';
import { personSections, runSections } from '../../study/groups';
import { allItems, openClosedItems, tx, type Answers, type StudyGroup } from '../../study/types';
import { QuestionnairePager } from './QuestionnairePager';

interface Props {
  group: StudyGroup;
  answers: Answers;
  onChange: (answers: Answers) => void;
  /**
   * True when the group's personal questions ("asked once") are already
   * stored for the person answering, so they are skipped this time.
   */
  personAlreadyAnswered: boolean;
  onBack: () => void;
  onSave: () => void;
}

/**
 * The questions of one project group, taken from the questionnaire the group
 * handed in (see study/groups). Shown after the main questionnaire.
 */
export default function GroupQuestionnaire({
  group,
  answers,
  onChange,
  personAlreadyAnswered,
  onBack,
  onSave,
}: Props) {
  const tabBarHeight = useBottomTabBarHeight();
  const hasPersonSections = personSections(group).length > 0;
  const [showPerson, setShowPerson] = useState(!personAlreadyAnswered);

  const sections = useMemo(
    () => (showPerson ? group.sections : runSections(group)),
    [group, showPerson]
  );

  const handleComplete = () => {
    const open = openClosedItems(allItems(sections), answers).length;
    if (open === 0) {
      onSave();
      return;
    }

    Alert.alert(
      t('Some questions are still open'),
      tPlural(
        open,
        '{count} question has no answer yet. Save the measurement anyway?',
        '{count} questions have no answer yet. Save the measurement anyway?'
      ),
      [
        { text: t('Back to the questions'), style: 'cancel' },
        { text: t('Save anyway'), onPress: onSave },
      ]
    );
  };

  const personNote = !showPerson && hasPersonSections ? (
    <TouchableOpacity
      style={styles.personNote}
      onPress={() => setShowPerson(true)}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={t('Change the personal details asked once')}
    >
      <MaterialCommunityIcons name="account-circle-outline" size={20} color={Colors.textMuted} />
      <Text style={styles.personNoteText}>
        {t('The personal questions of this group are already answered.')}{' '}
        <Text style={styles.personNoteLink}>{t('Change')}</Text>
      </Text>
    </TouchableOpacity>
  ) : null;

  return (
    <QuestionnairePager
      // Start again on the first page when the personal questions are added.
      key={showPerson ? 'with-person' : 'run-only'}
      sections={sections}
      answers={answers}
      onChange={onChange}
      icon={group.icon}
      color={group.color}
      softColor={group.softColor}
      eyebrow={tx(group.topic)}
      bottomInset={tabBarHeight + 16}
      completeLabel={t('Save measurement')}
      onComplete={handleComplete}
      onExit={onBack}
      firstPageNote={personNote}
    />
  );
}

const styles = StyleSheet.create({
  personNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 48,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.surfaceHighlight,
    backgroundColor: Colors.surface,
  },
  personNoteText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 19,
    color: Colors.textMuted,
  },
  personNoteLink: {
    fontWeight: '700',
    color: Colors.text,
    textDecorationLine: 'underline',
  },
});
