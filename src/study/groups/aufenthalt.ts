import type { StudyGroup } from '../types';
import { OTHER_SONSTIGES, lt, ordered } from './helpers';

/**
 * Source: the group's questionnaire in the course folder (WS 2026/27).
 *
 * Not asked again here because Teil 1 of the main questionnaire already
 * records them for every participant: age (from year of birth) and gender.
 *
 * Question 6 is given in the document as "open or semi-open
 * (Verkehr/Menschen/Natur/...)"; the semi-open form is used.
 */
export const AUFENTHALT: StudyGroup = {
  id: 'aufenthalt',
  topic: lt('Klangumgebung und Aufenthaltsqualität', 'Sound environment and quality of stay'),
  icon: 'waveform',
  color: '#3B6E8C',
  softColor: '#D6E3EC',
  sections: [
    {
      key: 'person',
      scope: 'person',
      title: lt('Soziodemographische Daten', 'Sociodemographic data'),
      intro: lt(
        'Alter und Geschlecht haben Sie bereits zu Beginn angegeben. Diese Angaben werden nur einmal abgefragt.',
        'You already gave your age and gender at the start. These details are asked only once.'
      ),
      items: [
        {
          type: 'text',
          key: 'wohnort',
          label: lt('Wohnort', 'Place of residence'),
          prompt: lt(
            'Wo wohnen Sie? Falls Würzburg: Welcher Stadtteil?',
            'Where do you live? If Würzburg: which district?'
          ),
          maxLength: 80,
        },
        {
          type: 'choice',
          key: 'erwerbsstatus',
          label: lt('Erwerbsstatus', 'Employment status'),
          prompt: lt('Was ist Ihr Erwerbsstatus?', 'What is your employment status?'),
          options: [
            { key: 'schueler', label: lt('Schüler/in', 'School student') },
            { key: 'student', label: lt('Student/in', 'University student') },
            { key: 'arbeitnehmer', label: lt('Arbeitnehmer/in', 'Employee') },
            { key: 'selbststaendig', label: lt('Selbstständige/r', 'Self-employed') },
            { key: 'rentner', label: lt('Rentner/in', 'Retired') },
          ],
          other: OTHER_SONSTIGES,
        },
      ],
    },
    {
      key: 'klangumgebung',
      title: lt('Klangumgebung', 'Sound environment'),
      items: [
        {
          type: 'choice',
          key: 'klang_empfinden',
          label: lt('Klangumgebung', 'Sound environment'),
          prompt: lt('Wie empfinden Sie die Klangumgebung?', 'How do you perceive the sound environment?'),
          options: ordered([
            lt('sehr störend', 'very annoying'),
            lt('störend', 'annoying'),
            lt('neutral', 'neutral'),
            lt('angenehm', 'pleasant'),
            lt('sehr angenehm', 'very pleasant'),
          ], -2),
        },
        {
          type: 'choice',
          key: 'klang_wirkung',
          label: lt('Akustische Wirkung', 'Acoustic effect'),
          prompt: lt('Wie wirkt der Ort akustisch?', 'How does the place come across acoustically?'),
          options: ordered([
            lt('chaotisch / aufwühlend', 'chaotic / agitating'),
            lt('eher chaotisch / eher aufwühlend', 'rather chaotic / rather agitating'),
            lt('neutral', 'neutral'),
            lt('eher ruhig / eher entspannend', 'rather calm / rather relaxing'),
            lt('ruhig / entspannend', 'calm / relaxing'),
          ], -2),
        },
        {
          type: 'choice',
          key: 'klang_vielfalt',
          label: lt('Vielfalt', 'Variety'),
          prompt: lt(
            'Wie nehmen Sie die Vielfalt der Geräuschkulisse wahr?',
            'How do you perceive the variety of the soundscape?'
          ),
          options: ordered([
            lt('sehr monoton', 'very monotonous'),
            lt('monoton', 'monotonous'),
            lt('neutral', 'neutral'),
            lt('vielfältig', 'varied'),
            lt('sehr vielfältig', 'very varied'),
          ], -2),
        },
        {
          type: 'choice',
          key: 'klang_dynamik',
          label: lt('Dynamik', 'Dynamics'),
          prompt: lt(
            'Wie nehmen Sie die Dynamik der Geräuschkulisse wahr?',
            'How do you perceive the dynamics of the soundscape?'
          ),
          options: ordered([
            lt('sehr konstant', 'very constant'),
            lt('konstant', 'constant'),
            lt('neutral', 'neutral'),
            lt('wechselhaft', 'changeable'),
            lt('sehr wechselhaft', 'very changeable'),
          ], -2),
        },
        {
          type: 'multi',
          key: 'klang_quellen',
          label: lt('Prägende Geräuschquellen', 'Defining sound sources'),
          prompt: lt(
            'Welche Geräuschquelle(n) prägt für Sie die Klanglandschaft an diesem Ort momentan am stärksten?',
            'Which sound source(s) shape the soundscape at this place most strongly for you right now?'
          ),
          options: [
            { key: 'verkehr', label: lt('Verkehr', 'Traffic') },
            { key: 'menschen', label: lt('Menschen', 'People') },
            { key: 'natur', label: lt('Natur', 'Nature') },
          ],
          other: OTHER_SONSTIGES,
        },
      ],
    },
    {
      key: 'aufenthaltsqualitaet',
      title: lt('Aufenthaltsqualität', 'Quality of stay'),
      items: [
        {
          type: 'scale',
          key: 'aufenthaltsqualitaet',
          label: lt('Aufenthaltsqualität', 'Quality of stay'),
          prompt: lt(
            'Wie bewerten Sie die Aufenthaltsqualität dieses Ortes zum jetzigen Zeitpunkt?',
            'How do you rate the quality of stay at this place at this moment?'
          ),
          hint: lt('Schulnoten: 1 = sehr hoch, 6 = sehr gering.', 'School grades: 1 = very high, 6 = very low.'),
          min: 1,
          max: 6,
          minLabel: lt('sehr hoch', 'very high'),
          maxLabel: lt('sehr gering', 'very low'),
        },
        {
          type: 'text',
          key: 'aufenthaltsqualitaet_grund',
          label: lt('Begründung', 'Reason'),
          prompt: lt(
            'Warum bewerten Sie die Aufenthaltsqualität mit dieser Note?',
            'Why do you give the quality of stay this grade?'
          ),
          multiline: true,
          maxLength: 500,
        },
      ],
    },
  ],
};
