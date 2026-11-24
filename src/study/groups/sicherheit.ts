import type { StudyGroup } from '../types';
import { AGREE_5, lt, ordered } from './helpers';

/**
 * Source: the group's draft questionnaire in the course folder (WS 2026/27).
 *
 * Not asked again here because Teil 1 of the main questionnaire already
 * records it: gender.
 *
 * The document names no topic; the topic is derived from its questions. The
 * eight sound attributes are the ISO/TS 12913-2 set (pulsierend = vibrant,
 * ereignislos = uneventful, nervig = annoying), so the export also adds the
 * calculated coordinates.
 */
export const SICHERHEIT: StudyGroup = {
  id: 'sicherheit',
  topic: lt('Wohlbefinden, Sicherheit und Geräuschkulisse', 'Well-being, safety and soundscape'),
  icon: 'shield-check-outline',
  color: '#B04A5C',
  softColor: '#F2D6DB',
  sections: [
    {
      key: 'allgemeines',
      title: lt('Allgemeines', 'General'),
      items: [
        {
          type: 'choice',
          key: 'nutzung_haeufigkeit',
          label: lt('Nutzung des Ortes', 'Use of the place'),
          prompt: lt(
            'Wie häufig nutzen bzw. passieren Sie diesen Ort?',
            'How often do you use or pass this place?'
          ),
          options: ordered([
            lt('erstmals hier', 'here for the first time'),
            lt('weniger als einmal im Monat', 'less than once a month'),
            lt('einmal im Monat', 'once a month'),
            lt('einmal in der Woche', 'once a week'),
            lt('mehrmals in der Woche / täglich', 'several times a week / daily'),
          ]),
        },
      ],
    },
    {
      key: 'wohlbefinden',
      title: lt('Wohlbefinden am Ort', 'Well-being at the place'),
      items: [
        {
          type: 'choice',
          key: 'wohlbefinden',
          label: lt('Wohlbefinden', 'Well-being'),
          prompt: lt('Wie fühlen Sie sich im Moment an diesem Ort?', 'How do you feel at this place at the moment?'),
          options: ordered([
            lt('sehr unwohl', 'very uncomfortable'),
            lt('unwohl', 'uncomfortable'),
            lt('weder wohl noch unwohl', 'neither comfortable nor uncomfortable'),
            lt('wohl', 'comfortable'),
            lt('sehr wohl', 'very comfortable'),
          ]),
        },
        {
          type: 'choice',
          key: 'sicherheit',
          label: lt('Sicherheit', 'Safety'),
          prompt: lt(
            'Wie sicher fühlen Sie sich im Moment an diesem Ort?',
            'How safe do you feel at this place at the moment?'
          ),
          options: ordered([
            lt('sehr unsicher', 'very unsafe'),
            lt('unsicher', 'unsafe'),
            lt('weder sicher noch unsicher', 'neither safe nor unsafe'),
            lt('sicher', 'safe'),
            lt('sehr sicher', 'very safe'),
          ]),
        },
      ],
    },
    {
      key: 'geraeuschkulisse',
      title: lt('Geräuschkulisse / Empfinden', 'Soundscape / perception'),
      items: [
        {
          type: 'choice',
          key: 'lautstaerke',
          label: lt('Lautstärke', 'Loudness'),
          prompt: lt(
            'Wie empfinden Sie die aktuelle Lautstärke an diesem Ort?',
            'How do you perceive the current loudness at this place?'
          ),
          options: ordered([
            lt('sehr leise', 'very quiet'),
            lt('leise', 'quiet'),
            lt('weder leise noch laut', 'neither quiet nor loud'),
            lt('laut', 'loud'),
            lt('sehr laut', 'very loud'),
          ]),
        },
        {
          type: 'matrix',
          key: 'geraeusch_paq',
          label: lt('Geräuschkulisse', 'Soundscape'),
          prompt: lt(
            'Inwieweit stimmen Sie zu, dass die Geräuschkulisse an diesem Ort im Moment … ist?',
            'To what extent do you agree that the soundscape at this place is currently …?'
          ),
          rows: [
            { key: 'chaotisch', label: lt('chaotisch', 'chaotic') },
            { key: 'ereignisreich', label: lt('ereignisreich', 'eventful') },
            { key: 'pulsierend', label: lt('pulsierend', 'vibrant') },
            { key: 'angenehm', label: lt('angenehm', 'pleasant') },
            { key: 'ruhig', label: lt('ruhig', 'calm') },
            { key: 'ereignislos', label: lt('ereignislos', 'uneventful') },
            { key: 'monoton', label: lt('monoton', 'monotonous') },
            { key: 'nervig', label: lt('nervig', 'annoying') },
          ],
          min: 1,
          max: 5,
          pointLabels: AGREE_5,
          paq: {
            chaotic: 'chaotisch',
            eventful: 'ereignisreich',
            vibrant: 'pulsierend',
            pleasant: 'angenehm',
            calm: 'ruhig',
            uneventful: 'ereignislos',
            monotonous: 'monoton',
            annoying: 'nervig',
          },
        },
        {
          type: 'choice',
          key: 'geraeusch_angenehm',
          label: lt('Angenehmheit', 'Pleasantness'),
          prompt: lt(
            'Wie angenehm finden Sie die aktuelle Geräuschkulisse?',
            'How pleasant do you find the current soundscape?'
          ),
          options: ordered([
            lt('sehr unangenehm', 'very unpleasant'),
            lt('unangenehm', 'unpleasant'),
            lt('weder angenehm noch unangenehm', 'neither pleasant nor unpleasant'),
            lt('angenehm', 'pleasant'),
            lt('sehr angenehm', 'very pleasant'),
          ]),
        },
      ],
    },
    {
      key: 'umgebung',
      title: lt('Bewertung der räumlichen Umgebung', 'Assessment of the surroundings'),
      items: [
        {
          type: 'choice',
          key: 'uebersichtlichkeit',
          label: lt('Übersichtlichkeit', 'Clarity of layout'),
          prompt: lt(
            'Wie übersichtlich empfinden Sie diesen Ort und seine unmittelbare Umgebung?',
            'How easy to overlook do you find this place and its immediate surroundings?'
          ),
          options: ordered([
            lt('sehr unübersichtlich', 'very unclear'),
            lt('unübersichtlich', 'unclear'),
            lt('weder übersichtlich noch unübersichtlich', 'neither clear nor unclear'),
            lt('übersichtlich', 'clear'),
            lt('sehr übersichtlich', 'very clear'),
          ]),
        },
        {
          type: 'choice',
          key: 'beleuchtung',
          label: lt('Beleuchtung', 'Lighting'),
          prompt: lt(
            'Wie empfinden Sie die aktuellen Beleuchtungsverhältnisse an diesem Ort bzw. im sichtbaren Umfeld?',
            'How do you rate the current lighting conditions at this place and in the visible surroundings?'
          ),
          options: ordered([
            lt('sehr schlecht', 'very poor'),
            lt('schlecht', 'poor'),
            lt('weder gut noch schlecht', 'neither good nor poor'),
            lt('gut', 'good'),
            lt('sehr gut', 'very good'),
          ]),
        },
      ],
    },
  ],
};
