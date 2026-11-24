import type { StudyGroup, StudySection } from '../types';
import { AUFENTHALT } from './aufenthalt';
import { GRUENRAEUME } from './gruenraeume';
import { KLANGQUELLEN } from './klangquellen';
import { MAINUFER } from './mainufer';
import { MESSBARE_UMWELT } from './messbareUmwelt';
import { SICHERHEIT } from './sicherheit';
import { TAKTUNG } from './taktung';

/**
 * Project groups of the course, in the order they are offered after the main
 * questionnaire. To add a group: create a file next to this one and add it
 * here. Groups are shown and stored by topic only: no student names in the
 * app, the repository or the data. Never change the `id` of a group or the
 * `key` of a question once data has been collected, because both are part of
 * the export column names.
 */
export const STUDY_GROUPS: StudyGroup[] = [
  TAKTUNG,
  AUFENTHALT,
  MESSBARE_UMWELT,
  MAINUFER,
  SICHERHEIT,
  KLANGQUELLEN,
  GRUENRAEUME,
];

export function getStudyGroup(id: string | null | undefined): StudyGroup | null {
  if (!id) {
    return null;
  }
  return STUDY_GROUPS.find((group) => group.id === id) ?? null;
}

export function personSections(group: StudyGroup): StudySection[] {
  return group.sections.filter((section) => section.scope === 'person');
}

export function runSections(group: StudyGroup): StudySection[] {
  return group.sections.filter((section) => section.scope !== 'person');
}

/** Prefix of a group's export columns, e.g. `taktung__personen_blickfeld`. */
export function groupColumnPrefix(group: StudyGroup): string {
  return `${group.id}__`;
}
