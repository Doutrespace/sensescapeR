import React, { useRef, useState } from 'react';
import { Animated, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Colors, Spacing } from '../../theme/colors';
import { t } from '../../i18n';
import {
  applyAnswerPatch,
  countAnswered,
  tx,
  visibleItems,
  type AnswerPatchInput,
  type Answers,
  type StudySection,
} from '../../study/types';
import { QuestionItem } from './QuestionItem';

type IconName = keyof typeof MaterialCommunityIcons.glyphMap;

interface Props {
  sections: StudySection[];
  answers: Answers;
  onChange: (answers: Answers) => void;
  /** MaterialCommunityIcons glyph, colour and tint that give the questionnaire its face. */
  icon: string;
  color: string;
  softColor: string;
  /** Small line above each section title, e.g. the topic of the group. */
  eyebrow: string;
  /** Space below the buttons (tab bar or safe area). */
  bottomInset: number;
  completeLabel: string;
  onComplete: () => void;
  /** Back from the first page; without it the first page has no back button. */
  onExit?: () => void;
  /** Shown under the header of the first page. */
  firstPageNote?: React.ReactNode;
}

/**
 * A questionnaire shown one section per page: coloured header, the questions
 * as cards, and Back / Next at thumb height.
 */
export function QuestionnairePager({
  sections,
  answers,
  onChange,
  icon,
  color,
  softColor,
  eyebrow,
  bottomInset,
  completeLabel,
  onComplete,
  onExit,
  firstPageNote,
}: Props) {
  const [pageIndex, setPageIndex] = useState(0);
  const pageAnim = useRef(new Animated.Value(1)).current;
  const slideFrom = useRef(1);
  // Latest answers, so two taps before the next render build on each other.
  const latestAnswers = useRef(answers);
  latestAnswers.current = answers;

  const safeIndex = Math.min(pageIndex, Math.max(0, sections.length - 1));
  const section = sections[safeIndex];
  const isLastPage = safeIndex === sections.length - 1;

  if (!section) {
    return null;
  }

  const patch = (change: AnswerPatchInput) => {
    const next = applyAnswerPatch(latestAnswers.current, change);
    latestAnswers.current = next;
    onChange(next);
  };

  const goToPage = (nextIndex: number) => {
    if (nextIndex === safeIndex || nextIndex < 0 || nextIndex >= sections.length) {
      return;
    }
    void Haptics.selectionAsync();
    slideFrom.current = nextIndex > safeIndex ? 1 : -1;
    pageAnim.setValue(0);
    setPageIndex(nextIndex);
    Animated.timing(pageAnim, {
      toValue: 1,
      duration: 220,
      useNativeDriver: true,
    }).start();
  };

  const handleNext = () => {
    if (isLastPage) {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      onComplete();
    } else {
      goToPage(safeIndex + 1);
    }
  };

  const handleBack = () => {
    if (safeIndex > 0) {
      goToPage(safeIndex - 1);
    } else {
      void Haptics.selectionAsync();
      onExit?.();
    }
  };

  const items = visibleItems(section.items, answers);
  const progress = countAnswered(section.items, answers);
  const showBack = safeIndex > 0 || !!onExit;

  return (
    <View style={styles.container}>
      {sections.length > 1 ? (
        <View style={styles.segments} accessibilityRole="tablist">
          {sections.map((entry, index) => {
            const isCurrent = index === safeIndex;
            const entryProgress = countAnswered(entry.items, answers);
            const isAnswered = entryProgress.answered > 0;
            return (
              <TouchableOpacity
                key={entry.key}
                style={styles.segmentTouch}
                onPress={() => goToPage(index)}
                accessibilityRole="tab"
                accessibilityLabel={tx(entry.title)}
                accessibilityState={{ selected: isCurrent }}
              >
                <View
                  style={[
                    styles.segment,
                    isAnswered && { backgroundColor: color, opacity: 0.45 },
                    isCurrent && { backgroundColor: color, opacity: 1 },
                  ]}
                />
              </TouchableOpacity>
            );
          })}
        </View>
      ) : null}

      <Animated.View
        style={[
          styles.page,
          {
            opacity: pageAnim,
            transform: [{
              translateX: pageAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [28 * slideFrom.current, 0],
              }),
            }],
          },
        ]}
      >
        <ScrollView
          // A fresh scroll view per section starts each page at the top.
          key={section.key}
          style={styles.scrollView}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={[styles.hero, { backgroundColor: softColor }]}>
            <View pointerEvents="none" style={styles.heroBackdrop}>
              <MaterialCommunityIcons name={icon as IconName} size={150} color={color} />
            </View>

            <View style={styles.heroTop}>
              <View style={[styles.heroIconWrap, { backgroundColor: color }]}>
                <MaterialCommunityIcons name={icon as IconName} size={28} color="#FFFFFF" />
              </View>
              <View style={styles.heroTitles}>
                <Text style={[styles.heroCount, { color }]} numberOfLines={2}>
                  {sections.length > 1
                    ? `${t('{current} of {total}', { current: safeIndex + 1, total: sections.length })}  ·  `
                    : ''}
                  {eyebrow}
                </Text>
                <Text style={styles.heroTitle}>{tx(section.title)}</Text>
              </View>
            </View>
            {section.intro ? <Text style={styles.heroIntro}>{tx(section.intro)}</Text> : null}
            <View style={styles.heroMeta}>
              <MaterialCommunityIcons
                name={progress.answered === progress.total ? 'check-circle' : 'progress-check'}
                size={16}
                color={color}
              />
              <Text style={[styles.heroMetaText, { color }]}>
                {t('{answered} of {total} answered', progress)}
              </Text>
            </View>
          </View>

          {safeIndex === 0 ? firstPageNote : null}

          {items.map((item) => (
            <QuestionItem
              key={item.key}
              item={item}
              answers={answers}
              onPatch={patch}
              accentColor={color}
              softColor={softColor}
            />
          ))}
        </ScrollView>
      </Animated.View>

      <View style={[styles.footer, { paddingBottom: bottomInset }]}>
        {showBack ? (
          <TouchableOpacity
            style={styles.backButton}
            onPress={handleBack}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={t('Back')}
          >
            <MaterialIcons name="arrow-back" size={22} color={Colors.text} />
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity
          style={[styles.nextButton, { backgroundColor: color }]}
          onPress={handleNext}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel={isLastPage ? completeLabel : t('Next')}
        >
          <Text style={styles.nextButtonText}>{isLastPage ? completeLabel : t('Next')}</Text>
          <MaterialIcons name={isLastPage ? 'check' : 'arrow-forward'} size={22} color="#FFFFFF" />
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
  segments: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.md,
    gap: 6,
  },
  segmentTouch: {
    flex: 1,
    paddingVertical: 10,
  },
  segment: {
    height: 6,
    borderRadius: 3,
    backgroundColor: '#DCD5C7',
  },
  page: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: Spacing.md,
    paddingTop: 4,
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
  heroCount: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  heroTitle: {
    fontSize: 22,
    lineHeight: 27,
    fontWeight: '800',
    letterSpacing: -0.4,
    color: Colors.text,
  },
  heroIntro: {
    fontSize: 15,
    lineHeight: 21,
    color: Colors.text,
  },
  heroMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  heroMetaText: {
    fontSize: 13,
    fontWeight: '700',
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
  nextButton: {
    flex: 1,
    height: 58,
    borderRadius: 29,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 12,
  },
  nextButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    flexShrink: 1,
  },
});
