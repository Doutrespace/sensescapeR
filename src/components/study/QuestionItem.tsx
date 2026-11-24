import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Colors, Radius, Spacing } from '../../theme/colors';
import { t } from '../../i18n';
import { DotScale } from '../multisensory/DotScale';
import {
  NA_SUFFIX,
  NO_ANSWER_LABEL,
  NO_ANSWER_SUFFIX,
  OTHER_KEY,
  OTHER_SUFFIX,
  isItemAnswered,
  isNoAnswer,
  isNumberInRange,
  matrixRowKey,
  tx,
  type AnswerPatch,
  type AnswerPatchInput,
  type Answers,
  type ChoiceItem,
  type MatrixItem,
  type MultiItem,
  type NumberItem,
  type ScaleItem,
  type StudyItem,
  type TextItem,
} from '../../study/types';

interface Props {
  item: StudyItem;
  answers: Answers;
  onPatch: (patch: AnswerPatchInput) => void;
  accentColor: string;
  softColor: string;
  /** Mark the question when it is required and has no answer yet. */
  showMissing?: boolean;
}

interface BodyProps<T extends StudyItem> {
  item: T;
  answers: Answers;
  onPatch: (patch: AnswerPatchInput) => void;
  accentColor: string;
  softColor: string;
}

/**
 * One question of a data-defined questionnaire (see study/types), rendered as
 * a card with an input that suits its type. All inputs are thumb-sized.
 */
export function QuestionItem({ item, answers, onPatch, accentColor, softColor, showMissing }: Props) {
  const missing = !!showMissing && !!item.required && !isItemAnswered(item, answers);
  const bodyProps = { answers, onPatch, accentColor, softColor };

  return (
    <View style={[styles.card, missing && styles.cardMissing]}>
      {item.label ? (
        <Text style={[styles.label, { color: accentColor }]}>{tx(item.label)}</Text>
      ) : null}
      <Text style={styles.prompt}>{tx(item.prompt)}</Text>
      {item.hint ? <Text style={styles.hint}>{tx(item.hint)}</Text> : null}

      {item.type === 'scale' ? <ScaleBody item={item} {...bodyProps} /> : null}
      {item.type === 'choice' ? <ChoiceBody item={item} {...bodyProps} /> : null}
      {item.type === 'multi' ? <MultiBody item={item} {...bodyProps} /> : null}
      {item.type === 'text' ? <TextBody item={item} {...bodyProps} /> : null}
      {item.type === 'number' ? <NumberBody item={item} {...bodyProps} /> : null}
      {item.type === 'matrix' ? <MatrixBody item={item} {...bodyProps} /> : null}

      {missing ? (
        <View style={styles.missingRow}>
          <MaterialCommunityIcons name="alert-circle-outline" size={16} color={Colors.error} />
          <Text style={styles.missingText}>{t('Please answer this question.')}</Text>
        </View>
      ) : null}
    </View>
  );
}

function NotApplicableButton({
  label,
  selected,
  onPress,
  accentColor,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  accentColor: string;
}) {
  return (
    <TouchableOpacity
      style={[styles.naButton, selected && { backgroundColor: accentColor, borderColor: accentColor }]}
      onPress={() => {
        void Haptics.selectionAsync();
        onPress();
      }}
      activeOpacity={0.8}
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      accessibilityState={{ checked: selected }}
    >
      <MaterialCommunityIcons
        name={selected ? 'check-circle' : 'checkbox-blank-circle-outline'}
        size={18}
        color={selected ? '#FFFFFF' : Colors.textMuted}
      />
      <Text style={[styles.naText, selected && styles.naTextSelected]}>{label}</Text>
    </TouchableOpacity>
  );
}

/**
 * The "does not apply" and "keine Angabe" buttons of a choice or number
 * question. Each one replaces the answer and the other button.
 */
