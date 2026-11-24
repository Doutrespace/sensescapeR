import { Colors, TopicColors, type TopicColor } from './colors';

/**
 * Colour of each project group, keyed by group id (see study/groups).
 * Presentation only: the colour is not part of the questionnaire or export.
 */
export const GROUP_COLORS: Record<string, TopicColor> = {
  aufenthalt: TopicColors.glacier,
  gruenraeume: TopicColors.sage,
  klangquellen: TopicColors.periwinkle,
  mainufer: TopicColors.seafoam,
  messbare_umwelt: TopicColors.mist,
  sicherheit: TopicColors.lavender,
  taktung: TopicColors.heather,
};

const FALLBACK: TopicColor = { color: Colors.accent, soft: Colors.accentSoft };

/** The group's topic colour; the app accent for a group without one. */
export function groupColor(groupId: string): TopicColor {
  return GROUP_COLORS[groupId] ?? FALLBACK;
}
