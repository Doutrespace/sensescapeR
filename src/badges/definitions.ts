/**
 * Badge definitions for the achievement system
 */

import { BadgeDefinition } from './types';

/**
 * Milestones a student can reach during a course project. Keep the array
 * sorted by `requirement.value`. Badge ids are stored on the device once
 * earned: never reuse an id for a different badge.
 */
export const MILESTONE_BADGES: BadgeDefinition[] = [
  {
    id: 'first_measurement',
    name: 'First Measurement',
    description: 'Save your first measurement',
    icon: 'flag-variant-outline',
    color: '#8DA356',
    glowColor: '#CFDCA8',
    requirement: { type: 'recording_milestone', value: 1 },
    tier: 1,
  },
  {
    id: 'warming_up',
    name: 'Warming Up',
    description: 'Save 3 measurements',
    icon: 'sprout-outline',
    color: '#6F9A4B',
    glowColor: '#BFD9A3',
    requirement: { type: 'recording_milestone', value: 3 },
    tier: 2,
  },
  {
    id: 'field_worker',
    name: 'Field Worker',
    description: 'Save 5 measurements',
    icon: 'walk',
    color: '#4E8A68',
    glowColor: '#A9D2BB',
    requirement: { type: 'recording_milestone', value: 5 },
    tier: 3,
  },
  {
    id: 'first_steps',
    name: 'Keen Ear',
    description: 'Save 10 measurements',
    icon: 'ear-hearing',
    color: '#2E7D7A',
    glowColor: '#9FD3D0',
    requirement: { type: 'recording_milestone', value: 10 },
    tier: 4,
  },
  {
    id: 'sense_collector',
    name: 'Sense Collector',
    description: 'Save 25 measurements',
    icon: 'leaf',
    color: '#3B6E8C',
    glowColor: '#A9C9DC',
    requirement: { type: 'recording_milestone', value: 25 },
    tier: 5,
  },
  {
    id: 'getting_started',
    name: 'City Mapper',
    description: 'Save 50 measurements',
    icon: 'map-marker-multiple-outline',
    color: '#6B5B95',
    glowColor: '#C5BBE0',
    requirement: { type: 'recording_milestone', value: 50 },
    tier: 6,
  },
  {
    id: 'sound_explorer',
    name: 'Sensescape Expert',
    description: 'Save 100 measurements',
    icon: 'compass-rose',
    color: '#B9863D',
    glowColor: '#EBD3A4',
    requirement: { type: 'recording_milestone', value: 100 },
    tier: 7,
  },
];

export const SPECIAL_BADGES: BadgeDefinition[] = [
  {
    id: 'daily_burst',
    name: 'Daily Burst',
    description: 'Save 5 measurements in a single day',
    icon: 'lightning-bolt',
    color: '#F59E0B',
    glowColor: '#FCD34D',
    requirement: { type: 'daily_burst', value: 5, timeWindow: 'day' },
    tier: 10,
    isSpecial: true,
  },
  {
    id: 'week_warrior',
    name: 'Week Warrior',
    description: 'Measure every day for 7 days in a row',
    icon: 'fire',
    color: '#EF4444',
    glowColor: '#FCA5A5',
    requirement: { type: 'streak', value: 7 },
    tier: 11,
    isSpecial: true,
  },
  {
    id: 'night_owl',
    name: 'Night Owl',
    description: 'Save a measurement after midnight',
    icon: 'weather-night',
    color: '#6366F1',
    glowColor: '#A5B4FC',
    requirement: { type: 'time_based', value: 0 },
    tier: 12,
    isSpecial: true,
  },
  {
    id: 'early_bird',
    name: 'Early Bird',
    description: 'Save a measurement at sunrise (5 to 7 am)',
    icon: 'weather-sunset-up',
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

  // The milestone directly below the next one (the list is sorted).
  const previousBadge = [...MILESTONE_BADGES]
    .reverse()
    .find((b) => b.requirement.value < nextBadge.requirement.value);
  const previousValue = previousBadge?.requirement.value ?? 0;
  const range = nextBadge.requirement.value - previousValue;
  const progress = recordingCount - previousValue;

  return {
    current: progress,
    target: range,
    percentage: Math.min(100, Math.round((progress / range) * 100)),
  };
}
