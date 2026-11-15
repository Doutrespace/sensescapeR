import React, { useEffect, useRef, useState } from 'react';
import {
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
  MultisensoryModuleKey,
  RESTORATIVENESS_ITEMS,
  SAM_SCALE,
  SMELL_SOURCES,
  ScaleItem,
  THERMAL_ITEMS,
  VISUAL_ITEMS,
  countAnsweredItems,
  countAnsweredModules,
} from '../../types/multisensory';
import { Grid2DInput, GridPoint } from './Grid2DInput';
import { StepSlider } from './StepSlider';

interface Props {
  value: MultisensoryAssessment;
  onChange: (value: MultisensoryAssessment) => void;
  onConfirm: () => void;
}

const MODULE_ICONS: Record<MultisensoryModuleKey, keyof typeof MaterialIcons.glyphMap> = {
  visual: 'visibility',
  smell: 'air',
  thermal: 'thermostat',
  restorativeness: 'spa',
  emotion: 'mood',
  environment: 'park',
};

const MODULE_INTROS: Record<MultisensoryModuleKey, string> = {
  visual: 'Look around. How does the scene in front of you appear?',
  smell: 'Take a breath. Place the marker for how the air smells here.',
  thermal: 'How does the temperature feel to you at this moment?',
  restorativeness: 'How much do you agree with each statement about this place?',
  emotion: 'How do you feel right now, being in this place?',
  environment: 'How strongly does each quality describe this place?',
};

const SLIDER_ITEMS: Partial<Record<MultisensoryModuleKey, ScaleItem[]>> = {
  visual: VISUAL_ITEMS,
  thermal: THERMAL_ITEMS,
  restorativeness: RESTORATIVENESS_ITEMS,
  environment: ENVIRONMENT_ITEMS,
};

const SAM_SPAN = SAM_SCALE.max - SAM_SCALE.min;

// Layout constants shared by the styles and the scroll-to-section maths.
const CONTENT_PADDING_TOP = Spacing.md;
const CARD_GAP = 12;
const CARD_BORDER = 1;

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function samToAxis(value: number): number {
  return ((value - SAM_SCALE.min) / SAM_SPAN) * 2 - 1;
}

function axisToSam(value: number): number {
  return SAM_SCALE.min + Math.round(((value + 1) / 2) * SAM_SPAN);
}

