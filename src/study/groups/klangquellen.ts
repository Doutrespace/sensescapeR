import type { ChoiceOption, StudyGroup } from '../types';
import { OTHER_SONSTIGES, lt, ordered } from './helpers';

/**
 * Source: the group's collection of questions in the course folder
 * (Angewandte Humangeographische Projektstudie: Sensuous Geography).
 *
 * Not asked again here because Teil 1 of the main questionnaire already
 * records them: age (from year of birth) and gender.
 */

const SOUND_OPTIONS: ChoiceOption[] = [
  { key: 'unterhaltungen', label: lt('Unterhaltungen', 'Conversations') },
  { key: 'musik', label: lt('Musik', 'Music') },
  { key: 'lachen', label: lt('Lachen', 'Laughter') },
  { key: 'verkehr', label: lt('Verkehr', 'Traffic') },
  { key: 'baustellen', label: lt('Baustellen', 'Construction sites') },
  { key: 'industrie', label: lt('Industrie', 'Industry') },
  { key: 'kinder', label: lt('Kinder', 'Children') },
  { key: 'regen', label: lt('Regen', 'Rain') },
  { key: 'gewitter', label: lt('Gewitter', 'Thunderstorm') },
  { key: 'wind', label: lt('Wind', 'Wind') },
  { key: 'wasser', label: lt('Wasser', 'Water') },
  { key: 'vogelgesang', label: lt('Vogelgesang', 'Birdsong') },
  { key: 'hundebellen', label: lt('Hundebellen', 'Dogs barking') },
];

