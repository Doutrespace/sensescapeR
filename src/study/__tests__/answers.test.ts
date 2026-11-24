jest.mock('../../services/database/index', () => ({ getDatabase: jest.fn() }));

import { calculateCircumplexFromPAQ } from '../../services/database/perceptions';
import { PERSON_ITEMS } from '../core';
import { MAINUFER } from '../groups/mainufer';
import {
  allItems,
  applyAnswerPatch,
  countAnswered,
  isItemAnswered,
  isoCoordinatesFromRatings,
  itemExportValues,
  missingRequiredItems,
  openClosedItems,
  pickAnswers,
  sanitizeAnswers,
  visibleItems,
  type Answers,
  type StudyItem,
} from '../types';

const items = allItems(MAINUFER.sections);
const byKey = (key: string): StudyItem => {
  const item = items.find((candidate) => candidate.key === key);
  if (!item) throw new Error(`no item ${key}`);
  return item;
};

describe('answering questions', () => {
  it('requires a valid year of birth, a gender and years or "not in Würzburg"', () => {
    expect(missingRequiredItems(PERSON_ITEMS, {}).map((item) => item.key))
      .toEqual(['birth_year', 'gender', 'years_in_wuerzburg']);

    expect(missingRequiredItems(PERSON_ITEMS, {
      birth_year: 1850,
      gender: 'diverse',
      years_in_wuerzburg__na: true,
    }).map((item) => item.key)).toEqual(['birth_year']);

    expect(missingRequiredItems(PERSON_ITEMS, {
      birth_year: 1999,
      gender: 'female',
      years_in_wuerzburg: 4,
    })).toEqual([]);
  });

  it('accepts "keine Angabe" for every personal question and drops other answers with it', () => {
    const declined = {
      birth_year__no_answer: true,
      gender__no_answer: true,
      years_in_wuerzburg__no_answer: true,
    };
    expect(missingRequiredItems(PERSON_ITEMS, declined)).toEqual([]);

    expect(sanitizeAnswers(PERSON_ITEMS, {
      ...declined,
      birth_year: 1999,
      gender: 'female',
      years_in_wuerzburg__na: true,
    })).toEqual(declined);
  });

  it('accepts "not applicable" in place of a rating', () => {
    const smell = byKey('geruch_angenehm');
    expect(isItemAnswered(smell, {})).toBe(false);
    expect(isItemAnswered(smell, { geruch_angenehm: 2 })).toBe(true);
    expect(isItemAnswered(smell, { geruch_angenehm__na: true })).toBe(true);
  });

  it('counts "other" only once its text is filled in', () => {
    const sources = byKey('geruch_quellen');
    expect(isItemAnswered(sources, { geruch_quellen: ['other'] })).toBe(true);

    const education: StudyItem = {
      type: 'choice',
      key: 'q',
      prompt: { de: 'Frage', en: 'Question' },
      options: [{ key: 'a', label: { de: 'A', en: 'A' } }, { key: 'b', label: { de: 'B', en: 'B' } }],
      other: { de: 'Sonstiges', en: 'Other' },
    };
    expect(isItemAnswered(education, { q: 'other' })).toBe(false);
    expect(isItemAnswered(education, { q: 'other', q__other: 'etwas' })).toBe(true);
  });

  it('shows follow-up questions only for the matching answer', () => {
    const visible = (answers: Answers) => visibleItems(items, answers).map((item) => item.key);
    expect(visible({})).not.toContain('geruch_wunsch_was');
    expect(visible({ geruch_wunsch: 'nein' })).not.toContain('geruch_wunsch_was');
    expect(visible({ geruch_wunsch: 'ja' })).toContain('geruch_wunsch_was');
  });

  it('needs all eight rows of an attribute block', () => {
    const matrix = byKey('geraeusch_paq');
    const seven: Answers = {};
    ['angenehm', 'chaotisch', 'lebendig', 'ereignisarm', 'ruhig', 'stoerend', 'ereignisreich']
      .forEach((row) => { seven[`geraeusch_paq__${row}`] = 3; });
    expect(isItemAnswered(matrix, seven)).toBe(false);
    expect(isItemAnswered(matrix, { ...seven, geraeusch_paq__monoton: 1 })).toBe(true);
  });

  it('leaves free text out of the count of open questions', () => {
    const open = openClosedItems(items, {}).map((item) => item.key);
    expect(open).toContain('geruch_angenehm');
    expect(open).not.toContain('geruch_beschreibung');
    expect(countAnswered(items, { wohlfuehlen: 4 }).answered).toBe(1);
  });

  it('removes and adds answers through patches', () => {
    expect(applyAnswerPatch({ a: 1, b: 2 }, { a: undefined, c: 'x' })).toEqual({ b: 2, c: 'x' });
  });
});

