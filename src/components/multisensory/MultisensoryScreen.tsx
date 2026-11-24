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
import { MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Colors, Radius, Spacing } from '../../theme/colors';
import { t } from '../../i18n';
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
  /** Back to the previous step, from the first section. */
  onBack?: () => void;
}

type IconName = keyof typeof MaterialCommunityIcons.glyphMap;

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

// Quiet tints: the pads should read as one surface, not four coloured tiles.
const SMELL_QUADRANT_COLORS: Quadrants<string> = {
  topLeft: '#F1E7EA',
  topRight: '#ECE6F3',
  bottomLeft: '#F7F3F1',
  bottomRight: '#F3F0F7',
};

const EMOTION_QUADRANT_COLORS: Quadrants<string> = {
  topLeft: '#F5E6E8',
  topRight: '#F7ECE4',
  bottomLeft: '#EEEDF0',
  bottomRight: '#EDF1EC',
};

// Corner words of the Affect Grid (Russell, Weiss & Mendelsohn, 1989).
const EMOTION_QUADRANT_LABELS: Quadrants<string> = {
  topLeft: 'Stress',
  topRight: 'Excitement',
  bottomLeft: 'Depression',
  bottomRight: 'Relaxation',
};

const SAM_SPAN = SAM_SCALE.max - SAM_SCALE.min;
const SCREEN_PADDING = Spacing.md;
// Approximate height of everything around the pad on a pad page: step bar,
// sync notice, section header, footer buttons and tab bar.
const PAD_PAGE_CHROME_HEIGHT = 460;

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function gridToAxis(value: number): number {
  return ((value - SAM_SCALE.min) / SAM_SPAN) * 2 - 1;
}

function axisToGrid(value: number): number {
  return SAM_SCALE.min + Math.round(((value + 1) / 2) * SAM_SPAN);
}

function signedPercent(value: number): string {
  const percent = Math.round(value * 100);
  return `${percent > 0 ? '+' : ''}${percent}%`;
}

/**
 * Multisensory ratings, one section per page so each fits a phone screen:
 * a coloured header, large touch inputs, and Back / Next at thumb height.
 */
