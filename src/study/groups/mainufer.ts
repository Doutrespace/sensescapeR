import type { StudyGroup } from '../types';
import { AGREE_5, OTHER_SONSTIGES, YES_NO_CANNOT_SAY, lt } from './helpers';

/**
 * Source: the group's questionnaire in the course folder (Projektseminar
 * Sensescapes: Würzburger Mainufer), questions 1-12.
 *
 * As stated in the document, pleasantness and eventfulness (ISO/TS 12913-3)
 * are calculated from the eight ratings of question 6; the export adds both
 * values next to the eight ratings.
 */
export const MAINUFER: StudyGroup = {
  id: 'mainufer',
  topic: lt(
    'Würzburger Mainufer: Geruch, Geräusche und Erholung',
    'Würzburg Main riverbank: smell, sound and recreation'
  ),
  icon: 'waves',
  sections: [
    {
      key: 'geruch',
      title: lt('Geruch', 'Smell'),
      items: [
        {
          type: 'scale',
          key: 'geruch_angenehm',
          label: lt('Geruch insgesamt', 'Smell overall'),
          prompt: lt(
            'Wie angenehm empfinden Sie den Geruch hier insgesamt?',
            'How pleasant do you find the smell here overall?'
          ),
          hint: lt('Schulnoten: 1 = sehr angenehm, 6 = sehr unangenehm.', 'School grades: 1 = very pleasant, 6 = very unpleasant.'),
          min: 1,
          max: 6,
          minLabel: lt('sehr angenehm', 'very pleasant'),
          maxLabel: lt('sehr unangenehm', 'very unpleasant'),
          notApplicable: lt('Kein Geruch wahrgenommen', 'No smell noticed'),
        },
        {
          type: 'multi',
          key: 'geruch_quellen',
          label: lt('Gerüche', 'Smells'),
          prompt: lt('Wonach riecht es hier gerade?', 'What does it smell of here right now?'),
          hint: lt('Mehrfachauswahl möglich.', 'Multiple answers possible.'),
          options: [
            { key: 'natur', label: lt('Natur', 'Nature') },
            { key: 'essen', label: lt('Essen oder Gastronomie', 'Food or restaurants') },
            { key: 'menschen', label: lt('Menschen', 'People') },
            { key: 'verkehr', label: lt('Verkehr', 'Traffic') },
            { key: 'industrie', label: lt('Industrie', 'Industry') },
            { key: 'abfall', label: lt('Abfall', 'Waste') },
            { key: 'kein_geruch', label: lt('Kein Geruch wahrgenommen', 'No smell noticed'), exclusive: true },
          ],
          other: OTHER_SONSTIGES,
        },
        {
          type: 'text',
          key: 'geruch_beschreibung',
          label: lt('Genauere Beschreibung', 'More detail'),
          prompt: lt('Möchten Sie den Geruch genauer beschreiben? (optional)', 'Would you like to describe the smell in more detail? (optional)'),
          multiline: true,
          maxLength: 300,
        },
        {
          type: 'scale',
          key: 'geruch_passung',
          label: lt('Passung der Gerüche', 'Fit of the smells'),
          prompt: lt(
            'Wie gut passen die Gerüche, die Sie hier gerade wahrnehmen, zu diesem Ort?',
            'How well do the smells you notice here right now fit this place?'
          ),
          hint: lt('Schulnoten: 1 = passt sehr gut, 6 = passt überhaupt nicht.', 'School grades: 1 = fits very well, 6 = does not fit at all.'),
          min: 1,
          max: 6,
          minLabel: lt('passt sehr gut', 'fits very well'),
          maxLabel: lt('passt überhaupt nicht', 'does not fit at all'),
          notApplicable: lt('Kein Geruch wahrgenommen', 'No smell noticed'),
        },
        {
          type: 'choice',
          key: 'geruch_wunsch',
          label: lt('Wunsch nach anderem Geruch', 'Wish for a different smell'),
          prompt: lt(
            'Würden Sie sich wünschen, dass es hier anders riecht?',
            'Would you wish for it to smell differently here?'
          ),
          options: YES_NO_CANNOT_SAY,
        },
        {
          type: 'text',
          key: 'geruch_wunsch_was',
          prompt: lt('Was würden Sie sich wünschen?', 'What would you wish for?'),
          showIf: { key: 'geruch_wunsch', equals: 'ja' },
          maxLength: 300,
        },
        {
          type: 'choice',
          key: 'geruch_hoerbar',
          label: lt('Geruch und Geräusch', 'Smell and sound'),
          prompt: lt(
            'Stammt einer der Gerüche Ihrer Einschätzung nach von etwas, das Sie hier auch hören?',
            'In your judgement, does one of the smells come from something you can also hear here?'
          ),
          options: YES_NO_CANNOT_SAY,
        },
        {
          type: 'text',
          key: 'geruch_hoerbar_quelle',
          prompt: lt('Was ist die vermutete Quelle?', 'What do you think the source is?'),
          showIf: { key: 'geruch_hoerbar', equals: 'ja' },
          maxLength: 200,
        },
      ],
    },
    {
      key: 'geraeusche',
      title: lt('Geräusche', 'Sounds'),
      items: [
        {
          type: 'matrix',
          key: 'geraeusch_paq',
          label: lt('Geräuschumgebung', 'Sound environment'),
          prompt: lt(
            'Inwieweit stimmen Sie zu, dass die Geräuschumgebung hier gerade … ist?',
            'To what extent do you agree that the sound environment here is currently …?'
          ),
          rows: [
            { key: 'angenehm', label: lt('angenehm', 'pleasant') },
            { key: 'chaotisch', label: lt('chaotisch', 'chaotic') },
            { key: 'lebendig', label: lt('lebendig', 'vibrant') },
            { key: 'ereignisarm', label: lt('ereignisarm', 'uneventful') },
            { key: 'ruhig', label: lt('ruhig', 'calm') },
            { key: 'stoerend', label: lt('störend', 'annoying') },
            { key: 'ereignisreich', label: lt('ereignisreich', 'eventful') },
            { key: 'monoton', label: lt('monoton', 'monotonous') },
          ],
          min: 1,
          max: 5,
          pointLabels: AGREE_5,
          paq: {
            pleasant: 'angenehm',
            chaotic: 'chaotisch',
            vibrant: 'lebendig',
            uneventful: 'ereignisarm',
            calm: 'ruhig',
            annoying: 'stoerend',
            eventful: 'ereignisreich',
            monotonous: 'monoton',
          },
        },
        {
          type: 'scale',
          key: 'geraeusch_angenehm',
          label: lt('Geräusche insgesamt', 'Sounds overall'),
          prompt: lt(
            'Wie angenehm empfinden Sie die Geräusche hier insgesamt?',
            'How pleasant do you find the sounds here overall?'
          ),
          hint: lt('Schulnoten: 1 = sehr angenehm, 6 = sehr störend.', 'School grades: 1 = very pleasant, 6 = very annoying.'),
          min: 1,
          max: 6,
          minLabel: lt('sehr angenehm', 'very pleasant'),
          maxLabel: lt('sehr störend', 'very annoying'),
        },
        {
          type: 'scale',
          key: 'geraeusch_passung',
          label: lt('Passung der Geräusche', 'Fit of the sounds'),
          prompt: lt(
            'Wie gut passen die Geräusche, die Sie hier gerade wahrnehmen, zu diesem Ort?',
            'How well do the sounds you notice here right now fit this place?'
          ),
          hint: lt('Schulnoten: 1 = passt sehr gut, 6 = passt überhaupt nicht.', 'School grades: 1 = fits very well, 6 = does not fit at all.'),
          min: 1,
          max: 6,
          minLabel: lt('passt sehr gut', 'fits very well'),
          maxLabel: lt('passt überhaupt nicht', 'does not fit at all'),
          notApplicable: lt('Keine Geräusche wahrgenommen', 'No sounds noticed'),
        },
        {
          type: 'multi',
          key: 'geraeusch_quellen',
          label: lt('Geräuschquellen', 'Sound sources'),
          prompt: lt(
            'Woher kommen die Geräusche, die Sie hier gerade hören?',
            'Where do the sounds you hear right now come from?'
          ),
          hint: lt('Mehrfachauswahl möglich.', 'Multiple answers possible.'),
          options: [
            { key: 'menschen', label: lt('Menschen', 'People') },
            { key: 'tiere', label: lt('Tiere', 'Animals') },
            { key: 'natur', label: lt('Natur (z. B. Wind oder Wasser)', 'Nature (e.g. wind or water)') },
            { key: 'verkehr', label: lt('Verkehr', 'Traffic') },
            { key: 'baustelle_industrie', label: lt('Baustelle oder Industrie', 'Construction or industry') },
            { key: 'keine_geraeusche', label: lt('Keine Geräusche wahrgenommen', 'No sounds noticed'), exclusive: true },
          ],
          other: OTHER_SONSTIGES,
        },
        {
          type: 'choice',
          key: 'geraeusch_riechbar',
          label: lt('Geräusch und Geruch', 'Sound and smell'),
          prompt: lt(
            'Kommt eines der Geräusche Ihrer Einschätzung nach von etwas, das Sie hier auch riechen?',
            'In your judgement, does one of the sounds come from something you can also smell here?'
          ),
          options: YES_NO_CANNOT_SAY,
        },
        {
          type: 'text',
          key: 'geraeusch_riechbar_quelle',
          prompt: lt('Was ist die vermutete Quelle?', 'What do you think the source is?'),
          showIf: { key: 'geraeusch_riechbar', equals: 'ja' },
          maxLength: 200,
        },
      ],
    },
    {
      key: 'wohlbefinden',
      title: lt('Wohlbefinden und Erholung', 'Well-being and recreation'),
      items: [
        {
          type: 'scale',
          key: 'wohlfuehlen',
          label: lt('Wohlbefinden', 'Well-being'),
          prompt: lt('Wie wohl fühlen Sie sich gerade an diesem Ort?', 'How comfortable do you feel at this place right now?'),
          min: 1,
          max: 5,
          minLabel: lt('sehr unwohl', 'very uncomfortable'),
          maxLabel: lt('sehr wohl', 'very comfortable'),
        },
        {
          type: 'scale',
          key: 'erholungspause',
          label: lt('Erholungspause', 'Short break'),
          prompt: lt(
            'Wie gut eignet sich dieser Ort für eine kurze Erholungspause?',
            'How well suited is this place for a short restorative break?'
          ),
          min: 1,
          max: 5,
          minLabel: lt('überhaupt nicht gut', 'not at all well'),
          maxLabel: lt('sehr gut', 'very well'),
        },
      ],
    },
  ],
};