function AlternativeAnswers({
  item,
  answers,
  onPatch,
  accentColor,
}: {
  item: ChoiceItem | NumberItem;
  answers: Answers;
  onPatch: (patch: AnswerPatchInput) => void;
  accentColor: string;
}) {
  if (!item.notApplicable && !item.noAnswer) {
    return null;
  }

  const naKey = item.key + NA_SUFFIX;
  const noAnswerKey = item.key + NO_ANSWER_SUFFIX;
  const isNa = answers[naKey] === true;
  const declined = isNoAnswer(item, answers);

  return (
    <View style={styles.alternativeAnswers}>
      {item.notApplicable ? (
        <NotApplicableButton
          label={tx(item.notApplicable)}
          selected={isNa}
          onPress={() => onPatch(isNa
            ? { [naKey]: undefined }
            : { [item.key]: undefined, [noAnswerKey]: undefined, [naKey]: true })}
          accentColor={accentColor}
        />
      ) : null}
      {item.noAnswer ? (
        <NotApplicableButton
          label={tx(NO_ANSWER_LABEL)}
          selected={declined}
          onPress={() => onPatch(declined
            ? { [noAnswerKey]: undefined }
            : { [item.key]: undefined, [naKey]: undefined, [noAnswerKey]: true })}
          accentColor={accentColor}
        />
      ) : null}
    </View>
  );
}

function ScaleBody({ item, answers, onPatch, accentColor }: BodyProps<ScaleItem>) {
  const stored = answers[item.key];
  const value = typeof stored === 'number' ? stored : null;
  const naKey = item.key + NA_SUFFIX;
  const isNa = answers[naKey] === true;

  return (
    <>
      <DotScale
        min={item.min}
        max={item.max}
        value={value}
        onChange={(next) => onPatch(
          item.notApplicable ? { [item.key]: next, [naKey]: undefined } : { [item.key]: next }
        )}
        accentColor={accentColor}
        accessibilityLabel={tx(item.prompt)}
      />
      <View style={styles.anchorRow}>
        <Text style={styles.anchorText}>
          <Text style={styles.anchorCode}>{item.min}</Text> {tx(item.minLabel)}
        </Text>
        <Text style={[styles.anchorText, styles.anchorRight]}>
          {tx(item.maxLabel)} <Text style={styles.anchorCode}>{item.max}</Text>
        </Text>
      </View>
      {item.notApplicable ? (
        <NotApplicableButton
          label={tx(item.notApplicable)}
          selected={isNa}
          onPress={() => onPatch(isNa ? { [naKey]: undefined } : { [item.key]: undefined, [naKey]: true })}
          accentColor={accentColor}
        />
      ) : null}
    </>
  );
}

function OptionRow({
  label,
  code,
  selected,
  onPress,
  accentColor,
  softColor,
}: {
  label: string;
  code?: string;
  selected: boolean;
  onPress: () => void;
  accentColor: string;
  softColor: string;
}) {
  return (
    <TouchableOpacity
      style={[styles.optionRow, selected && { borderColor: accentColor, backgroundColor: softColor }]}
      onPress={onPress}
      activeOpacity={0.8}
      accessibilityRole="radio"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
    >
      {code !== undefined ? (
        <View style={[styles.codeDot, selected && { backgroundColor: accentColor, borderColor: accentColor }]}>
          <Text style={[styles.codeText, selected && styles.codeTextSelected]}>{code}</Text>
        </View>
      ) : (
        <MaterialCommunityIcons
          name={selected ? 'radiobox-marked' : 'radiobox-blank'}
          size={24}
          color={selected ? accentColor : Colors.textDisabled}
        />
      )}
      <Text style={[styles.optionLabel, selected && styles.optionLabelSelected]}>{label}</Text>
    </TouchableOpacity>
  );
}

