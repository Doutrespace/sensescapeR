import React, { useRef, useState } from 'react';
import {
  Animated,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Colors, Radius, Spacing } from '../../theme/colors';
import {
  ENVIRONMENT_ITEMS,
  MULTISENSORY_MODULES,
  MultisensoryAssessment,
  MultisensoryModuleInfo,
  MultisensoryModuleKey,
  RESTORATIVENESS_ITEMS,
  SAM_SCALE,
  SMELL_SOURCES,
  ScaleItem,
  THERMAL_ITEMS,
  VISUAL_ITEMS,
  countAnsweredItems,
} from '../../types/multisensory';
import { DotScale } from './DotScale';
import { Grid2DInput, GridPoint, Quadrants } from './Grid2DInput';
import { StepSlider } from './StepSlider';

interface Props {
  value: MultisensoryAssessment;
  onChange: (value: MultisensoryAssessment) => void;
  onConfirm: () => void;
}

const MODULE_INTROS: Record<MultisensoryModuleKey, string> = {
  visual: 'Look around. How does the scene in front of you appear?',
  smell: 'Take a breath. How does the air smell here?',
  thermal: 'How does the temperature feel to you at this moment?',
  restorativeness: 'How much do you agree with each statement about this place?',
  emotion: 'How do you feel right now, being in this place?',
  environment: 'How strongly does each quality describe this place?',
};

const SLIDER_ITEMS: Partial<Record<MultisensoryModuleKey, ScaleItem[]>> = {
  visual: VISUAL_ITEMS,
  thermal: THERMAL_ITEMS,
  restorativeness: RESTORATIVENESS_ITEMS,
};

const SMELL_QUADRANT_COLORS: Quadrants<string> = {
  topLeft: '#EBCFCB',
  topRight: '#D5E6CC',
  bottomLeft: '#F1E6E0',
  bottomRight: '#E7F0E1',
};

const SMELL_QUADRANT_EMOJI: Quadrants<string> = {
  topLeft: '🤢',
  topRight: '🌸',
  bottomLeft: '😕',
  bottomRight: '🍃',
};

const EMOTION_QUADRANT_COLORS: Quadrants<string> = {
  topLeft: '#EBCBC6',
  topRight: '#F4E4B5',
  bottomLeft: '#D6DDE8',
  bottomRight: '#D5E6D8',
};

const EMOTION_QUADRANT_EMOJI: Quadrants<string> = {
  topLeft: '😠',
  topRight: '😄',
  bottomLeft: '😔',
  bottomRight: '😌',
};

const SAM_SPAN = SAM_SCALE.max - SAM_SCALE.min;
const SCREEN_PADDING = Spacing.md;
// Approximate height of everything around the pad on a pad page: step bar,
// sync notice, section header, footer buttons and tab bar.
const PAD_PAGE_CHROME_HEIGHT = 460;

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function samToAxis(value: number): number {
  return ((value - SAM_SCALE.min) / SAM_SPAN) * 2 - 1;
}

function axisToSam(value: number): number {
  return SAM_SCALE.min + Math.round(((value + 1) / 2) * SAM_SPAN);
}

/** Face and word for a SAM valence/arousal rating (1-9 each). */
function describeEmotion(valence: number, arousal: number): { emoji: string; label: string } {
  const high = (score: number) => score >= 6;
  const low = (score: number) => score <= 4;

  if (high(valence)) {
    if (high(arousal)) return { emoji: '😄', label: 'Excited, delighted' };
    if (low(arousal)) return { emoji: '😌', label: 'Relaxed, content' };
    return { emoji: '🙂', label: 'Pleased' };
  }
  if (low(valence)) {
    if (high(arousal)) return { emoji: '😠', label: 'Tense, stressed' };
    if (low(arousal)) return { emoji: '😔', label: 'Gloomy, bored' };
    return { emoji: '🙁', label: 'Displeased' };
  }
  if (high(arousal)) return { emoji: '😮', label: 'Alert, activated' };
  if (low(arousal)) return { emoji: '😴', label: 'Sleepy, still' };
  return { emoji: '😐', label: 'Neutral' };
}

