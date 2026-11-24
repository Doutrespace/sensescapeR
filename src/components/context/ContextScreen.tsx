import React, { useRef, useState } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity } from 'react-native';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Colors, Spacing, Radius } from '../../theme/colors';
import { HabitatType, SettingContext } from '../../types/recording';
import {
  PERSON_ITEMS,
  RESPONDENT_ITEM,
  SITE_CODE_ITEM,
  VISIT_MODE_ITEM,
  type VisitMode,
} from '../../study/core';
import type { RespondentType } from '../../study/runData';
import {
  applyAnswerPatch,
  missingRequiredItems,
  type AnswerPatchInput,
  type Answers,
} from '../../study/types';
import { QuestionItem } from '../study/QuestionItem';
import HabitatSelector from './HabitatSelector';
import SettingChips from './SettingChips';
import { t } from '../../i18n';

const ACCENT = Colors.primary;
const SOFT = '#E7E1D4';

interface Props {
  habitatType: HabitatType | null;
  settingContext: SettingContext | null;
  visitMode: VisitMode | null;
  siteCode: string;
  respondent: RespondentType;
  /** Teil 1 answers of an interviewed person. */
  respondentPerson: Answers;
  respondentConsent: boolean;
  locationError?: string | null;
  onHabitatChange: (value: HabitatType) => void;
  onSettingContextChange: (value: SettingContext) => void;
  onVisitModeChange: (value: VisitMode | null) => void;
  onSiteCodeChange: (value: string) => void;
  onRespondentChange: (value: RespondentType) => void;
  onRespondentPersonChange: (value: Answers) => void;
  onRespondentConsentChange: (value: boolean) => void;
  onConfirm: () => void;
  onBack?: () => void;
}

/**
 * Last page of the main questionnaire: whether the person is passing by or
 * staying, who answered, and optional details about place and situation.
 */