function ChoiceBody({ item, answers, onPatch, accentColor, softColor }: BodyProps<ChoiceItem>) {
  const value = answers[item.key];
  const naKey = item.key + NA_SUFFIX;
  const otherKey = item.key + OTHER_SUFFIX;
  // "Does not apply" or "keine Angabe" chosen instead of an option.
  const isAlternative = answers[naKey] === true || isNoAnswer(item, answers);
  const otherText = answers[otherKey];
  // Scales that run through zero (e.g. -2 to +2) show the sign.
  const signed = item.options.some((option) => typeof option.value === 'number' && option.value < 0);

  const select = (next: string | number) => {
    void Haptics.selectionAsync();
    onPatch({
      [item.key]: next,
      ...(item.notApplicable ? { [naKey]: undefined } : {}),
      ...(item.noAnswer ? { [item.key + NO_ANSWER_SUFFIX]: undefined } : {}),
    });
  };

  return (
    <View style={styles.optionList} accessibilityRole="radiogroup" accessibilityLabel={tx(item.prompt)}>
      {item.options.map((option) => {
        const optionValue = option.value ?? option.key;
        const code = typeof option.value === 'number'
          ? `${signed && option.value > 0 ? '+' : ''}${option.value}`
          : undefined;
        return (
          <OptionRow
            key={option.key}
            label={tx(option.label)}
            code={code}
            selected={!isAlternative && value === optionValue}
            onPress={() => select(optionValue)}
            accentColor={accentColor}
            softColor={softColor}
          />
        );
      })}

      {item.other ? (
        <OptionRow
          label={tx(item.other)}
          selected={!isAlternative && value === OTHER_KEY}
          onPress={() => select(OTHER_KEY)}
          accentColor={accentColor}
          softColor={softColor}
        />
      ) : null}

      {item.other && value === OTHER_KEY ? (
        <TextInput
          style={styles.textInput}
          value={typeof otherText === 'string' ? otherText : ''}
          onChangeText={(text) => onPatch({ [otherKey]: text })}
          placeholder={t('Please specify')}
          placeholderTextColor={Colors.textDisabled}
          maxLength={120}
          accessibilityLabel={`${tx(item.other)}: ${t('Please specify')}`}
        />
      ) : null}

      <AlternativeAnswers item={item} answers={answers} onPatch={onPatch} accentColor={accentColor} />
    </View>
  );
}

function MultiBody({ item, answers, onPatch, accentColor }: BodyProps<MultiItem>) {
  const stored = answers[item.key];
  const selected = Array.isArray(stored) ? stored : [];
  const otherKey = item.key + OTHER_SUFFIX;
  const otherText = answers[otherKey];
  const order = [...item.options.map((option) => option.key), OTHER_KEY];

  const toggle = (key: string, exclusive?: boolean) => {
    void Haptics.selectionAsync();
    // Built on the latest answers, not on what was last drawn, so two quick
    // taps both count.
    onPatch((latest) => {
      const latestValue = latest[item.key];
      const current = Array.isArray(latestValue) ? latestValue : [];
      let next: string[];
      if (current.includes(key)) {
        next = current.filter((entry) => entry !== key);
      } else if (exclusive) {
        // e.g. "no smell noticed" rules out every other answer.
        next = [key];
      } else {
        const exclusiveKeys = item.options.filter((option) => option.exclusive).map((option) => option.key);
        next = [...current.filter((entry) => !exclusiveKeys.includes(entry)), key];
      }
      // Always stored in the order of the answer list, whatever was tapped first.
      next.sort((a, b) => order.indexOf(a) - order.indexOf(b));
      return { [item.key]: next.length > 0 ? next : undefined };
    });
  };

  const renderChip = (key: string, label: string, exclusive?: boolean) => {
    const isSelected = selected.includes(key);
    return (
      <TouchableOpacity
        key={key}
        style={[styles.chip, isSelected && { backgroundColor: accentColor, borderColor: accentColor }]}
        onPress={() => toggle(key, exclusive)}
        activeOpacity={0.8}
        accessibilityRole="checkbox"
        accessibilityLabel={label}
        accessibilityState={{ checked: isSelected }}
      >
        <MaterialCommunityIcons
          name={isSelected ? 'check' : 'plus'}
          size={16}
          color={isSelected ? '#FFFFFF' : Colors.textMuted}
        />
        <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>{label}</Text>
      </TouchableOpacity>
    );
  };

  return (
    <>
      <View style={styles.chipWrap}>
        {item.options.map((option) => renderChip(option.key, tx(option.label), option.exclusive))}
        {item.other ? renderChip(OTHER_KEY, tx(item.other)) : null}
      </View>
      {item.other && selected.includes(OTHER_KEY) ? (
        <TextInput
          style={styles.textInput}
          value={typeof otherText === 'string' ? otherText : ''}
          onChangeText={(text) => onPatch({ [otherKey]: text })}
          placeholder={t('Please specify')}
          placeholderTextColor={Colors.textDisabled}
          maxLength={120}
          accessibilityLabel={`${tx(item.other)}: ${t('Please specify')}`}
        />
      ) : null}
    </>
  );
}