export default function MultisensoryScreen({ value, onChange, onConfirm }: Props) {
  const tabBarHeight = useBottomTabBarHeight();
  const { width: screenWidth } = useWindowDimensions();
  const [openModule, setOpenModule] = useState<MultisensoryModuleKey | null>('visual');
  const scrollRef = useRef<ScrollView>(null);
  const introHeight = useRef(0);
  const headerHeights = useRef<Partial<Record<MultisensoryModuleKey, number>>>({});
  const isFirstRender = useRef(true);

  // Opening a section collapses the previous one, which shifts everything
  // below it. Bring the newly opened section's header back to the top. Only
  // one section is open at a time, so every card above it is just a header.
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    if (!openModule) {
      return;
    }
    const timer = setTimeout(() => {
      let offset = CONTENT_PADDING_TOP + introHeight.current + CARD_GAP;
      for (const module of MULTISENSORY_MODULES) {
        if (module.key === openModule) {
          break;
        }
        offset += (headerHeights.current[module.key] ?? 68) + 2 * CARD_BORDER + CARD_GAP;
      }
      scrollRef.current?.scrollTo({ y: Math.max(0, offset - 8), animated: true });
    }, 60);
    return () => clearTimeout(timer);
  }, [openModule]);

  const answeredModules = countAnsweredModules(value);
  // Full card width: screen padding, card padding and card border.
  const gridSize = Math.max(180, Math.min(320, screenWidth - 2 * Spacing.lg - 2 * Spacing.md - 2 * CARD_BORDER));

  const updateModule = <K extends MultisensoryModuleKey>(
    moduleKey: K,
    patch: Partial<NonNullable<MultisensoryAssessment[K]>>
  ) => {
    onChange({
      ...value,
      [moduleKey]: { ...(value[moduleKey] ?? {}), ...patch },
    });
  };

  const clearModule = (moduleKey: MultisensoryModuleKey) => {
    const next = { ...value };
    delete next[moduleKey];
    onChange(next);
    void Haptics.selectionAsync();
  };

  const toggleModule = (moduleKey: MultisensoryModuleKey) => {
    void Haptics.selectionAsync();
    setOpenModule((current) => (current === moduleKey ? null : moduleKey));
  };

  const renderSliders = (moduleKey: MultisensoryModuleKey, items: ScaleItem[]) => {
    const moduleValue = (value[moduleKey] ?? {}) as Record<string, number | undefined>;

    return items.map((item) => (
      <View key={item.key} style={styles.item}>
        <Text style={styles.itemLabel}>{item.label}</Text>
        <Text style={styles.itemPrompt}>{item.prompt}</Text>
        <StepSlider
          min={item.min}
          max={item.max}
          value={moduleValue[item.key] ?? null}
          onChange={(next) => updateModule(moduleKey, { [item.key]: next })}
          minLabel={item.minLabel}
          maxLabel={item.maxLabel}
          valueLabels={item.valueLabels}
          bipolar={item.bipolar}
          accessibilityLabel={`${item.label}: ${item.prompt}`}
        />
      </View>
    ));
  };

  const renderSmell = () => {
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
          size={gridSize}
          value={point}
          onChange={(next) => updateModule('smell', {
            pleasantness: round2(next.x),
            intensity: round2((next.y + 1) / 2),
          })}
          leftLabel="Unpleasant"
          rightLabel="Pleasant"
          topLabel="Strong"
          bottomLabel="Weak"
          accessibilityLabel="Smell pleasantness and intensity"
        />
        <Text style={styles.readout}>
          {hasPoint
            ? `Pleasantness ${smell.pleasantness! > 0 ? '+' : ''}${Math.round(smell.pleasantness! * 100)}%  ·  Intensity ${Math.round(smell.intensity! * 100)}%`
            : 'Not rated'}
        </Text>

        <View style={styles.item}>
          <Text style={styles.itemLabel}>What can you smell?</Text>
          <Text style={styles.itemPrompt}>Select everything that applies (optional).</Text>
          <View style={styles.chipWrap}>
            {SMELL_SOURCES.map((source) => {
              const selected = sources.includes(source.key);
              return (
                <TouchableOpacity
                  key={source.key}
                  style={[styles.chip, selected && styles.chipSelected]}
                  onPress={() => toggleSource(source.key)}
                  activeOpacity={0.8}
                  accessibilityRole="checkbox"
                  accessibilityLabel={source.label}
                  accessibilityState={{ checked: selected }}
                >
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

  const renderEmotion = () => {
    const emotion = value.emotion ?? {};
    const hasPoint = typeof emotion.valence === 'number' && typeof emotion.arousal === 'number';
    const point: GridPoint | null = hasPoint
      ? { x: samToAxis(emotion.valence!), y: samToAxis(emotion.arousal!) }
      : null;

    return (
      <>
        <Grid2DInput
          size={gridSize}
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
          accessibilityLabel="Affect grid: valence and arousal"
        />
        <Text style={styles.readout}>
          {hasPoint
            ? `Valence ${emotion.valence} / 9  ·  Arousal ${emotion.arousal} / 9`
            : 'Not rated'}
        </Text>

        <View style={styles.item}>
          <Text style={styles.itemLabel}>Dominance (optional)</Text>
          <Text style={styles.itemPrompt}>How much do you feel in control of the situation?</Text>
          <StepSlider
            min={SAM_SCALE.min}
            max={SAM_SCALE.max}
            value={emotion.dominance ?? null}
            onChange={(next) => updateModule('emotion', { dominance: next })}
            minLabel="Controlled"
            maxLabel="In control"
            accessibilityLabel="Dominance: how much do you feel in control of the situation?"
          />
        </View>
      </>
    );
  };

  const renderModuleBody = (moduleKey: MultisensoryModuleKey) => {
    if (moduleKey === 'smell') {
      return renderSmell();
    }
    if (moduleKey === 'emotion') {
      return renderEmotion();
    }
    return renderSliders(moduleKey, SLIDER_ITEMS[moduleKey] ?? []);
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
        <View
          style={styles.intro}
          onLayout={(event) => {
            introHeight.current = event.nativeEvent.layout.height;
          }}
        >
          <Text style={styles.title}>Multisensory Experience</Text>
          <Text style={styles.subtitle}>
            Rate what you see, smell and feel at this place. Every section is optional.
          </Text>
        </View>

        {MULTISENSORY_MODULES.map((module) => {
          const isOpen = openModule === module.key;
          const answered = countAnsweredItems(value, module.key);
          const isComplete = answered >= module.requiredItems;
          const hasAnything = value[module.key] !== undefined;

          return (
            <View key={module.key} style={[styles.card, isOpen && styles.cardOpen]}>
              <TouchableOpacity
                style={styles.cardHeader}
                onLayout={(event) => {
                  headerHeights.current[module.key] = event.nativeEvent.layout.height;
                }}
                onPress={() => toggleModule(module.key)}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel={`${module.title}, ${module.framework}. ${answered} of ${module.requiredItems} rated`}
                accessibilityState={{ expanded: isOpen }}
              >
                <View style={[styles.iconWrap, isComplete && styles.iconWrapDone]}>
                  <MaterialIcons
                    name={isComplete ? 'check' : MODULE_ICONS[module.key]}
                    size={20}
                    color={isComplete ? Colors.surface : Colors.text}
                  />
                </View>
                <View style={styles.cardHeaderText}>
                  <Text style={styles.cardTitle}>{module.title}</Text>
                  <Text style={styles.cardFramework} numberOfLines={2}>{module.framework}</Text>
                </View>
                <Text style={[styles.progressText, isComplete && styles.progressTextDone]}>
                  {answered}/{module.requiredItems}
                </Text>
                <MaterialIcons
                  name={isOpen ? 'expand-less' : 'expand-more'}
                  size={24}
                  color={Colors.textMuted}
                />
              </TouchableOpacity>

              {isOpen && (
                <View style={styles.cardBody}>
                  <Text style={styles.moduleIntro}>{MODULE_INTROS[module.key]}</Text>
                  {renderModuleBody(module.key)}

                  {hasAnything && (
                    <TouchableOpacity
                      style={styles.clearButton}
                      onPress={() => clearModule(module.key)}
                      accessibilityRole="button"
                      accessibilityLabel={`Clear ${module.title} ratings`}
                    >
                      <MaterialIcons name="restart-alt" size={16} color={Colors.textMuted} />
                      <Text style={styles.clearButtonText}>Clear this section</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </View>
          );
        })}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: tabBarHeight + 16 }]}>
        <Text style={styles.footerStatus}>
          {answeredModules} of {MULTISENSORY_MODULES.length} sections rated
        </Text>
        <TouchableOpacity
          style={styles.confirmButton}
          onPress={() => {
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            onConfirm();
          }}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel={answeredModules === 0 ? 'Skip multisensory ratings' : 'Continue from multisensory ratings'}
        >
          <Text style={styles.confirmButtonText}>
            {answeredModules === 0 ? 'Skip' : 'Continue'}
          </Text>
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
    paddingHorizontal: Spacing.lg,
    paddingTop: CONTENT_PADDING_TOP,
    paddingBottom: Spacing.lg,
    gap: CARD_GAP,
  },
  intro: {
    gap: 6,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.4,
    color: Colors.text,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 19,
    color: Colors.textMuted,
    textAlign: 'center',
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: CARD_BORDER,
    borderColor: Colors.surfaceHighlight,
    overflow: 'hidden',
  },
  cardOpen: {
    borderColor: Colors.secondary,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: Spacing.md,
    minHeight: 68,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primaryMuted,
  },
  iconWrapDone: {
    backgroundColor: Colors.success,
  },
  cardHeaderText: {
    flex: 1,
    minWidth: 0,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
  },
  cardFramework: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
  },
  progressText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textMuted,
    fontVariant: ['tabular-nums'],
  },
  progressTextDone: {
    color: Colors.success,
  },
  cardBody: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.md,
    gap: 18,
    borderTopWidth: 1,
    borderTopColor: Colors.surfaceHighlight,
    paddingTop: Spacing.md,
  },
  moduleIntro: {
    fontSize: 14,
    lineHeight: 19,
    color: Colors.text,
  },
  item: {
    gap: 4,
  },
  itemLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
  },
  itemPrompt: {
    fontSize: 13,
    lineHeight: 18,
    color: Colors.textMuted,
    marginBottom: 2,
  },
  readout: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.text,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  chip: {
    minHeight: 36,
    paddingHorizontal: 12,
    justifyContent: 'center',
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.surfaceHighlight,
    backgroundColor: Colors.background,
  },
  chipSelected: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.text,
  },
  chipTextSelected: {
    color: Colors.surface,
  },
  clearButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    minHeight: 36,
  },
  clearButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textMuted,
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: Colors.surfaceHighlight,
    backgroundColor: Colors.background,
    paddingTop: 12,
    paddingHorizontal: Spacing.lg,
    gap: 10,
  },
  footerStatus: {
    fontSize: 12,
    color: Colors.textMuted,
    textAlign: 'center',
  },
  confirmButton: {
    backgroundColor: Colors.primary,
    paddingVertical: 18,
    borderRadius: Radius.full,
    alignItems: 'center',
  },
  confirmButtonText: {
    color: Colors.background,
    fontSize: 17,
    fontWeight: '700',
  },
});
