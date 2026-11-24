import { STUDY_GROUPS } from '../../study/groups';
import { MULTISENSORY_MODULES } from '../../types/multisensory';
import { TopicColors } from '../colors';
import { GROUP_COLORS, groupColor } from '../topicColors';

/** WCAG relative luminance of a #RRGGBB colour. */
function luminance(hex: string): number {
  const channels = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const [r, g, b] = channels.map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

describe('topic colours', () => {
  it('gives every project group its own colour', () => {
    const ids = STUDY_GROUPS.map((group) => group.id);
    expect(Object.keys(GROUP_COLORS).sort()).toEqual([...ids].sort());
    expect(new Set(ids.map((id) => groupColor(id).color)).size).toBe(ids.length);
  });

  it('gives every senses page its own colour', () => {
    const colors = MULTISENSORY_MODULES.map((module) => module.color);
    expect(new Set(colors).size).toBe(MULTISENSORY_MODULES.length);
  });

  it('keeps white icons and coloured text readable', () => {
    for (const { color, soft } of Object.values(TopicColors)) {
      expect(contrast(color, '#FFFFFF')).toBeGreaterThanOrEqual(4.5);
      expect(contrast(color, soft)).toBeGreaterThanOrEqual(4.5);
    }
  });
});