export const KLANGQUELLEN: StudyGroup = {
  id: 'klangquellen',
  topic: lt('Klangquellen, Klangqualität und Umgebung', 'Sound sources, sound quality and surroundings'),
  icon: 'ear-hearing',
  sections: [
    {
      key: 'person',
      scope: 'person',
      title: lt('Personenbezogene Fragen', 'Questions about you'),
      intro: lt(
        'Alter und Geschlecht haben Sie bereits zu Beginn angegeben. Diese Angaben werden nur einmal abgefragt.',
        'You already gave your age and gender at the start. These details are asked only once.'
      ),
      items: [
        {
          type: 'text',
          key: 'wohnort',
          label: lt('Wohnort', 'Place of residence'),
          prompt: lt('Wo wohnen Sie?', 'Where do you live?'),
          maxLength: 80,
        },
        {
          type: 'text',
          key: 'abschluss',
          label: lt('Abschluss', 'Qualification'),
          prompt: lt('Welchen Abschluss haben Sie?', 'What is your highest qualification?'),
          maxLength: 80,
        },
      ],
    },
    {
      key: 'klang',
      title: lt('Klangquellen und Klangqualität', 'Sound sources and sound quality'),
      items: [
        {
          type: 'multi',
          key: 'geraeusche_wahrgenommen',
          label: lt('Wahrgenommene Geräusche', 'Sounds noticed'),
          prompt: lt('Welche Geräusche nehmen Sie wahr?', 'Which sounds do you notice?'),
          hint: lt('Mehrfachantworten möglich.', 'Multiple answers possible.'),
          options: SOUND_OPTIONS,
          other: OTHER_SONSTIGES,
        },
        {
          type: 'multi',
          key: 'geraeusche_staerkste',
          label: lt('Stärkste Geräusche', 'Strongest sounds'),
          prompt: lt(
            'Welche Geräusche nehmen Sie in diesem Moment am stärksten wahr?',
            'Which sounds do you notice most strongly at this moment?'
          ),
          hint: lt('Mehrfachantworten möglich.', 'Multiple answers possible.'),
          options: SOUND_OPTIONS,
          other: OTHER_SONSTIGES,
        },
        {
          type: 'scale',
          key: 'dominierend_stoerend',
          label: lt('Dominierendes Geräusch', 'Dominant sound'),
          prompt: lt(
            'Nehmen Sie das dominierende Geräusch als störend wahr?',
            'Do you perceive the dominant sound as annoying?'
          ),
          min: 1,
          max: 5,
          minLabel: lt('überhaupt nicht störend', 'not at all annoying'),
          maxLabel: lt('sehr störend', 'very annoying'),
        },
        {
          type: 'multi',
          key: 'geraeuschkulisse',
          label: lt('Geräuschkulisse', 'Soundscape'),
          prompt: lt('Wie nehmen Sie die Geräuschkulisse wahr?', 'How do you perceive the soundscape?'),
          hint: lt('Mehrfachantworten möglich.', 'Multiple answers possible.'),
          options: [
            { key: 'ruhig', label: lt('ruhig', 'calm') },
            { key: 'chaotisch', label: lt('chaotisch', 'chaotic') },
            { key: 'klar', label: lt('klar', 'clear') },
            { key: 'laut', label: lt('laut', 'loud') },
          ],
          other: OTHER_SONSTIGES,
        },
        {
          type: 'choice',
          key: 'klanglandschaft_angenehm',
          label: lt('Klanglandschaft', 'Soundscape pleasantness'),
          prompt: lt(
            'Wie empfinden Sie die Klanglandschaft von 1 (sehr unangenehm) bis 5 (sehr angenehm)?',
            'How do you find the soundscape, from 1 (very unpleasant) to 5 (very pleasant)?'
          ),
          options: ordered([
            lt('sehr unangenehm', 'very unpleasant'),
            lt('nicht angenehm', 'not pleasant'),
            lt('neutral', 'neutral'),
            lt('angenehm', 'pleasant'),
            lt('sehr angenehm', 'very pleasant'),
          ]),
        },
      ],
    },
    {
      key: 'umgebung',
      title: lt('Fragen zur Umgebung', 'Questions about the surroundings'),
      items: [
        {
          type: 'scale',
          key: 'verweilen',
          label: lt('Verweilen', 'Lingering'),
          prompt: lt(
            'Lädt dieser Ort Sie zum längeren Verweilen ein?',
            'Does this place invite you to stay for longer?'
          ),
          min: 1,
          max: 5,
          minLabel: lt('gar nicht', 'not at all'),
          maxLabel: lt('auf jeden Fall', 'definitely'),
        },
        {
          type: 'choice',
          key: 'besuchshaeufigkeit',
          label: lt('Besuchshäufigkeit', 'Frequency of visits'),
          prompt: lt('Wie oft besuchen Sie diesen Ort?', 'How often do you visit this place?'),
          options: ordered([
            lt('weniger als einmal im Monat', 'less than once a month'),
            lt('einmal im Monat', 'once a month'),
            lt('einmal die Woche', 'once a week'),
            lt('mehrmals die Woche', 'several times a week'),
            lt('täglich', 'daily'),
          ]),
        },
        {
          type: 'choice',
          key: 'erholung',
          label: lt('Erholung', 'Recreation'),
          prompt: lt(
            'Bietet der Ort für Sie Möglichkeit zur Erholung?',
            'Does the place offer you an opportunity for recreation?'
          ),
          options: ordered([
            lt('nein', 'no'),
            lt('eher nein', 'rather no'),
            lt('weder noch', 'neither'),
            lt('eher ja', 'rather yes'),
            lt('ja', 'yes'),
          ]),
        },
        {
          type: 'text',
          key: 'erholung_grund',
          prompt: lt('Woran machen Sie diese Bewertung fest?', 'What is this rating based on?'),
          multiline: true,
          maxLength: 500,
        },
        {
          type: 'text',
          key: 'besuchsgrund',
          label: lt('Besuchsgrund', 'Reason for visit'),
          prompt: lt('Wieso besuchen Sie heute diesen Ort?', 'Why are you visiting this place today?'),
          multiline: true,
          maxLength: 500,
        },
        {
          type: 'scale',
          key: 'ort_angenehm',
          label: lt('Ort insgesamt', 'Place overall'),
          prompt: lt(
            'Wie angenehm empfinden Sie diesen Ort von 1 (sehr unangenehm) bis 5 (sehr angenehm)?',
            'How pleasant do you find this place, from 1 (very unpleasant) to 5 (very pleasant)?'
          ),
          min: 1,
          max: 5,
          minLabel: lt('sehr unangenehm', 'very unpleasant'),
          maxLabel: lt('sehr angenehm', 'very pleasant'),
        },
        {
          type: 'text',
          key: 'ort_angenehm_grund',
          prompt: lt('Woran machen Sie diese Bewertung fest?', 'What is this rating based on?'),
          multiline: true,
          maxLength: 500,
        },
        {
          type: 'choice',
          key: 'gestaltung',
          label: lt('Gestaltung', 'Design'),
          prompt: lt(
            'Wie ansprechend empfinden Sie die Gestaltung des Ortes?',
            'How appealing do you find the design of the place?'
          ),
          options: ordered([
            lt('nicht ansprechend', 'not appealing'),
            lt('eher nicht ansprechend', 'rather not appealing'),
            lt('weder noch', 'neither'),
            lt('eher ansprechend', 'rather appealing'),
            lt('ansprechend', 'appealing'),
          ]),
        },
        {
          type: 'scale',
          key: 'begruenung',
          label: lt('Begrünung', 'Greenery'),
          prompt: lt('Wie bewerten Sie die Begrünung des Ortes?', 'How do you rate the greenery of the place?'),
          min: 1,
          max: 5,
          minLabel: lt('zu wenig', 'too little'),
          maxLabel: lt('genau richtig', 'just right'),
        },
      ],
    },
  ],
};
