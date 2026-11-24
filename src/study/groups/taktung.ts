import type { StudyGroup } from '../types';
import { lt, ordered } from './helpers';

/**
 * Source: the group's questionnaire in the course folder (as of 23.11.2026),
 * items Z1-Z3. Wording, answer categories, numeric codes and the "not
 * applicable" button are taken from the document.
 */
export const TAKTUNG: StudyGroup = {
  id: 'taktung',
  topic: lt('Kommerzielle und saisonale Taktung', 'Commercial and seasonal rhythm'),
  icon: 'storefront-outline',
  sections: [
    {
      key: 'zusatzfragen',
      title: lt('Zusatzfragen', 'Additional questions'),
      intro: lt(
        'Drei kurze Fragen zum Zustand dieses Ortes im Moment Ihres Besuchs.',
        'Three short questions about the state of this place at the moment of your visit.'
      ),
      items: [
        {
          type: 'choice',
          key: 'personen_blickfeld',
          label: lt('Personen im Blickfeld', 'People in view'),
          prompt: lt(
            'Wie viele Personen sehen Sie in diesem Moment in Ihrem Blickfeld?',
            'How many people can you see in your field of view right now?'
          ),
          hint: lt(
            'Kurz rundum schauen und schätzen; nur Personen im Straßenraum.',
            'Look around briefly and estimate; only people in the street space.'
          ),
          options: ordered([
            lt('0', '0'),
            lt('1–5', '1–5'),
            lt('6–15', '6–15'),
            lt('16–40', '16–40'),
            lt('> 40', '> 40'),
          ]),
        },
        {
          type: 'choice',
          key: 'geschaefte_offen',
          label: lt('Geöffnete Geschäfte', 'Open shops'),
          prompt: lt(
            'Wie viele der Geschäfte und Lokale in Ihrem Blickfeld sind gerade geöffnet?',
            'How many of the shops and cafés in your field of view are open right now?'
          ),
          hint: lt(
            'Geöffnet = Tür offen bzw. erkennbar in Betrieb, nicht nur beleuchtetes Schaufenster.',
            'Open = door open or clearly in business, not just a lit shop window.'
          ),
          options: ordered([
            lt('Keine', 'None'),
            lt('Wenige', 'A few'),
            lt('Etwa die Hälfte', 'About half'),
            lt('Die meisten', 'Most'),
            lt('Alle', 'All'),
          ]),
          notApplicable: lt('Keine Geschäfte oder Lokale sichtbar', 'No shops or cafés visible'),
        },
        {
          type: 'choice',
          key: 'weihnacht_gestaltung',
          label: lt('Weihnachtliche Gestaltung', 'Christmas decoration'),
          prompt: lt(
            'Wie stark ist dieser Ort gerade weihnachtlich gestaltet (Beleuchtung, Dekoration, Musik, Stände)?',
            'How strongly is this place decorated for Christmas right now (lights, decoration, music, stalls)?'
          ),
          options: ordered([
            lt('Gar nicht', 'Not at all'),
            lt('Leicht', 'Slightly'),
            lt('Mäßig', 'Moderately'),
            lt('Stark', 'Strongly'),
            lt('Sehr stark', 'Very strongly'),
          ]),
        },
      ],
    },
  ],
};