export default function MultisensoryScreen({ value, onChange, onConfirm, onBack }: Props) {
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

  const renderItemHeader = (icon: string, label: string, prompt: string, info: MultisensoryModuleInfo) => (
    <View style={styles.itemHeader}>
      <View style={[styles.itemIconWrap, { backgroundColor: info.softColor }]}>
        <MaterialCommunityIcons name={icon as IconName} size={22} color={info.color} />
      </View>
      <View style={styles.itemHeaderText}>
        <Text style={styles.itemLabel}>{t(label)}</Text>
        <Text style={styles.itemPrompt}>{t(prompt)}</Text>
      </View>
    </View>
  );

  const renderSliders = (info: MultisensoryModuleInfo, items: ScaleItem[]) => {
    const moduleValue = (value[info.key] ?? {}) as Record<string, number | undefined>;

    return items.map((item) => (
      <View key={item.key} style={styles.card}>
        {renderItemHeader(item.icon, item.label, item.prompt, info)}
        <StepSlider
          min={item.min}
          max={item.max}
          value={moduleValue[item.key] ?? null}
          onChange={(next) => updateModule(info.key, { [item.key]: next })}
          minLabel={t(item.minLabel)}
          maxLabel={t(item.maxLabel)}
          valueLabels={item.valueLabels}
          bipolar={item.bipolar}
          accentColor={info.color}
          stepColors={item.stepColors}
          accessibilityLabel={`${t(item.label)}: ${t(item.prompt)}`}
        />
      </View>
    ));
  };

  const renderEnvironment = (info: MultisensoryModuleInfo) => {
    const environment = (value.environment ?? {}) as Record<string, number | undefined>;

    return (
      <>
        <View style={[styles.legend, { borderColor: info.softColor }]}>
          <Text style={[styles.legendText, { color: info.color }]}>{t('1 = Not at all')}</Text>
          <View style={[styles.legendLine, { backgroundColor: info.softColor }]} />
          <Text style={[styles.legendText, { color: info.color }]}>{t('5 = Very much')}</Text>
        </View>

        {ENVIRONMENT_ITEMS.map((item) => (
          <View key={item.key} style={styles.card}>
            {renderItemHeader(item.icon, item.label, item.prompt, info)}
            <DotScale
              min={item.min}
              max={item.max}
              value={environment[item.key] ?? null}
              onChange={(next) => updateModule('environment', { [item.key]: next })}
              accentColor={info.color}
              accessibilityLabel={`${t(item.label)}: ${t(item.prompt)}`}
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
          leftLabel={t('Unpleasant')}
          rightLabel={t('Pleasant')}
          topLabel={t('Strong')}
          bottomLabel={t('Weak')}
          accentColor={info.color}
          quadrantColors={SMELL_QUADRANT_COLORS}
          accessibilityLabel={t('Smell pleasantness and intensity')}
        />

        <View style={styles.readoutRow}>
          <View style={styles.readoutCell}>
            <Text style={styles.readoutLabel}>{t('Pleasantness')}</Text>
            <Text style={[styles.readoutValue, hasPoint && { color: info.color }]}>
              {hasPoint ? signedPercent(smell.pleasantness!) : '–'}
            </Text>
          </View>
          <View style={styles.readoutDivider} />
          <View style={styles.readoutCell}>
            <Text style={styles.readoutLabel}>{t('Intensity')}</Text>
            <Text style={[styles.readoutValue, hasPoint && { color: info.color }]}>
              {hasPoint ? `${Math.round(smell.intensity! * 100)}%` : '–'}
            </Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.itemLabel}>{t('What can you smell?')}</Text>
          <Text style={styles.itemPrompt}>{t('Tap everything that applies (optional).')}</Text>
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
                  accessibilityLabel={t(source.label)}
                  accessibilityState={{ checked: selected }}
                >
                  <MaterialCommunityIcons
                    name={source.icon as IconName}
                    size={18}
                    color={selected ? '#FFFFFF' : info.color}
                  />
                  <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                    {t(source.label)}
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
      ? { x: gridToAxis(emotion.valence!), y: gridToAxis(emotion.arousal!) }
      : null;

    return (
      <>
        <Grid2DInput
          size={padSize}
          steps={SAM_SPAN + 1}
          value={point}
          onChange={(next) => updateModule('emotion', {
            valence: axisToGrid(next.x),
            arousal: axisToGrid(next.y),
          })}
          leftLabel={t('Unpleasant')}
          rightLabel={t('Pleasant')}
          topLabel={t('High arousal')}
          bottomLabel={t('Sleepiness')}
          accentColor={info.color}
          quadrantColors={EMOTION_QUADRANT_COLORS}
          quadrantLabels={{
            topLeft: t(EMOTION_QUADRANT_LABELS.topLeft),
            topRight: t(EMOTION_QUADRANT_LABELS.topRight),
            bottomLeft: t(EMOTION_QUADRANT_LABELS.bottomLeft),
            bottomRight: t(EMOTION_QUADRANT_LABELS.bottomRight),
          }}
          accessibilityLabel={t('Affect grid: pleasure and arousal')}
        />

        <View style={styles.readoutRow}>
          <View style={styles.readoutCell}>
            <Text style={styles.readoutLabel}>{t('Pleasure')}</Text>
            <Text style={[styles.readoutValue, hasPoint && { color: info.color }]}>
              {hasPoint ? `${emotion.valence} / 9` : '–'}
            </Text>
          </View>
          <View style={styles.readoutDivider} />
          <View style={styles.readoutCell}>
            <Text style={styles.readoutLabel}>{t('Arousal')}</Text>
            <Text style={[styles.readoutValue, hasPoint && { color: info.color }]}>
              {hasPoint ? `${emotion.arousal} / 9` : '–'}
            </Text>
          </View>
        </View>

        <View style={styles.card}>
          {renderItemHeader(
            'arm-flex-outline',
            'Dominance (optional)',
            'How much do you feel in control of the situation?',
            info
          )}
          <StepSlider
            min={SAM_SCALE.min}
            max={SAM_SCALE.max}
            value={emotion.dominance ?? null}
            onChange={(next) => updateModule('emotion', { dominance: next })}
            minLabel={t('Controlled')}
            maxLabel={t('In control')}
            accentColor={info.color}
            accessibilityLabel={t('Dominance: how much do you feel in control of the situation?')}
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
    ? (answeredHere > 0 ? t('Finish') : t('Skip & finish'))
    : (answeredHere > 0 ? t('Next') : t('Skip'));

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
              accessibilityLabel={isAnswered ? t('{section}, rated', { section: t(info.title) }) : t(info.title)}
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
            {/* Oversized, faint icon as a backdrop gives each page its own face. */}
            <View pointerEvents="none" style={styles.heroBackdrop}>
              <MaterialCommunityIcons name={section.icon as IconName} size={150} color={section.color} />
            </View>

            <View style={styles.heroTop}>
              <View style={[styles.heroIconWrap, { backgroundColor: section.color }]}>
                <MaterialCommunityIcons name={section.icon as IconName} size={28} color="#FFFFFF" />
              </View>
              <View style={styles.heroTitles}>
                <Text style={[styles.heroCount, { color: section.color }]}>
                  {t('{current} of {total}', { current: pageIndex + 1, total: MULTISENSORY_MODULES.length })}
                  {'  ·  '}
                  {t(section.framework)}
                </Text>
                <Text style={styles.heroTitle}>{t(section.title)}</Text>
              </View>
            </View>
            <Text style={styles.heroIntro}>{t(MODULE_INTROS[section.key])}</Text>
          </View>

          {renderModuleBody(section)}

          {hasAnythingHere && (
            <TouchableOpacity
              style={styles.clearButton}
              onPress={() => clearModule(section.key)}
              accessibilityRole="button"
              accessibilityLabel={t('Clear the ratings on this page')}
            >
              <MaterialIcons name="restart-alt" size={18} color={Colors.textMuted} />
              <Text style={styles.clearButtonText}>{t('Clear this page')}</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </Animated.View>

      <View style={[styles.footer, { paddingBottom: tabBarHeight + 16 }]}>
        {(pageIndex > 0 || onBack) && (
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => {
              if (pageIndex > 0) {
                goToPage(pageIndex - 1);
              } else {
                void Haptics.selectionAsync();
                onBack?.();
              }
            }}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={pageIndex > 0 ? t('Back to previous section') : t('Back')}
          >
            <MaterialIcons name="arrow-back" size={22} color={Colors.text} />
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[styles.nextButton, { backgroundColor: section.color }]}
          onPress={handleNext}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel={isLastPage ? t('Finish multisensory ratings') : t('Go to next section')}
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
  itemIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
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
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    backgroundColor: Colors.surface,
  },
  legendLine: {
    flex: 1,
    height: 2,
    borderRadius: 1,
  },
  legendText: {
    fontSize: 13,
    fontWeight: '700',
  },
  readoutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.surfaceHighlight,
    paddingVertical: 12,
  },
  readoutCell: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  readoutDivider: {
    width: 1,
    alignSelf: 'stretch',
    backgroundColor: Colors.surfaceHighlight,
  },
  readoutLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: Colors.textMuted,
  },
  readoutValue: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.textDisabled,
    fontVariant: ['tabular-nums'],
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
