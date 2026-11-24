import type { ChoiceOption, LocalizedText } from '../types';

/** Shorthand for a German/English text pair. */
export function lt(de: string, en: string): LocalizedText {
  return { de, en };
}

/**
 * Ordered answer categories with a numeric code each, e.g. a fully labelled
 * five-point scale. The first label gets the code `start`.
 */
export function ordered(labels: LocalizedText[], start = 1): ChoiceOption[] {
  return labels.map((label, index) => ({
    key: String(start + index),
    value: start + index,
    label,
  }));
}

export const AGREE_5: LocalizedText[] = [
  lt('stimme überhaupt nicht zu', 'strongly disagree'),
  lt('stimme eher nicht zu', 'somewhat disagree'),
  lt('weder noch', 'neither'),
  lt('stimme eher zu', 'somewhat agree'),
  lt('stimme voll zu', 'strongly agree'),
];

export const YES_NO_CANNOT_SAY: ChoiceOption[] = [
  { key: 'ja', label: lt('Ja', 'Yes') },
  { key: 'nein', label: lt('Nein', 'No') },
  { key: 'weiss_nicht', label: lt('Kann ich nicht beurteilen', 'I cannot judge') },
];

export const OTHER_SONSTIGES = lt('Sonstiges', 'Other');
export const OTHER_WEITERES = lt('Weiteres', 'Other');
