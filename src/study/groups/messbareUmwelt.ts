import type { StudyGroup } from '../types';
import { OTHER_SONSTIGES, lt } from './helpers';

/**
 * Source: the group's questionnaire in the course folder (Projektarbeit
 * Sensuous Geography, WS 2026/27). Blocks A-D with the scales given in the
 * document.
 *
 * B1 is given as "open answer or answer options
 * (Verkehr/Natur/Menschen/Wetter/...)"; the option form with a free-text
 * "other" is used.
 */
export const MESSBARE_UMWELT: StudyGroup = {
  id: 'messbare_umwelt',
  topic: lt(
    'Sinnliche Wahrnehmung und objektiv messbare Umwelt',
    'Sensory perception and the objectively measurable environment'
  ),
  icon: 'scale-balance',
  sections: [
    {
      key: 'visuell',
      title: lt('A: Visuelle Wahrnehmung', 'A: Visual perception'),
      items: [
        {
          type: 'scale',
          key: 'vis_attraktivitaet',
          label: lt('Visuelle Attraktivität', 'Visual attractiveness'),
          prompt: lt('Wie visuell attraktiv empfinden Sie diesen Ort?', 'How visually attractive do you find this place?'),
          min: 1,
          max: 7,
          minLabel: lt('sehr unattraktiv', 'very unattractive'),
          maxLabel: lt('sehr attraktiv', 'very attractive'),
        },
        {
          type: 'scale',
          key: 'vis_gruen',
          label: lt('Grünanteile', 'Greenery'),
          prompt: lt(
            'Wie stark fallen Ihnen Grünanteile an diesem Standort auf?',
            'How much do you notice greenery at this location?'
          ),
          min: 1,
          max: 5,
          minLabel: lt('gar nicht', 'not at all'),
          maxLabel: lt('sehr', 'very much'),
        },
        {
          type: 'text',
          key: 'vis_elemente',
          label: lt('Visuelle Elemente', 'Visual elements'),
          prompt: lt(
            'Welche visuellen Elemente ziehen Ihre Aufmerksamkeit besonders auf sich?',
            'Which visual elements particularly attract your attention?'
          ),
          multiline: true,
          maxLength: 500,
        },
      ],
    },
    {
      key: 'akustisch',
      title: lt('B: Akustische Wahrnehmung', 'B: Acoustic perception'),
      items: [
        {
          type: 'choice',
          key: 'ak_quelle',
          label: lt('Auffälligste Schallquelle', 'Most noticeable sound source'),
          prompt: lt('Welche Schallquelle fällt Ihnen am meisten auf?', 'Which sound source do you notice most?'),
          options: [
            { key: 'verkehr', label: lt('Verkehr', 'Traffic') },
            { key: 'natur', label: lt('Natur', 'Nature') },
            { key: 'menschen', label: lt('Menschen', 'People') },
            { key: 'wetter', label: lt('Wetter', 'Weather') },
          ],
          other: OTHER_SONSTIGES,
        },
        {
          type: 'scale',
          key: 'ak_staerke',
          label: lt('Stärke der Geräusche', 'Strength of sounds'),
          prompt: lt(
            'Als wie stark nehmen Sie die Geräusche an diesem Ort wahr?',
            'How strong do you perceive the sounds at this place to be?'
          ),
          min: 1,
          max: 7,
          minLabel: lt('gar nicht', 'not at all'),
          maxLabel: lt('extrem stark', 'extremely strong'),
        },
        {
          type: 'scale',
          key: 'ak_angenehm',
          label: lt('Akustische Umgebung', 'Acoustic environment'),
          prompt: lt(
            'Als wie angenehm empfinden Sie die akustische Umgebung?',
            'How pleasant do you find the acoustic environment?'
          ),
          min: 1,
          max: 5,
          minLabel: lt('sehr unangenehm', 'very unpleasant'),
          maxLabel: lt('sehr angenehm', 'very pleasant'),
        },
        {
          type: 'scale',
          key: 'ak_verkehr',
          label: lt('Verkehrsgeräusche', 'Traffic noise'),
          prompt: lt(
            'Wie dominant empfinden Sie Verkehrsgeräusche an diesem Ort?',
            'How dominant do you find traffic noise at this place?'
          ),
          min: 1,
          max: 5,
          minLabel: lt('gar nicht', 'not at all'),
          maxLabel: lt('sehr stark', 'very strongly'),
        },
      ],
    },
    {
      key: 'olfaktorisch',
      title: lt('C: Olfaktorische Wahrnehmung', 'C: Olfactory perception'),
      items: [
        {
          type: 'scale',
          key: 'olf_intensitaet',
          label: lt('Intensität der Gerüche', 'Intensity of smells'),
          prompt: lt(
            'Wie intensiv nehmen Sie die Gerüche an diesem Ort wahr?',
            'How intensely do you perceive the smells at this place?'
          ),
          min: 1,
          max: 5,
          minLabel: lt('gar nicht', 'not at all'),
          maxLabel: lt('sehr stark', 'very strongly'),
        },
        {
          type: 'scale',
          key: 'olf_angenehm',
          label: lt('Angenehmheit der Gerüche', 'Pleasantness of smells'),
          prompt: lt(
            'Wie angenehm empfinden Sie die Gerüche an diesem Ort?',
            'How pleasant do you find the smells at this place?'
          ),
          min: 1,
          max: 5,
          minLabel: lt('sehr unangenehm', 'very unpleasant'),
          maxLabel: lt('sehr angenehm', 'very pleasant'),
        },
        {
          type: 'text',
          key: 'olf_quelle',
          label: lt('Auffälligste Geruchsquelle', 'Most noticeable smell source'),
          prompt: lt('Welche Geruchsquelle fällt Ihnen am meisten auf?', 'Which smell source do you notice most?'),
          maxLength: 200,
        },
      ],
    },
    {
      key: 'gesamt',
      title: lt('D: Gesamtwahrnehmung', 'D: Overall perception'),
      items: [
        {
          type: 'choice',
          key: 'ges_dominanter_sinn',
          label: lt('Dominierende Sinnesdimension', 'Dominant sense'),
          prompt: lt(
            'Welche Sinnesdimension dominiert die Wahrnehmung an diesem Ort?',
            'Which sensory dimension dominates perception at this place?'
          ),
          options: [
            { key: 'visuell', label: lt('Visuell', 'Visual') },
            { key: 'akustisch', label: lt('Akustisch', 'Acoustic') },
            { key: 'olfaktorisch', label: lt('Olfaktorisch', 'Olfactory') },
          ],
        },
        {
          type: 'scale',
          key: 'ges_verweilen',
          label: lt('Verweilen', 'Lingering'),
          prompt: lt('Wie sehr lädt dieser Ort zum Verweilen ein?', 'How much does this place invite you to linger?'),
          min: 1,
          max: 5,
          minLabel: lt('gar nicht', 'not at all'),
          maxLabel: lt('sehr stark', 'very strongly'),
        },
        {
          type: 'scale',
          key: 'ges_eindruck',
          label: lt('Gesamteindruck', 'Overall impression'),
          prompt: lt(
            'Ist Ihr Gesamteindruck von diesem Ort positiver oder negativer, als er es nach Ihrem ersten Eindruck war?',
            'Is your overall impression of this place more positive or more negative than your first impression was?'
          ),
          min: 1,
          max: 5,
          minLabel: lt('viel negativer', 'much more negative'),
          maxLabel: lt('viel positiver', 'much more positive'),
        },
        {
          type: 'multi',
          key: 'ges_charakter',
          label: lt('Charakter des Ortes', 'Character of the place'),
          prompt: lt(
            'Wie würden Sie den Ort insgesamt charakterisieren?',
            'How would you characterise the place overall?'
          ),
          hint: lt('Mehrfachauswahl möglich.', 'Multiple answers possible.'),
          options: [
            { key: 'lebendig', label: lt('lebendig', 'lively') },
            { key: 'ruhig', label: lt('ruhig', 'calm') },
            { key: 'hektisch', label: lt('hektisch', 'hectic') },
            { key: 'einladend', label: lt('einladend', 'inviting') },
            { key: 'anonym', label: lt('anonym', 'anonymous') },
            { key: 'natuerlich', label: lt('natürlich', 'natural') },
            { key: 'kuenstlich', label: lt('künstlich', 'artificial') },
          ],
        },
      ],
    },
  ],
};
