jest.mock('../../services/database/index', () => ({ getDatabase: jest.fn() }));

import { PERSON_ITEMS, RESPONDENT_ITEM, SITE_CODE_ITEM, VISIT_MODE_ITEM } from '../core';
import { STUDY_GROUPS, getStudyGroup, groupColumnPrefix, personSections, runSections } from '../groups';
import {
  OTHER_KEY,
  allItems,
  itemExportColumns,
  type LocalizedText,
  type StudyItem,
} from '../types';
import { STUDY_COLUMNS, buildCodebook } from '../../services/export/studyExport';

const glyphs: Record<string, number> = require('@expo/vector-icons/build/vendor/react-native-vector-icons/glyphmaps/MaterialCommunityIcons.json');

const PAQ = ['pleasant', 'vibrant', 'eventful', 'chaotic', 'annoying', 'monotonous', 'uneventful', 'calm'];

function expectText(text: LocalizedText | undefined, where: string) {
  expect({ where, de: (text?.de.trim().length ?? 0) > 0, en: (text?.en.trim().length ?? 0) > 0 })
    .toEqual({ where, de: true, en: true });
}

function checkItem(item: StudyItem, where: string) {
  expect(item.key).toMatch(/^[a-z][a-z0-9_]*$/);
  expectText(item.prompt, `${where} prompt`);
  if (item.label) expectText(item.label, `${where} label`);
  if (item.hint) expectText(item.hint, `${where} hint`);

  if (item.type === 'scale') {
    expect(item.max).toBeGreaterThan(item.min);
    expectText(item.minLabel, `${where} minLabel`);
    expectText(item.maxLabel, `${where} maxLabel`);
  }

  if (item.type === 'choice' || item.type === 'multi') {
    expect(item.options.length).toBeGreaterThanOrEqual(2);
    const keys = item.options.map((option) => option.key);
    expect(new Set(keys).size).toBe(keys.length);
    // 'other' is reserved for the free-text option.
    if (item.other) expect(keys).not.toContain(OTHER_KEY);
    for (const option of item.options) {
      expectText(option.label, `${where} option ${option.key}`);
    }
    // Ordered categories: either every option has a numeric code or none has.
    const coded = item.options.filter((option) => typeof option.value === 'number').length;
    expect([0, item.options.length]).toContain(coded);
  }

  if (item.type === 'matrix') {
    expect(item.pointLabels).toHaveLength(item.max - item.min + 1);
    const rowKeys = item.rows.map((row) => row.key);
    expect(new Set(rowKeys).size).toBe(rowKeys.length);
    if (item.paq) {
      expect(Object.keys(item.paq).sort()).toEqual([...PAQ].sort());
      expect(Object.values(item.paq).sort()).toEqual([...rowKeys].sort());
    }
  }
}

describe('main questionnaire definitions', () => {
  it('asks P1 to P3 once, all of them required', () => {
    expect(PERSON_ITEMS.map((item) => item.key)).toEqual(['birth_year', 'gender', 'years_in_wuerzburg']);
    expect(PERSON_ITEMS.every((item) => item.required)).toBe(true);
    PERSON_ITEMS.forEach((item) => checkItem(item, item.key));
  });

  it('offers "does not live in Würzburg" instead of a number of years', () => {
    const years = PERSON_ITEMS[2];
    expect(years.type).toBe('number');
    expect(years.type === 'number' && years.notApplicable?.de).toBe('wohne nicht in Würzburg');
  });

  it('asks whether the person is passing by or staying', () => {
    expect(VISIT_MODE_ITEM.required).toBe(true);
    expect(VISIT_MODE_ITEM.options.map((option) => option.key)).toEqual(['passing', 'staying']);
    [VISIT_MODE_ITEM, RESPONDENT_ITEM, SITE_CODE_ITEM].forEach((item) => checkItem(item, item.key));
  });
});

describe('project groups', () => {
  it('lists the seven groups of the course with unique ids', () => {
    expect(STUDY_GROUPS).toHaveLength(7);
    const ids = STUDY_GROUPS.map((group) => group.id);
    expect(new Set(ids).size).toBe(ids.length);
    ids.forEach((id) => expect(id).toMatch(/^[a-z][a-z_]*$/));
    expect(getStudyGroup(ids[0])).toBe(STUDY_GROUPS[0]);
    expect(getStudyGroup('missing')).toBeNull();
  });

  it.each(STUDY_GROUPS.map((group) => [group.id, group] as const))('%s is well formed', (_id, group) => {
    expectText(group.topic, 'topic');
    // Groups are known by topic only; no student names in the app or the data.
    expect(Object.keys(group).sort()).toEqual(['icon', 'id', 'sections', 'topic']);
    expect(glyphs[group.icon]).toBeDefined();
    expect(runSections(group).length).toBeGreaterThan(0);
    expect(personSections(group).length + runSections(group).length).toBe(group.sections.length);

    const sectionKeys = group.sections.map((section) => section.key);
    expect(new Set(sectionKeys).size).toBe(sectionKeys.length);
    group.sections.forEach((section) => {
      expectText(section.title, `section ${section.key}`);
      expect(section.items.length).toBeGreaterThan(0);
    });

    const items = allItems(group.sections);
    const keys = items.map((item) => item.key);
    expect(new Set(keys).size).toBe(keys.length);
    items.forEach((item) => checkItem(item, `${group.id}.${item.key}`));

    // Follow-up questions point at an earlier question and one of its answers.
    items.forEach((item, index) => {
      if (!item.showIf) return;
      const source = items.slice(0, index).find((candidate) => candidate.key === item.showIf!.key);
      expect(source?.type).toBe('choice');
      if (source?.type === 'choice') {
        expect(source.options.map((option) => option.value ?? option.key)).toContain(item.showIf.equals);
      }
    });

    const columns = items.flatMap((item) => itemExportColumns(item));
    expect(new Set(columns).size).toBe(columns.length);
  });
});

describe('study table columns', () => {
  it('has unique column names', () => {
    expect(new Set(STUDY_COLUMNS).size).toBe(STUDY_COLUMNS.length);
  });

  it('starts with the identifiers', () => {
    expect(STUDY_COLUMNS.slice(0, 4)).toEqual(['run_id', 'run_number', 'participant_id', 'participant_code']);
  });

  it('gives every group its own prefixed columns', () => {
    for (const group of STUDY_GROUPS) {
      const prefix = groupColumnPrefix(group);
      const expected = allItems(group.sections).flatMap((item) => itemExportColumns(item)).map((name) => prefix + name);
      expect(STUDY_COLUMNS.filter((column) => column.startsWith(prefix))).toEqual(expected);
    }
  });

  it('documents every column in the codebook, in the same order', () => {
    expect(buildCodebook().map((entry) => entry.column)).toEqual(STUDY_COLUMNS);
    buildCodebook().forEach((entry) => expect(entry.question.length).toBeGreaterThan(0));
  });
});
