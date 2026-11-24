import React, { useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Colors, Spacing } from '../../theme/colors';
import { t } from '../../i18n';
import { PERSON_ITEMS, PERSON_SECTION_TITLE } from '../../study/core';
import {
  applyAnswerPatch,
  missingRequiredItems,
  tx,
  type AnswerPatchInput,
  type Answers,
} from '../../study/types';
import { useParticipantStore } from '../../stores/useParticipantStore';
import { toParticipantCode } from '../../utils/ids';
import { isSupabaseConfigured } from '../../utils/supabase';
import { QuestionItem } from '../study/QuestionItem';

const ACCENT = Colors.accent;
const SOFT = Colors.accentSoft;

interface Props {
  /**
   * 'setup': first use, with the information and consent block.
   * 'edit': change the personal details later (consent was already given).
   */
  mode: 'setup' | 'edit';
  /** Space below the button (tab bar or safe area). */
  bottomInset: number;
  onDone: () => void;
  onCancel?: () => void;
}

interface ConsentPoint {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  text: string;
  /** Wording used instead when measurements are uploaded to the course database. */
  cloudText?: string;
}

/**
 * Information shown before the consent checkbox. Any change to this text needs
 * a new CONSENT_VERSION (study/core), so everybody agrees to the new wording.
 */
const CONSENT_POINTS: ConsentPoint[] = [
  {
    icon: 'school-outline',
    text: 'This app is used in a university course to study how places are perceived with all senses.',
  },
  {
    icon: 'microphone-outline',
    text: 'Each measurement stores a 30-second sound recording, the exact location, the time, an optional photo, your answers and technical details of the device (e.g. browser, microphone settings).',
  },
  {
    icon: 'identifier',
    text: 'You are identified only by a random participant code. Your name is not collected.',
  },
  {
    icon: 'database-outline',
    text: 'The data stays on this device until you export it and hand it in for the course.',
    cloudText: 'Measurements are stored on this device and uploaded to the course database.',
  },
  {
    icon: 'chart-box-outline',
    text: 'The data of all participants are combined, analysed by the course leaders and the students of the course, and used for scientific publications. Only anonymised results are published. The data are stored for at least six months.',
  },
  {
    icon: 'hand-heart-outline',
    text: 'Taking part is voluntary. You can delete the data on this device at any time in the Profile tab. For data you have already handed in or uploaded, a message with your participant code to the course leaders is enough.',
  },
  {
    icon: 'account-voice-off',
    text: 'Please do not record private conversations, and do not photograph people in a way that makes them recognisable.',
  },
];

/**
 * Teil 1 of the questionnaire: the personal details that are asked once and
 * stored with every measurement, preceded on first use by the information
 * about the study and the consent.
 */