function describeSmell(pleasantness: number, intensity: number): string {
  const strength = intensity < 0.25
    ? 'Faint'
    : intensity < 0.5
      ? 'Mild'
      : intensity < 0.75
        ? 'Noticeable'
        : 'Strong';
  const quality = pleasantness < -0.5
    ? 'very unpleasant'
    : pleasantness < -0.15
      ? 'unpleasant'
      : pleasantness <= 0.15
        ? 'neutral'
        : pleasantness <= 0.5
          ? 'pleasant'
          : 'very pleasant';
  return `${strength}, ${quality}`;
}

/**
 * Multisensory ratings, one section per page so each fits a phone screen:
 * a coloured header, large touch inputs, and Back / Next at thumb height.
 */
export default function MultisensoryScreen({ value, onChange, onConfirm }: Props) {
  const tabBarHeight = useBottomTabBarHeight();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const [pageIndex, setPageIndex] = useState(0);
  const pageAnim = useRef(new Animated.Value(1)).current;
  // Latest assessment, so two ratings made before the next render (e.g. two
  // fingers) build on each other instead of the second undoing the first.
  const latestValue = useRef(value);
  latestValue.current = value;
  const commit = (next: MultisensoryAssessment) => {
    latestValue.current = next;
    onChange(next);
  };
  const slideFrom = useRef(1);

  const section = MULTISENSORY_MODULES[pageIndex];
  const isLastPage = pageIndex === MULTISENSORY_MODULES.length - 1;
  const answeredHere = countAnsweredItems(value, section.key);
  const hasAnythingHere = value[section.key] !== undefined;
  // The rating pad swallows touches, so it must fit on screen without
  // scrolling: full width, but no taller than what is left between the
  // header area above and the buttons below.
  const padSize = Math.max(
    240,
    Math.min(380, screenWidth - 2 * SCREEN_PADDING, screenHeight - PAD_PAGE_CHROME_HEIGHT)
  );

  // On the emotion page the header itself shows the face for the current rating.
  const emotion = value.emotion ?? {};
  const mood = section.key === 'emotion'
    && typeof emotion.valence === 'number'
    && typeof emotion.arousal === 'number'
    ? describeEmotion(emotion.valence, emotion.arousal)
    : null;
  const heroEmoji = mood?.emoji ?? section.emoji;
  const heroIntro = mood
    ? `${mood.label}  ·  Valence ${emotion.valence}/9, Arousal ${emotion.arousal}/9`
    : MODULE_INTROS[section.key];

  const goToPage = (nextIndex: number) => {
    if (nextIndex === pageIndex || nextIndex < 0 || nextIndex >= MULTISENSORY_MODULES.length) {
      return;
    }
    void Haptics.selectionAsync();
    slideFrom.current = nextIndex > pageIndex ? 1 : -1;
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
      onConfirm();
    } else {
      goToPage(pageIndex + 1);
    }
  };

  const updateModule = <K extends MultisensoryModuleKey>(
    moduleKey: K,
    patch: Partial<NonNullable<MultisensoryAssessment[K]>>
  ) => {
    const current = latestValue.current;
    commit({
      ...current,
      [moduleKey]: { ...(current[moduleKey] ?? {}), ...patch },
    });
  };

  const clearModule = (moduleKey: MultisensoryModuleKey) => {
    const next = { ...latestValue.current };
    delete next[moduleKey];
    commit(next);
    void Haptics.selectionAsync();
  };

  const renderItemHeader = (emoji: string, label: string, prompt: string, info: MultisensoryModuleInfo) => (
    <View style={styles.itemHeader}>
      <View style={[styles.itemEmojiWrap, { backgroundColor: info.softColor }]}>
        <Text style={styles.itemEmoji}>{emoji}</Text>
      </View>
      <View style={styles.itemHeaderText}>
        <Text style={styles.itemLabel}>{label}</Text>
        <Text style={styles.itemPrompt}>{prompt}</Text>
      </View>
    </View>
  );

  const renderSliders = (info: MultisensoryModuleInfo, items: ScaleItem[]) => {
    const moduleValue = (value[info.key] ?? {}) as Record<string, number | undefined>;

    return items.map((item) => (
      <View key={item.key} style={styles.card}>
        {renderItemHeader(item.emoji, item.label, item.prompt, info)}
        <StepSlider
          min={item.min}
          max={item.max}
          value={moduleValue[item.key] ?? null}
          onChange={(next) => updateModule(info.key, { [item.key]: next })}
          minLabel={item.minLabel}
          maxLabel={item.maxLabel}
          valueLabels={item.valueLabels}
          bipolar={item.bipolar}
          accentColor={info.color}
          stepColors={item.stepColors}
          accessibilityLabel={`${item.label}: ${item.prompt}`}
        />
      </View>
    ));
  };

  const renderEnvironment = (info: MultisensoryModuleInfo) => {
    const environment = (value.environment ?? {}) as Record<string, number | undefined>;

    return (
      <>
        <View style={[styles.legend, { backgroundColor: info.softColor }]}>
          <Text style={[styles.legendText, { color: info.color }]}>1 = Not at all</Text>
          <MaterialIcons name="arrow-forward" size={16} color={info.color} />
          <Text style={[styles.legendText, { color: info.color }]}>5 = Very much</Text>
        </View>

        {ENVIRONMENT_ITEMS.map((item) => (
          <View key={item.key} style={styles.card}>
            {renderItemHeader(item.emoji, item.label, item.prompt, info)}
            <DotScale
              min={item.min}
              max={item.max}
              value={environment[item.key] ?? null}
              onChange={(next) => updateModule('environment', { [item.key]: next })}
              accentColor={info.color}
              accessibilityLabel={`${item.label}: ${item.prompt}`}
            />
          </View>
        ))}
      </>
    );
  };

  const renderSmell = (info: MultisensoryModuleInfo) => {
    const smell = value.smell ?? {};
    const hasPoint = typeof smell.pleasantness === 'number' && typeof smell.intensity === 'number';
    const point: GridPoint | null = hasPoint
      ? { x: smell.pleasantness!, y: smell.intensity! * 2 - 1 }
      : null;
    const sources = smell.sources ?? [];

    const toggleSource = (key: string) => {
      void Haptics.selectionAsync();
      let next: string[];
      if (sources.includes(key)) {
        next = sources.filter((source) => source !== key);
      } else if (key === 'none') {
        // "No noticeable smell" excludes every other source.
        next = ['none'];
      } else {
        next = [...sources.filter((source) => source !== 'none'), key];
      }
      updateModule('smell', { sources: next });
    };

    return (
      <>
        <Grid2DInput
          size={padSize}
          value={point}
          onChange={(next) => updateModule('smell', {
            pleasantness: round2(next.x),
            intensity: round2((next.y + 1) / 2),
          })}
          leftLabel="Unpleasant"
          rightLabel="Pleasant"
          topLabel="Strong"
          bottomLabel="Weak"
          accentColor={info.color}
          quadrantColors={SMELL_QUADRANT_COLORS}
          quadrantEmoji={SMELL_QUADRANT_EMOJI}
          accessibilityLabel="Smell pleasantness and intensity"
        />

        <View style={[styles.readout, hasPoint && { backgroundColor: info.color }]}>
          <Text style={[styles.readoutText, hasPoint && styles.readoutTextActive]}>
            {hasPoint ? describeSmell(smell.pleasantness!, smell.intensity!) : 'Place the marker to rate the smell'}
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.itemLabel}>What can you smell?</Text>
          <Text style={styles.itemPrompt}>Tap everything that applies (optional).</Text>
          <View style={styles.chipWrap}>
            {SMELL_SOURCES.map((source) => {
              const selected = sources.includes(source.key);
              return (
                <TouchableOpacity
                  key={source.key}
                  style={[
                    styles.chip,
                    selected && { backgroundColor: info.color, borderColor: info.color },
                  ]}
                  onPress={() => toggleSource(source.key)}
                  activeOpacity={0.8}
                  accessibilityRole="checkbox"
                  accessibilityLabel={source.label}
                  accessibilityState={{ checked: selected }}
                >
                  <Text style={styles.chipEmoji}>{source.emoji}</Text>
                  <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                    {source.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </>
    );
  };

  const renderEmotion = (info: MultisensoryModuleInfo) => {
    const emotion = value.emotion ?? {};
    const hasPoint = typeof emotion.valence === 'number' && typeof emotion.arousal === 'number';
    const point: GridPoint | null = hasPoint
      ? { x: samToAxis(emotion.valence!), y: samToAxis(emotion.arousal!) }
      : null;
    const mood = hasPoint ? describeEmotion(emotion.valence!, emotion.arousal!) : null;

    return (
      <>
        <Grid2DInput
          size={padSize}
          steps={SAM_SPAN + 1}
          value={point}
          onChange={(next) => updateModule('emotion', {
            valence: axisToSam(next.x),
            arousal: axisToSam(next.y),
          })}
          leftLabel="Unhappy"
          rightLabel="Happy"
          topLabel="Excited"
          bottomLabel="Calm"
          accentColor={info.color}
          quadrantColors={EMOTION_QUADRANT_COLORS}
          quadrantEmoji={EMOTION_QUADRANT_EMOJI}
          markerEmoji={mood?.emoji}
          accessibilityLabel="Affect grid: valence and arousal"
        />

        <View style={styles.card}>
          {renderItemHeader('💪', 'Dominance (optional)', 'How much do you feel in control of the situation?', info)}
          <StepSlider
            min={SAM_SCALE.min}
            max={SAM_SCALE.max}
            value={emotion.dominance ?? null}
            onChange={(next) => updateModule('emotion', { dominance: next })}
            minLabel="Controlled"
            maxLabel="In control"
            accentColor={info.color}
            accessibilityLabel="Dominance: how much do you feel in control of the situation?"
          />
        </View>
      </>
    );
  };

  const renderModuleBody = (info: MultisensoryModuleInfo) => {
    switch (info.key) {
      case 'smell':
        return renderSmell(info);
      case 'emotion':
        return renderEmotion(info);
      case 'environment':
        return renderEnvironment(info);
      default:
        return renderSliders(info, SLIDER_ITEMS[info.key] ?? []);
    }
  };

  const primaryLabel = isLastPage
    ? (answeredHere > 0 ? 'Finish' : 'Skip & finish')
    : (answeredHere > 0 ? 'Next' : 'Skip');

  return (
    <View style={styles.container}>
      {/* Section progress: one segment per section, tap to jump. */}
      <View style={styles.segments} accessibilityRole="tablist">
        {MULTISENSORY_MODULES.map((info, index) => {
          const isCurrent = index === pageIndex;
          const isAnswered = countAnsweredItems(value, info.key) > 0;
          return (
            <TouchableOpacity
              key={info.key}
              style={styles.segmentTouch}
              onPress={() => goToPage(index)}
              accessibilityRole="tab"
              accessibilityLabel={`${info.title}${isAnswered ? ', rated' : ''}`}
              accessibilityState={{ selected: isCurrent }}
            >
              <View
                style={[
                  styles.segment,
                  isAnswered && { backgroundColor: info.color, opacity: 0.45 },
                  isCurrent && { backgroundColor: info.color, opacity: 1 },
                ]}
              />
            </TouchableOpacity>
          );
        })}
      </View>

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
          <View style={[styles.hero, { backgroundColor: section.softColor }]}>
            <View style={styles.heroTop}>
              <View style={styles.heroEmojiWrap}>
                <Text style={styles.heroEmoji}>{heroEmoji}</Text>
              </View>
              <View style={styles.heroTitles}>
                <Text style={[styles.heroCount, { color: section.color }]}>
                  {pageIndex + 1} of {MULTISENSORY_MODULES.length}  ·  {section.framework}
                </Text>
                <Text style={styles.heroTitle}>{section.title}</Text>
              </View>
            </View>
            <Text style={[styles.heroIntro, mood && styles.heroIntroStrong]}>{heroIntro}</Text>
          </View>

          {renderModuleBody(section)}

          {hasAnythingHere && (
            <TouchableOpacity
              style={styles.clearButton}
              onPress={() => clearModule(section.key)}
              accessibilityRole="button"
              accessibilityLabel={`Clear ${section.title} ratings`}
            >
              <MaterialIcons name="restart-alt" size={18} color={Colors.textMuted} />
              <Text style={styles.clearButtonText}>Clear this page</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </Animated.View>

      <View style={[styles.footer, { paddingBottom: tabBarHeight + 16 }]}>
        {pageIndex > 0 && (
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => goToPage(pageIndex - 1)}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Back to previous section"
          >
            <MaterialIcons name="arrow-back" size={22} color={Colors.text} />
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[styles.nextButton, { backgroundColor: section.color }]}
          onPress={handleNext}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel={isLastPage ? 'Finish multisensory ratings' : `${primaryLabel}: go to next section`}
        >
          <Text style={styles.nextButtonText}>{primaryLabel}</Text>
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
    paddingHorizontal: SCREEN_PADDING,
    gap: 6,
  },
  segmentTouch: {
    flex: 1,
    // Thin bar, tall touch target.
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
    paddingHorizontal: SCREEN_PADDING,
    paddingTop: 4,
    paddingBottom: Spacing.lg,
    gap: 12,
  },
  hero: {
    borderRadius: 24,
    padding: Spacing.md,
    gap: 12,
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  heroEmojiWrap: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  heroEmoji: {
    fontSize: 32,
    lineHeight: 40,
  },
  heroTitles: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  heroCount: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  heroTitle: {
    fontSize: 24,
    lineHeight: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
    color: Colors.text,
  },
  heroIntro: {
    fontSize: 16,
    lineHeight: 22,
    color: Colors.text,
  },
  heroIntroStrong: {
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.surfaceHighlight,
    padding: Spacing.md,
    gap: 10,
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  itemEmojiWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemEmoji: {
    fontSize: 22,
    lineHeight: 28,
  },
  itemHeaderText: {
    flex: 1,
    minWidth: 0,
  },
  itemLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
  },
  itemPrompt: {
    fontSize: 14,
    lineHeight: 19,
    color: Colors.textMuted,
    marginTop: 2,
  },
  legend: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 10,
    borderRadius: 14,
  },
  legendText: {
    fontSize: 14,
    fontWeight: '700',
  },
  readout: {
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 100,
    backgroundColor: 'rgba(23, 23, 23, 0.06)',
  },
  readoutText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textMuted,
  },
  readoutTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  chip: {
    minHeight: 44,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: Radius.full,
    borderWidth: 1.5,
    borderColor: Colors.surfaceHighlight,
    backgroundColor: Colors.background,
  },
  chipEmoji: {
    fontSize: 16,
  },
  chipText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
  },
  chipTextSelected: {
    color: '#FFFFFF',
  },
  clearButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    gap: 6,
    minHeight: 44,
    paddingHorizontal: 12,
  },
  clearButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textMuted,
  },
  footer: {
    flexDirection: 'row',
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.surfaceHighlight,
    backgroundColor: Colors.background,
    paddingTop: 12,
    paddingHorizontal: SCREEN_PADDING,
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
  },
  nextButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
  },
});
