/**
 * Questions that belong to the main questionnaire and are the same for
 * everybody: the personal details asked once ("Teil 1"), and the question
 * whether the participant is passing through or staying.
 */
import type { ChoiceItem, LocalizedText, StudyItem, TextItem } from './types';

/**
 * Version of the questions as shown to participants. It is written to every
 * saved measurement, so answers can later be matched to the exact wording.
 * Change it whenever a question, a scale or an answer option changes.
 */
export const QUESTIONNAIRE_VERSION = '2026-11-24.2';

/** Version of the consent text the participant agreed to. */
export const CONSENT_VERSION = '2026-11-24.2';

const CURRENT_YEAR = new Date().getFullYear();

export const PERSON_SECTION_TITLE: LocalizedText = {
  de: 'Teil 1: Angaben zu Ihrer Person (einmalig)',
  en: 'Part 1: About you (asked once)',
};

/** Teil 1 of the course questionnaire, items P1 to P3. */
export const PERSON_ITEMS: StudyItem[] = [
  {
    type: 'number',
    key: 'birth_year',
    label: { de: 'P1', en: 'P1' },
    prompt: { de: 'In welchem Jahr sind Sie geboren?', en: 'In which year were you born?' },
    placeholder: { de: 'JJJJ', en: 'YYYY' },
    unit: { de: 'Geburtsjahr (JJJJ)', en: 'Year of birth (YYYY)' },
    min: 1900,
    max: CURRENT_YEAR,
    maxLength: 4,
    noAnswer: true,
    required: true,
  },
  {
    type: 'choice',
    key: 'gender',
    label: { de: 'P2', en: 'P2' },
    prompt: { de: 'Welches Geschlecht haben Sie?', en: 'What is your gender?' },
    options: [
      { key: 'male', label: { de: 'männlich', en: 'male' } },
      { key: 'female', label: { de: 'weiblich', en: 'female' } },
      { key: 'diverse', label: { de: 'divers', en: 'diverse' } },
    ],
    noAnswer: true,
    required: true,
  },
  {
    type: 'number',
    key: 'years_in_wuerzburg',
    label: { de: 'P3', en: 'P3' },
    prompt: {
      de: 'Seit wie vielen Jahren wohnen Sie in Würzburg?',
      en: 'For how many years have you lived in Würzburg?',
    },
    unit: { de: 'Jahre', en: 'years' },
    min: 0,
    max: 120,
    maxLength: 3,
    notApplicable: { de: 'wohne nicht in Würzburg', en: 'I do not live in Würzburg' },
    noAnswer: true,
    required: true,
  },
];

export type VisitMode = 'passing' | 'staying';

/** Asked at every measurement, on the context page. */
export const VISIT_MODE_ITEM: ChoiceItem = {
  type: 'choice',
  key: 'visit_mode',
  label: { de: 'Aufenthalt', en: 'Your visit' },
  prompt: {
    de: 'Sind Sie an diesem Ort gerade nur auf der Durchreise oder halten Sie sich hier auf?',
    en: 'Are you just passing through this place right now, or are you staying here?',
  },
  options: [
    { key: 'passing', label: { de: 'Ich komme nur vorbei', en: 'I am just passing by' } },
    { key: 'staying', label: { de: 'Ich halte mich hier auf', en: 'I am staying here' } },
  ],
  required: true,
};

/**
 * Who answered the questionnaire of a measurement. Students can also use the
 * app to interview another person; that person's details then belong to the
 * measurement instead of the details stored on the device.
 */
export const RESPONDENT_ITEM: ChoiceItem = {
  type: 'choice',
  key: 'respondent',
  label: { de: 'Befragte Person', en: 'Respondent' },
  prompt: {
    de: 'Wer hat die Fragen dieser Messung beantwortet?',
    en: 'Who answered the questions of this measurement?',
  },
  options: [
    { key: 'self', label: { de: 'Ich selbst', en: 'I did' } },
    { key: 'other', label: { de: 'Eine andere Person (Befragung)', en: 'Another person (interview)' } },
  ],
  required: true,
};

/** Optional label for fixed measuring points, so repeated visits can be grouped. */
export const SITE_CODE_ITEM: TextItem = {
  type: 'text',
  key: 'site_code',
  label: { de: 'Messpunkt (optional)', en: 'Measuring point (optional)' },
  prompt: {
    de: 'Hat dieser Standort in Ihrem Projekt eine Bezeichnung?',
    en: 'Does this location have a name or code in your project?',
  },
  hint: {
    de: 'Verwenden Sie für denselben Ort immer dieselbe Bezeichnung.',
    en: 'Always use the same label for the same place.',
  },
  placeholder: { de: 'z. B. M1 oder Mainkai', en: 'e.g. M1 or riverside' },
  maxLength: 40,
};