export default function ParticipantSetupScreen({ mode, bottomInset, onDone, onCancel }: Props) {
  const participantId = useParticipantStore((state) => state.participantId);
  const storedAnswers = useParticipantStore((state) => state.personAnswers);
  const completeSetup = useParticipantStore((state) => state.completeSetup);
  const updatePersonAnswers = useParticipantStore((state) => state.updatePersonAnswers);

  const [answers, setAnswers] = useState<Answers>(storedAnswers);
  const [consentChecked, setConsentChecked] = useState(mode === 'edit');
  const [showMissing, setShowMissing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const latestAnswers = useRef(answers);
  const scrollRef = useRef<ScrollView>(null);

  const patch = (change: AnswerPatchInput) => {
    const next = applyAnswerPatch(latestAnswers.current, change);
    latestAnswers.current = next;
    setAnswers(next);
  };

  const missing = missingRequiredItems(PERSON_ITEMS, answers);
  const isComplete = missing.length === 0 && consentChecked;

  const handleSubmit = async () => {
    if (!isComplete) {
      setShowMissing(true);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      if (!consentChecked) {
        scrollRef.current?.scrollTo({ y: 0, animated: true });
      }
      return;
    }

    setIsSaving(true);
    try {
      if (mode === 'setup') {
        await completeSetup(answers);
      } else {
        await updatePersonAnswers(answers);
      }
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onDone();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView
        ref={scrollRef}
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[styles.hero, { backgroundColor: SOFT }]}>
          <View pointerEvents="none" style={styles.heroBackdrop}>
            <MaterialCommunityIcons name="account-circle-outline" size={150} color={ACCENT} />
          </View>
          <View style={styles.heroTop}>
            <View style={[styles.heroIconWrap, { backgroundColor: ACCENT }]}>
              <MaterialCommunityIcons name="account-circle-outline" size={28} color="#FFFFFF" />
            </View>
            <View style={styles.heroTitles}>
              <Text style={[styles.heroEyebrow, { color: ACCENT }]}>
                {mode === 'setup' ? t('Before you start') : t('Personal details')}
              </Text>
              <Text style={styles.heroTitle}>{tx(PERSON_SECTION_TITLE)}</Text>
            </View>
          </View>
          <Text style={styles.heroIntro}>
            {t('These three questions are asked only once. Your answers are stored with every measurement you make.')}
          </Text>
        </View>

        {mode === 'setup' ? (
          <View style={[styles.card, showMissing && !consentChecked && styles.cardMissing]}>
            <Text style={[styles.cardEyebrow, { color: ACCENT }]}>{t('Information and consent')}</Text>
            {CONSENT_POINTS.map((point) => (
              <View key={point.icon} style={styles.consentPoint}>
                <MaterialCommunityIcons name={point.icon} size={20} color={ACCENT} />
                <Text style={styles.consentText}>
                  {t(isSupabaseConfigured && point.cloudText ? point.cloudText : point.text)}
                </Text>
              </View>
            ))}

            <TouchableOpacity
              style={[styles.consentToggle, consentChecked && { borderColor: ACCENT, backgroundColor: SOFT }]}
              onPress={() => {
                void Haptics.selectionAsync();
                setConsentChecked((current) => !current);
              }}
              activeOpacity={0.85}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: consentChecked }}
              accessibilityLabel={t('I have read this information and agree to take part.')}
            >
              <MaterialCommunityIcons
                name={consentChecked ? 'checkbox-marked' : 'checkbox-blank-outline'}
                size={26}
                color={consentChecked ? ACCENT : Colors.textDisabled}
              />
              <Text style={styles.consentToggleText}>
                {t('I have read this information and agree to take part.')}
              </Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {PERSON_ITEMS.map((item) => (
          <QuestionItem
            key={item.key}
            item={item}
            answers={answers}
            onPatch={patch}
            accentColor={ACCENT}
            softColor={SOFT}
            showMissing={showMissing}
          />
        ))}

        <View style={styles.codeRow}>
          <MaterialCommunityIcons name="identifier" size={20} color={Colors.textMuted} />
          <Text style={styles.codeText}>
            {t('Your participant code: {code}', { code: toParticipantCode(participantId) })}
          </Text>
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: bottomInset }]}>
        {showMissing && !isComplete ? (
          <Text style={styles.footerHint}>
            {consentChecked
              ? t('Please answer the marked questions.')
              : t('Please confirm the consent and answer the marked questions.')}
          </Text>
        ) : null}
        <View style={styles.footerButtons}>
          {onCancel ? (
            <TouchableOpacity
              style={styles.backButton}
              onPress={onCancel}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel={t('Cancel')}
            >
              <MaterialIcons name="close" size={22} color={Colors.text} />
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity
            style={[styles.submitButton, { backgroundColor: isComplete ? Colors.primary : Colors.textDisabled }]}
            onPress={handleSubmit}
            disabled={isSaving}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={mode === 'setup' ? t('Start') : t('Save')}
          >
            <Text style={styles.submitButtonText}>{mode === 'setup' ? t('Start') : t('Save')}</Text>
            <MaterialIcons name={mode === 'setup' ? 'arrow-forward' : 'check'} size={22} color="#FFFFFF" />
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
    paddingBottom: Spacing.lg,
    gap: 12,
  },
  hero: {
    borderRadius: 24,
    padding: Spacing.md,
    gap: 12,
    overflow: 'hidden',
  },
  heroBackdrop: {
    position: 'absolute',
    right: -28,
    bottom: -36,
    opacity: 0.1,
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  heroIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTitles: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  heroEyebrow: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  heroTitle: {
    fontSize: 21,
    lineHeight: 26,
    fontWeight: '800',
    letterSpacing: -0.4,
    color: Colors.text,
  },
  heroIntro: {
    fontSize: 15,
    lineHeight: 21,
    color: Colors.text,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.surfaceHighlight,
    padding: Spacing.md,
    gap: 12,
  },
  cardMissing: {
    borderColor: Colors.error,
    borderWidth: 1.5,
  },
  cardEyebrow: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  consentPoint: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  consentText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    color: Colors.text,
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
    backgroundColor: Colors.background,
  },
  consentToggleText: {
    flex: 1,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '700',
    color: Colors.text,
  },
  codeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 4,
  },
  codeText: {
    flex: 1,
    fontSize: 13,
    color: Colors.textMuted,
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: Colors.surfaceHighlight,
    backgroundColor: Colors.background,
    paddingTop: 12,
    paddingHorizontal: Spacing.md,
    gap: 8,
  },
  footerHint: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.error,
    textAlign: 'center',
  },
  footerButtons: {
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
  submitButton: {
    flex: 1,
    height: 58,
    borderRadius: 29,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
  },
});