function TextBody({ item, answers, onPatch }: BodyProps<TextItem>) {
  const stored = answers[item.key];

  return (
    <TextInput
      style={[styles.textInput, item.multiline && styles.textInputMultiline]}
      value={typeof stored === 'string' ? stored : ''}
      onChangeText={(text) => onPatch({
        [item.key]: item.numeric ? text.replace(/[^0-9]/g, '') : text,
      })}
      placeholder={item.placeholder ? tx(item.placeholder) : t('Your answer')}
      placeholderTextColor={Colors.textDisabled}
      multiline={item.multiline}
      maxLength={item.maxLength}
      keyboardType={item.numeric ? 'number-pad' : 'default'}
      inputMode={item.numeric ? 'numeric' : 'text'}
      textAlignVertical={item.multiline ? 'top' : 'center'}
      accessibilityLabel={tx(item.prompt)}
    />
  );
}

function NumberBody({ item, answers, onPatch, accentColor }: BodyProps<NumberItem>) {
  const stored = answers[item.key];
  const naKey = item.key + NA_SUFFIX;
  const noAnswerKey = item.key + NO_ANSWER_SUFFIX;
  const isAlternative = answers[naKey] === true || isNoAnswer(item, answers);
  const maxLength = item.maxLength ?? 6;
  const [text, setText] = useState(typeof stored === 'number' ? String(stored) : '');
  const [blurred, setBlurred] = useState(false);

  // "Does not apply" and "keine Angabe" clear the number field.
  useEffect(() => {
    if (isAlternative) {
      setText('');
    }
  }, [isAlternative]);

  const invalid = text !== '' && !isNumberInRange(item, Number(text));
  const showError = invalid && (blurred || text.length >= maxLength);

  const handleChange = (raw: string) => {
    const digits = raw.replace(/[^0-9]/g, '').slice(0, maxLength);
    setText(digits);
    const parsed = digits === '' ? Number.NaN : Number(digits);
    const patch: AnswerPatch = { [item.key]: isNumberInRange(item, parsed) ? parsed : undefined };
    if (digits !== '') {
      if (item.notApplicable) {
        patch[naKey] = undefined;
      }
      if (item.noAnswer) {
        patch[noAnswerKey] = undefined;
      }
    }
    onPatch(patch);
  };

  return (
    <>
      <View style={styles.numberRow}>
        <TextInput
          style={[styles.numberInput, showError && styles.inputError]}
          value={text}
          onChangeText={handleChange}
          onBlur={() => setBlurred(true)}
          placeholder={item.placeholder ? tx(item.placeholder) : '–'}
          placeholderTextColor={Colors.textDisabled}
          keyboardType="number-pad"
          inputMode="numeric"
          maxLength={maxLength}
          accessibilityLabel={tx(item.prompt)}
        />
        {item.unit ? <Text style={styles.numberUnit}>{tx(item.unit)}</Text> : null}
      </View>
      {showError ? (
        <Text style={styles.errorText}>
          {t('Please enter a number between {min} and {max}.', { min: item.min, max: item.max })}
        </Text>
      ) : null}
      <AlternativeAnswers item={item} answers={answers} onPatch={onPatch} accentColor={accentColor} />
    </>
  );
}

