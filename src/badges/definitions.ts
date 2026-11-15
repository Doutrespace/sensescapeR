/**
 * Badge definitions for the achievement system
 */

import { BadgeDefinition } from './types';

export const MILESTONE_BADGES: BadgeDefinition[] = [
  {
    id: 'first_steps',
    name: 'First Steps',
    description: 'Record your first 10 soundscapes',
    icon: '🌱',
    color: '#84CC16',
    glowColor: '#BEF264',
    requirement: { type: 'recording_milestone', value: 10 },
    tier: 1,
  },
  {
    id: 'getting_started',
    name: 'Getting Started',
    description: 'Reach 50 recordings',
    icon: '🌿',
    color: '#22C55E',
    glowColor: '#86EFAC',
    requirement: { type: 'recording_milestone', value: 50 },
    tier: 2,
  },
  {
    id: 'sound_explorer',
    name: 'Sound Explorer',
    description: 'Complete 100 recordings',
    icon: '🌳',
    color: '#16A34A',
    glowColor: '#4ADE80',
    requirement: { type: 'recording_milestone', value: 100 },
    tier: 3,
  },
  {
    id: 'rising_star',
    name: 'Rising Star',
    description: 'Achieve 250 recordings',
    icon: '⭐',
    color: '#EAB308',
    glowColor: '#FDE047',
    requirement: { type: 'recording_milestone', value: 250 },
    tier: 4,
  },
  {
    id: 'on_fire',
    name: 'On Fire',
    description: 'Blaze through 500 recordings',
    icon: '🔥',
    color: '#F97316',
    glowColor: '#FDBA74',
    requirement: { type: 'recording_milestone', value: 500 },
    tier: 5,
  },
  {
    id: 'diamond_ears',
    name: 'Diamond Ears',
    description: 'Master 1,000 recordings',
    icon: '💎',
    color: '#06B6D4',
    glowColor: '#67E8F9',
    requirement: { type: 'recording_milestone', value: 1000 },
    tier: 6,
  },
  {
    id: 'sound_royalty',
    name: 'Sound Royalty',
    description: 'Rule with 2,500 recordings',
    icon: '👑',
    color: '#A855F7',
    glowColor: '#D8B4FE',
    requirement: { type: 'recording_milestone', value: 2500 },
    tier: 7,
  },
  {
    id: 'legend',
    name: 'Legend',
    description: 'Legendary status with 5,000 recordings',
    icon: '🏆',
    color: '#FBBF24',
    glowColor: '#FDE68A',
    requirement: { type: 'recording_milestone', value: 5000 },
    tier: 8,
  },
  {
    id: 'grandmaster',
    name: 'Grandmaster',
    description: 'Ultimate mastery with 10,000+ recordings',
    icon: '🌟',
    color: '#FFD700',
    glowColor: '#FFF8DC',
    requirement: { type: 'recording_milestone', value: 10000 },
    tier: 9,
  },
];

export const SPECIAL_BADGES: BadgeDefinition[] = [
  {
    id: 'daily_burst',
    name: 'Daily Burst',
    description: 'Record 5 soundscapes in a single day',
    icon: '⚡',
    color: '#F59E0B',
    glowColor: '#FCD34D',
    requirement: { type: 'daily_burst', value: 5, timeWindow: 'day' },
    tier: 10,
    isSpecial: true,
  },
  {
    id: 'week_warrior',
    name: 'Week Warrior',
    description: 'Record every day for 7 days straight',
    icon: '🔥',
    color: '#EF4444',
    glowColor: '#FCA5A5',
    requirement: { type: 'streak', value: 7 },
    tier: 11,
    isSpecial: true,
  },
  {
    id: 'night_owl',
    name: 'Night Owl',
    description: 'Record a soundscape after midnight',
    icon: '🌙',
    color: '#6366F1',
    glowColor: '#A5B4FC',
    requirement: { type: 'time_based', value: 0 },
    tier: 12,
    isSpecial: true,
  },
  {
    id: 'early_bird',
    name: 'Early Bird',
    description: 'Record a soundscape at sunrise (5-7 AM)',
    icon: '🌅',
    color: '#FB923C',
    glowColor: '#FDBA74',
    requirement: { type: 'time_based', value: 5 },
    tier: 13,
    isSpecial: true,
  },
];

export const ALL_BADGES: BadgeDefinition[] = [...MILESTONE_BADGES, ...SPECIAL_BADGES];

export function getBadgeById(id: string): BadgeDefinition | undefined {
  return ALL_BADGES.find((badge) => badge.id === id);
}

export function getNextMilestoneBadge(recordingCount: number): BadgeDefinition | null {
  return MILESTONE_BADGES.find((badge) => badge.requirement.value > recordingCount) ?? null;
}

export function getHighestEarnedMilestoneBadge(recordingCount: number): BadgeDefinition | null {
  const earned = MILESTONE_BADGES.filter((badge) => badge.requirement.value <= recordingCount);
  return earned.length > 0 ? earned[earned.length - 1] : null;
}

export function getProgressToNextBadge(recordingCount: number): {
  current: number;
  target: number;
  percentage: number;
} {
  const nextBadge = getNextMilestoneBadge(recordingCount);
  if (!nextBadge) {
    return { current: recordingCount, target: recordingCount, percentage: 100 };
  }

  const previousBadge = MILESTONE_BADGES.find(
    (b) => b.requirement.value < nextBadge.requirement.value
  );
  const previousValue = previousBadge?.requirement.value ?? 0;
  const range = nextBadge.requirement.value - previousValue;
  const progress = recordingCount - previousValue;

  return {
    current: progress,
    target: range,
    percentage: Math.min(100, Math.round((progress / range) * 100)),
  };
}
