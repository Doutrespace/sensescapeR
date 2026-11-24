import type { StudyGroup } from '../types';
import { OTHER_SONSTIGES, OTHER_WEITERES, lt, ordered } from './helpers';

/**
 * Source: the group's questionnaire in the course folder (Projektseminar MA,
 * WS 2026/27: Wahrnehmung und Erholsamkeit urbaner Grünräume).
 *
 * Not asked again here because the app already records them:
 * - gender and age (Teil 1; the age bands of the paper form can be built
 *   from the year of birth),
 * - date, time and location (stored with every measurement),
 * - the participant number (the participant ID of the app).
 */
export const GRUENRAEUME: StudyGroup = {
  id: 'gruenraeume',
  topic: lt(
    'Wahrnehmung und Erholsamkeit urbaner Grünräume',
    'Perception and restorativeness of urban green spaces'
  ),
  icon: 'tree-outline',
  sections: [
    {
      key: 'person',
      scope: 'person',
      title: lt('Fragen zur Person', 'Questions about you'),
      intro: lt(
        'Geschlecht und Alter haben Sie bereits zu Beginn angegeben. Diese Angaben werden nur einmal abgefragt.',
        'You already gave your gender and age at the start. These details are asked only once.'
      ),
      items: [
        {
          type: 'choice',
          key: 'bildungsgrad',
          label: lt('Bildungsgrad', 'Education'),
          prompt: lt('Welchen Bildungsgrad haben Sie?', 'What is your level of education?'),
          options: [
            { key: 'kein_abschluss', label: lt('kein Bildungsabschluss', 'no qualification') },
            { key: 'abitur', label: lt('Abitur oder gleichwertiger Abschluss', 'A-levels or equivalent') },
            { key: 'studium_ohne_abschluss', label: lt('Studium ohne Abschluss', 'university studies without degree') },
            { key: 'bachelor_geselle', label: lt('Bachelor-Abschluss / Gesellenprüfung', "Bachelor's degree / journeyman's certificate") },
            { key: 'master_meister', label: lt('Master-Abschluss / Meister', "Master's degree / master craftsman") },
            { key: 'doktor', label: lt('Doktor-Grad', 'doctorate') },
          ],
          other: lt('sonstiges', 'other'),
        },
        {
          type: 'text',
          key: 'plz',
          label: lt('Wohnort', 'Place of residence'),
          prompt: lt('Wie lautet die Postleitzahl Ihres Wohnorts?', 'What is the postcode of where you live?'),
          placeholder: lt('PLZ', 'Postcode'),
          numeric: true,
          maxLength: 5,
        },
        {
          type: 'choice',
          key: 'familienstand',
          label: lt('Familienstand', 'Marital status'),
          prompt: lt('Wie ist Ihr Familienstand?', 'What is your marital status?'),
          options: [
            { key: 'ledig', label: lt('Ledig', 'Single') },
            { key: 'verheiratet', label: lt('Verheiratet', 'Married') },
            { key: 'liiert', label: lt('Liiert', 'In a relationship') },
            { key: 'geschieden', label: lt('Geschieden', 'Divorced') },
            { key: 'lebenspartnerschaft', label: lt('Eingetragene Lebenspartnerschaft', 'Registered civil partnership') },
            { key: 'verwitwet', label: lt('Verwitwet', 'Widowed') },
          ],
        },
        {
          type: 'choice',
          key: 'kinder_im_haushalt',
          label: lt('Kinder im Haushalt', 'Children in the household'),
          prompt: lt('Leben Kinder in Ihrem Haushalt?', 'Do children live in your household?'),
          options: [
            { key: 'ja', label: lt('Kinder im Haushalt', 'Children in the household') },
            { key: 'nein', label: lt('Keine Kinder im Haushalt', 'No children in the household') },
          ],
        },
      ],
    },
    {
      key: 'allgemein',
      title: lt('Allgemeine Fragen', 'General questions'),
      intro: lt(
        'Uns interessiert, wie Sie die Umgebung an diesem Standort wahrnehmen und wie Sie sich hier fühlen. Es gibt keine richtigen oder falschen Antworten.',
        'We are interested in how you perceive the surroundings at this location and how you feel here. There are no right or wrong answers.'
      ),
      items: [
        {
          type: 'choice',
          key: 'aufenthalt_haeufigkeit',
          label: lt('Häufigkeit', 'Frequency'),
          prompt: lt(
            'Wie häufig halten Sie sich an diesem Ort auf?',
            'How often do you spend time at this place?'
          ),
          options: ordered([
            lt('Zum ersten Mal', 'For the first time'),
            lt('Selten', 'Rarely'),
            lt('Mehrmals im Monat', 'Several times a month'),
            lt('Mehrmals pro Woche', 'Several times a week'),
            lt('(Fast) täglich', '(Almost) daily'),
          ]),
        },
        {
          type: 'choice',
          key: 'aufenthalt_grund',
          label: lt('Hauptgrund', 'Main reason'),
          prompt: lt(
            'Was ist der Hauptgrund für Ihren Aufenthalt an diesem Ort?',
            'What is the main reason for your being at this place?'
          ),
          options: [
            { key: 'weg_zum_ziel', label: lt('Auf dem Weg zu einem Ziel', 'On the way to a destination') },
            { key: 'treffen', label: lt('Treffen mit anderen', 'Meeting others') },
            { key: 'arbeit_studium', label: lt('Arbeit oder Studium', 'Work or study') },
            { key: 'freizeit_erholung', label: lt('Freizeit und Erholung', 'Leisure and recreation') },
            { key: 'wohnen_einkaufen', label: lt('Wohnen oder Einkaufen in der Nähe', 'Living or shopping nearby') },
          ],
          other: OTHER_SONSTIGES,
        },
        {
          type: 'scale',
          key: 'ort_angenehm',
          label: lt('Ort insgesamt', 'Place overall'),
          prompt: lt(
            'Wie angenehm empfinden Sie diesen Ort insgesamt?',
            'How pleasant do you find this place overall?'
          ),
          min: 1,
          max: 5,
          minLabel: lt('sehr unangenehm', 'very unpleasant'),
          maxLabel: lt('sehr angenehm', 'very pleasant'),
        },
        {
          type: 'scale',
          key: 'geraeuschkulisse',
          label: lt('Geräuschkulisse', 'Soundscape'),
          prompt: lt(
            'Wie nehmen Sie die Geräuschkulisse an diesem Ort wahr?',
            'How do you perceive the soundscape at this place?'
          ),
          min: 1,
          max: 5,
          minLabel: lt('sehr unangenehm', 'very unpleasant'),
          maxLabel: lt('sehr angenehm', 'very pleasant'),
        },
        {
          type: 'multi',
          key: 'geraeusche',
          label: lt('Geräusche', 'Sounds'),
          prompt: lt('Welche Geräusche hören Sie?', 'Which sounds do you hear?'),
          hint: lt('Mehrfachauswahl möglich.', 'Multiple answers possible.'),
          options: [
            { key: 'natur', label: lt('Natur', 'Nature') },
            { key: 'mechanisch', label: lt('Mechanisch', 'Mechanical') },
            { key: 'menschen', label: lt('Menschen', 'People') },
            { key: 'musik', label: lt('Musik', 'Music') },
            { key: 'verkehr', label: lt('Verkehr', 'Traffic') },
            { key: 'innenbereich', label: lt('Innenbereich', 'Indoor') },
          ],
        },
        {
          type: 'scale',
          key: 'wohlbefinden',
          label: lt('Wohlbefinden', 'Well-being'),
          prompt: lt(
            'Wie wohl oder unwohl fühlen Sie sich momentan an diesem Ort?',
            'How comfortable or uncomfortable do you feel at this place at the moment?'
          ),
          min: 1,
          max: 5,
          minLabel: lt('gar nicht wohl', 'not at all comfortable'),
          maxLabel: lt('sehr wohl', 'very comfortable'),
        },
        {
          type: 'multi',
          key: 'atmosphaere',
          label: lt('Atmosphäre', 'Atmosphere'),
          prompt: lt(
            'Wie würden Sie die Atmosphäre dieses Ortes insgesamt beschreiben?',
            'How would you describe the atmosphere of this place overall?'
          ),
          hint: lt('Mehrfachauswahl möglich.', 'Multiple answers possible.'),
          options: [
            { key: 'ruhig', label: lt('Ruhig', 'Calm') },
            { key: 'monoton', label: lt('Monoton', 'Monotonous') },
            { key: 'angenehm', label: lt('Angenehm', 'Pleasant') },
            { key: 'unangenehm', label: lt('Unangenehm', 'Unpleasant') },
            { key: 'hektisch', label: lt('Hektisch', 'Hectic') },
            { key: 'lebendig', label: lt('Lebendig', 'Lively') },
          ],
          other: OTHER_WEITERES,
        },
        {
          type: 'scale',
          key: 'geruch_staerke',
          label: lt('Geruch', 'Smell'),
          prompt: lt(
            'Wie stark nehmen Sie Ihre Umgebung geruchlich wahr?',
            'How strongly do you perceive your surroundings by smell?'
          ),
          min: 1,
          max: 5,
          minLabel: lt('gar nicht', 'not at all'),
          maxLabel: lt('sehr stark', 'very strongly'),
        },
        {
          type: 'multi',
          key: 'geruch_quellen',
          label: lt('Gerüche', 'Smells'),
          prompt: lt('Was riechen Sie?', 'What do you smell?'),
          hint: lt('Mehrfachauswahl möglich.', 'Multiple answers possible.'),
          options: [
            { key: 'natur', label: lt('Natur', 'Nature') },
            { key: 'verkehr', label: lt('Verkehr', 'Traffic') },
            { key: 'essen', label: lt('Essen', 'Food') },
            { key: 'menschengemacht', label: lt('Menschengemachte Gerüche', 'Man-made smells') },
            { key: 'muell', label: lt('Müll', 'Rubbish') },
          ],
          other: OTHER_WEITERES,
        },
        {
          type: 'scale',
          key: 'geruch_angenehm',
          label: lt('Bewertung des Geruchs', 'Rating of the smell'),
          prompt: lt('Wie empfinden Sie diesen Geruch?', 'How do you find this smell?'),
          min: 1,
          max: 5,
          minLabel: lt('äußerst unangenehm', 'extremely unpleasant'),
          maxLabel: lt('sehr angenehm', 'very pleasant'),
        },
      ],
    },
    {
      key: 'gruenstruktur',
      title: lt('Fragen zur Grünstruktur', 'Questions on the green structure'),
      items: [
        {
          type: 'scale',
          key: 'gruenanteil',
          label: lt('Grünanteil', 'Share of green'),
          prompt: lt(
            'Wie nehmen Sie den Grünanteil an diesem Ort wahr?',
            'How do you perceive the share of greenery at this place?'
          ),
          min: 1,
          max: 5,
          minLabel: lt('sehr gering', 'very low'),
          maxLabel: lt('sehr hoch', 'very high'),
        },
        {
          type: 'scale',
          key: 'gruen_gestaltung',
          label: lt('Gestaltung des Grünraums', 'Design of the green space'),
          prompt: lt(
            'Wie ansprechend empfinden Sie die sichtbare Gestaltung dieses Grünraums?',
            'How appealing do you find the visible design of this green space?'
          ),
          min: 1,
          max: 5,
          minLabel: lt('überhaupt nicht ansprechend', 'not at all appealing'),
          maxLabel: lt('sehr ansprechend', 'very appealing'),
        },
        {
          type: 'scale',
          key: 'gruen_geraeusche',
          label: lt('Geräusche', 'Sounds'),
          prompt: lt(
            'Wie angenehm empfinden Sie die Geräusche, die Sie an diesem Ort wahrnehmen?',
            'How pleasant do you find the sounds you perceive at this place?'
          ),
          min: 1,
          max: 5,
          minLabel: lt('sehr unangenehm', 'very unpleasant'),
          maxLabel: lt('sehr angenehm', 'very pleasant'),
        },
        {
          type: 'scale',
          key: 'entspannung',
          label: lt('Entspannung', 'Relaxation'),
          prompt: lt(
            'Inwiefern trägt die Umgebung dazu bei, dass Sie sich entspannen und vom Alltag abschalten können?',
            'To what extent do the surroundings help you to relax and switch off from everyday life?'
          ),
          min: 1,
          max: 5,
          minLabel: lt('gar nicht', 'not at all'),
          maxLabel: lt('sehr stark', 'very strongly'),
        },
        {
          type: 'multi',
          key: 'erholung_eigenschaften',
          label: lt('Erholsame Eigenschaften', 'Restorative qualities'),
          prompt: lt(
            'Welche Eigenschaften tragen Ihrer Meinung nach besonders dazu bei, dass Sie sich an diesem Ort erholen können?',
            'Which qualities, in your opinion, particularly help you to recover at this place?'
          ),
          hint: lt('Mehrfachauswahl möglich.', 'Multiple answers possible.'),
          options: [
            { key: 'gruen_pflanzen', label: lt('Grün und Pflanzen', 'Greenery and plants') },
            { key: 'vogelgesang', label: lt('Vogelgesang und Naturgeräusche', 'Birdsong and nature sounds') },
            { key: 'baeume_schatten', label: lt('Bäume und Schatten', 'Trees and shade') },
            { key: 'sitzmoeglichkeiten', label: lt('Sitz- und Aufenthaltsmöglichkeiten', 'Places to sit and stay') },
            { key: 'ruhe', label: lt('Ruhe bzw. geringe Geräuschbelastung', 'Quiet / low noise exposure') },
            { key: 'weite', label: lt('Weitläufigkeit und Offenheit', 'Spaciousness and openness') },
            { key: 'wasser', label: lt('Wasser', 'Water') },
          ],
          other: OTHER_WEITERES,
        },
      ],
    },
    {
      key: 'nachgang',
      title: lt('Im Nachgang auszufüllen', 'To be completed afterwards'),
      intro: lt(
        'Angaben der Versuchsleitung. Datum, Uhrzeit, Standort und Teilnehmernummer speichert die App automatisch.',
        'Details from the experimenter. The app stores date, time, location and participant number automatically.'
      ),
      items: [
        {
          type: 'text',
          key: 'wetter',
          label: lt('Wetter', 'Weather'),
          prompt: lt('Wie ist das Wetter?', 'What is the weather like?'),
          maxLength: 120,
        },
        {
          type: 'choice',
          key: 'passantendichte',
          label: lt('Passantendichte', 'Pedestrian density'),
          prompt: lt('Wie hoch ist die Passantendichte?', 'How high is the pedestrian density?'),
          options: ordered([
            lt('1–3', '1–3'),
            lt('3–10', '3–10'),
            lt('10–30', '10–30'),
          ]),
        },
        {
          type: 'text',
          key: 'versuchsleiter_kuerzel',
          label: lt('Versuchsleitung', 'Experimenter'),
          prompt: lt('Kürzel der Versuchsleitung', 'Experimenter initials'),
          maxLength: 10,
        },
      ],
    },
  ],
};