function MatrixBody({ item, answers, onPatch, accentColor, softColor }: BodyProps<MatrixItem>) {
  return (
    <View style={styles.matrix}>
      <View style={[styles.matrixLegend, { backgroundColor: softColor }]}>
        {item.pointLabels.map((label, index) => (
          <Text key={label.de} style={styles.matrixLegendText}>
            <Text style={[styles.matrixLegendCode, { color: accentColor }]}>{item.min + index}</Text>
            {'  '}
            {tx(label)}
          </Text>
        ))}
      </View>

      {item.rows.map((row) => {
        const key = matrixRowKey(item, row.key);
        const stored = answers[key];
        return (
          <View key={row.key} style={styles.matrixRow}>
            <Text style={styles.matrixRowLabel}>{tx(row.label)}</Text>
            <DotScale
              min={item.min}
              max={item.max}
              value={typeof stored === 'number' ? stored : null}
              onChange={(next) => onPatch({ [key]: next })}
              accentColor={accentColor}
              accessibilityLabel={tx(row.label)}
            />
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.surfaceHighlight,
    padding: Spacing.md,
    gap: 10,
  },
  cardMissing: {
    borderColor: Colors.error,
    borderWidth: 1.5,
  },
  label: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  prompt: {
    fontSize: 17,
    lineHeight: 23,
    fontWeight: '700',
    color: Colors.text,
  },
  hint: {
    fontSize: 13,
    lineHeight: 18,
    color: Colors.textMuted,
    marginTop: -4,
  },
  missingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  missingText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.error,
  },
  anchorRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  anchorText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 16,
    color: Colors.textMuted,
  },
  anchorRight: {
    textAlign: 'right',
  },
  anchorCode: {
    fontWeight: '800',
    color: Colors.text,
  },
  alternativeAnswers: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  naButton: {
    alignSelf: 'flex-start',
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    borderRadius: Radius.full,
    borderWidth: 1.5,
    borderColor: Colors.surfaceHighlight,
    borderStyle: 'dashed',
    backgroundColor: Colors.background,
  },
  naText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textMuted,
    flexShrink: 1,
  },
  naTextSelected: {
    color: '#FFFFFF',
  },
  optionList: {
    gap: 8,
  },
  optionRow: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: Colors.surfaceHighlight,
    backgroundColor: Colors.background,
  },
  optionLabel: {
    flex: 1,
    fontSize: 16,
    lineHeight: 21,
    color: Colors.text,
  },
  optionLabelSelected: {
    fontWeight: '700',
  },
  codeDot: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#E3DED4',
  },
  codeText: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.textMuted,
    fontVariant: ['tabular-nums'],
  },
  codeTextSelected: {
    color: '#FFFFFF',
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    minHeight: 44,
    maxWidth: '100%',
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: Colors.surfaceHighlight,
    backgroundColor: Colors.background,
  },
  chipText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text,
    flexShrink: 1,
  },
  chipTextSelected: {
    color: '#FFFFFF',
  },
  textInput: {
    minHeight: 50,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: Colors.surfaceHighlight,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 12,
    // 16px keeps iOS Safari from zooming into the field on focus.
    fontSize: 16,
    color: Colors.text,
  },
  textInputMultiline: {
    minHeight: 96,
  },
  inputError: {
    borderColor: Colors.error,
  },
  errorText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.error,
  },
  numberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  numberInput: {
    width: 132,
    minHeight: 56,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: Colors.surfaceHighlight,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
    color: Colors.text,
    fontVariant: ['tabular-nums'],
  },
  numberUnit: {
    flex: 1,
    fontSize: 15,
    color: Colors.textMuted,
  },
  matrix: {
    gap: 14,
  },
  matrixLegend: {
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 3,
  },
  matrixLegendText: {
    fontSize: 13,
    lineHeight: 18,
    color: Colors.text,
  },
  matrixLegendCode: {
    fontWeight: '800',
  },
  matrixRow: {
    gap: 6,
  },
  matrixRowLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
  },
});