export default function ContextScreen({
  habitatType,
  settingContext,
  visitMode,
  siteCode,
  respondent,
  respondentPerson,
  respondentConsent,
  locationError,
  onHabitatChange,
  onSettingContextChange,
  onVisitModeChange,
  onSiteCodeChange,
  onRespondentChange,
  onRespondentPersonChange,
  onRespondentConsentChange,
  onConfirm,
  onBack,
}: Props) {
  const tabBarHeight = useBottomTabBarHeight();
  const [showMissing, setShowMissing] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const latestPerson = useRef(respondentPerson);
  latestPerson.current = respondentPerson;

  const answers: Answers = {
    respondent,
    site_code: siteCode,
    ...(visitMode ? { visit_mode: visitMode } : {}),
  };

  const patchContext = (input: AnswerPatchInput) => {
    const change = typeof input === 'function' ? input(answers) : input;
    if ('visit_mode' in change) {
      const next = change.visit_mode;
      onVisitModeChange(next === 'passing' || next === 'staying' ? next : null);
    }
    if ('respondent' in change) {
      onRespondentChange(change.respondent === 'other' ? 'other' : 'self');
    }
    if ('site_code' in change) {
      onSiteCodeChange(typeof change.site_code === 'string' ? change.site_code : '');
    }
  };

  const patchPerson = (change: AnswerPatchInput) => {
    const next = applyAnswerPatch(latestPerson.current, change);
    latestPerson.current = next;
    onRespondentPersonChange(next);
  };

  const isInterview = respondent === 'other';
  const personMissing = isInterview
    && (missingRequiredItems(PERSON_ITEMS, respondentPerson).length > 0 || !respondentConsent);
  const isComplete = visitMode !== null && !personMissing;

  const handleContinue = () => {
    if (!isComplete) {
      setShowMissing(true);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      scrollRef.current?.scrollTo({ y: 0, animated: true });
      return;
    }
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onConfirm();
  };

  return (
    <View style={styles.container}>
      <ScrollView
        ref={scrollRef}
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>{t('Measurement Context')}</Text>
        <Text style={styles.subtitle}>
          {t('A few details about the situation of this measurement.')}
        </Text>

        {locationError && (
          <View style={styles.locationWarning}>
            <MaterialIcons name="location-off" size={20} color={Colors.warning} />
            <View style={styles.locationWarningContent}>
              <Text style={styles.locationWarningTitle}>{t('Location unavailable')}</Text>
              <Text style={styles.locationWarningText}>{locationError}</Text>
            </View>
          </View>
        )}

        <QuestionItem
          item={VISIT_MODE_ITEM}
          answers={answers}
          onPatch={patchContext}
          accentColor={ACCENT}
          softColor={SOFT}
          showMissing={showMissing}
        />

        <QuestionItem
          item={RESPONDENT_ITEM}
          answers={answers}
          onPatch={patchContext}
          accentColor={ACCENT}
          softColor={SOFT}
        />

        {isInterview ? (
          <View style={styles.interviewBlock}>
            <View style={styles.interviewHeader}>
              <MaterialCommunityIcons name="account-question-outline" size={20} color={Colors.text} />
              <Text style={styles.interviewTitle}>{t('About the person you interviewed')}</Text>
            </View>
            <Text style={styles.interviewText}>
              {t('Their details are stored with this measurement only, instead of your own.')}
            </Text>

            {PERSON_ITEMS.map((item) => (
              <QuestionItem
                key={item.key}
                item={item}
                answers={respondentPerson}
                onPatch={patchPerson}
                accentColor={ACCENT}
                softColor={SOFT}
                showMissing={showMissing}
              />
            ))}

            <TouchableOpacity
              style={[
                styles.consentToggle,
                respondentConsent && styles.consentToggleChecked,
                showMissing && !respondentConsent && styles.consentToggleMissing,
              ]}
              onPress={() => {
                void Haptics.selectionAsync();
                onRespondentConsentChange(!respondentConsent);
              }}
              activeOpacity={0.85}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: respondentConsent }}
              accessibilityLabel={t('The person agreed to take part and to their answers being stored.')}
            >
              <MaterialCommunityIcons
                name={respondentConsent ? 'checkbox-marked' : 'checkbox-blank-outline'}
                size={26}
                color={respondentConsent ? Colors.text : Colors.textDisabled}
              />
              <Text style={styles.consentToggleText}>
                {t('The person agreed to take part and to their answers being stored.')}
              </Text>
            </TouchableOpacity>
          </View>
        ) : null}

        <QuestionItem
          item={SITE_CODE_ITEM}
          answers={answers}
          onPatch={patchContext}
          accentColor={ACCENT}
          softColor={SOFT}
        />

        <View style={styles.optionalBlock}>
          <HabitatSelector value={habitatType} onChange={onHabitatChange} />
          <View style={styles.sectionDivider} />
          <SettingChips value={settingContext} onChange={onSettingContextChange} />
        </View>
      </ScrollView>

      <View style={[styles.actions, { paddingBottom: tabBarHeight + 16 }]}>
        {showMissing && !isComplete ? (
          <Text style={styles.actionsHint}>{t('Please answer the marked questions.')}</Text>
        ) : null}
        <View style={styles.actionsRow}>
          {onBack ? (
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
          ) : null}
          <TouchableOpacity
            style={styles.continueButton}
            onPress={handleContinue}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={t('Continue')}
            accessibilityHint={t('Finishes the main questionnaire')}
          >
            <Text style={styles.continueButtonText}>{t('Continue')}</Text>
            <MaterialIcons name="arrow-forward" size={22} color={Colors.background} />
          </TouchableOpacity>
        </View>
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
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.md,
    gap: 12,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.5,
    color: Colors.text,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    color: Colors.textMuted,
    textAlign: 'center',
    marginTop: -6,
    marginBottom: 4,
  },
  locationWarning: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 14,
    backgroundColor: `${Colors.warning}15`,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: `${Colors.warning}30`,
  },
  locationWarningContent: {
    flex: 1,
  },
  locationWarningTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 2,
  },
  locationWarningText: {
    fontSize: 13,
    color: Colors.textMuted,
    lineHeight: 18,
  },
  interviewBlock: {
    gap: 12,
    padding: 12,
    borderRadius: 24,
    backgroundColor: '#F2EFE9',
  },
  interviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 4,
    paddingTop: 4,
  },
  interviewTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '800',
    color: Colors.text,
  },
  interviewText: {
    fontSize: 13,
    lineHeight: 18,
    color: Colors.textMuted,
    paddingHorizontal: 4,
    marginTop: -6,
  },
  consentToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 56,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: Colors.surfaceHighlight,
    backgroundColor: Colors.surface,
  },
  consentToggleChecked: {
    borderColor: Colors.text,
  },
  consentToggleMissing: {
    borderColor: Colors.error,
  },
  consentToggleText: {
    flex: 1,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '700',
    color: Colors.text,
  },
  optionalBlock: {
    paddingTop: Spacing.sm,
  },
  sectionDivider: {
    height: Spacing.md,
  },
  actions: {
    paddingHorizontal: Spacing.md,
    paddingTop: 12,
    gap: 8,
    backgroundColor: Colors.background,
    borderTopWidth: 1,
    borderTopColor: Colors.surfaceHighlight,
  },
  actionsHint: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.error,
    textAlign: 'center',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
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
  continueButton: {
    flex: 1,
    height: 58,
    borderRadius: 29,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.text,
  },
  continueButtonText: {
    color: Colors.background,
    fontSize: 18,
    fontWeight: '800',
  },
});