describe('storing answers', () => {
  it('drops answers of hidden questions, empty text and stray keys', () => {
    const stored = sanitizeAnswers(items, {
      geruch_wunsch: 'nein',
      geruch_wunsch_was: 'Blumen',
      geruch_beschreibung: '   ',
      wohlfuehlen: 5,
      unknown_key: 'x',
    });
    expect(stored).toEqual({ geruch_wunsch: 'nein', wohlfuehlen: 5 });
  });

  it('keeps the text of "other" only while "other" is chosen', () => {
    expect(sanitizeAnswers(items, {
      geruch_quellen: ['natur'],
      geruch_quellen__other: 'Parfum',
    })).toEqual({ geruch_quellen: ['natur'] });

    expect(sanitizeAnswers(items, {
      geruch_quellen: ['natur', 'other'],
      geruch_quellen__other: ' Parfum ',
    })).toEqual({ geruch_quellen: ['natur', 'other'], geruch_quellen__other: 'Parfum' });
  });

  it('rejects numbers outside the allowed range', () => {
    expect(sanitizeAnswers(PERSON_ITEMS, { birth_year: 1492, years_in_wuerzburg: 3 }))
      .toEqual({ years_in_wuerzburg: 3 });
  });

  it('picks the answers that belong to a set of questions', () => {
    expect(pickAnswers([byKey('wohlfuehlen')], { wohlfuehlen: 2, erholungspause: 3 }))
      .toEqual({ wohlfuehlen: 2 });
  });
});

describe('export values', () => {
  it('joins multiple answers with "|" and writes flags as 1', () => {
    expect(itemExportValues(byKey('geruch_quellen'), { geruch_quellen: ['natur', 'verkehr'] }))
      .toEqual({ geruch_quellen: 'natur|verkehr', geruch_quellen__other: null });
    expect(itemExportValues(byKey('geruch_angenehm'), { geruch_angenehm__na: true }))
      .toEqual({ geruch_angenehm: null, geruch_angenehm__na: 1 });
  });

  it('adds ISO/TS 12913-3 coordinates to a complete attribute block', () => {
    const ratings = {
      pleasant: 4, vibrant: 3, eventful: 2, chaotic: 1, annoying: 2, monotonous: 3, uneventful: 4, calm: 5,
    };
    const answers: Answers = {
      geraeusch_paq__angenehm: ratings.pleasant,
      geraeusch_paq__lebendig: ratings.vibrant,
      geraeusch_paq__ereignisreich: ratings.eventful,
      geraeusch_paq__chaotisch: ratings.chaotic,
      geraeusch_paq__stoerend: ratings.annoying,
      geraeusch_paq__monoton: ratings.monotonous,
      geraeusch_paq__ereignisarm: ratings.uneventful,
      geraeusch_paq__ruhig: ratings.calm,
    };
    const cells = itemExportValues(byKey('geraeusch_paq'), answers);
    const reference = calculateCircumplexFromPAQ(ratings);

    expect(cells.geraeusch_paq__iso_pleasant as number).toBeCloseTo(reference.pleasant, 3);
    expect(cells.geraeusch_paq__iso_eventful as number).toBeCloseTo(reference.eventful, 3);
  });

  it('spans -1 to 1 and stays empty for incomplete blocks', () => {
    expect(isoCoordinatesFromRatings({
      pleasant: 5, vibrant: 5, eventful: 3, chaotic: 1, annoying: 1, monotonous: 1, uneventful: 3, calm: 5,
    })).toEqual({ pleasant: 1, eventful: 0 });
    expect(isoCoordinatesFromRatings({ pleasant: 5 })).toBeNull();
  });
});
