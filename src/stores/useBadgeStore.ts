/**
 * Badge store for tracking achievements and progress
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import {
  BadgeDefinition,
  BadgeProgress,
  EarnedBadge,
  BadgeCheckResult,
} from '../badges/types';
import {
  ALL_BADGES,
  MILESTONE_BADGES,
  SPECIAL_BADGES,
  getNextMilestoneBadge,
  getProgressToNextBadge,
} from '../badges/definitions';
import { LoggingService } from '../services/logging';

const BADGE_STORAGE_KEY = 'soundscape.badges.v1';

interface StoredBadgeData {
  totalRecordings: number;
  todayRecordings: number;
  todayDate: string;
  currentStreak: number;
  lastRecordingDate: string | null;
  earnedBadges: EarnedBadge[];
}

interface BadgeStoreState extends BadgeProgress {
  isLoaded: boolean;
  pendingCelebration: BadgeDefinition | null;
  recentlyEarnedBadges: BadgeDefinition[];

  initialize: () => Promise<void>;
  checkAndAwardBadges: (recordingTime?: Date) => Promise<BadgeCheckResult>;
  dismissCelebration: () => void;
  clearRecentBadges: () => void;
  getEarnedBadgeDefinitions: () => BadgeDefinition[];
  getHighestBadge: () => BadgeDefinition | null;
  resetProgress: () => Promise<void>;
}

function getDateString(date: Date): string {
  return date.toISOString().split('T')[0];
}

function isConsecutiveDay(lastDate: string | null, currentDate: string): boolean {
  if (!lastDate) return false;

  const last = new Date(lastDate);
  const current = new Date(currentDate);
  const diffTime = current.getTime() - last.getTime();
  const diffDays = diffTime / (1000 * 60 * 60 * 24);

  return diffDays === 1;
}

function isSameDay(date1: string, date2: string): boolean {
  return date1 === date2;
}

const DEFAULT_PROGRESS: StoredBadgeData = {
  totalRecordings: 0,
  todayRecordings: 0,
  todayDate: getDateString(new Date()),
  currentStreak: 0,
  lastRecordingDate: null,
  earnedBadges: [],
};

async function persistBadgeData(data: StoredBadgeData): Promise<void> {
  await AsyncStorage.setItem(BADGE_STORAGE_KEY, JSON.stringify(data));
}

export const useBadgeStore = create<BadgeStoreState>((set, get) => ({
  ...DEFAULT_PROGRESS,
  isLoaded: false,
  pendingCelebration: null,
  recentlyEarnedBadges: [],

  initialize: async () => {
    try {
      const storedValue = await AsyncStorage.getItem(BADGE_STORAGE_KEY);
      if (!storedValue) {
        set({ isLoaded: true });
        return;
      }

      const parsed = JSON.parse(storedValue) as Partial<StoredBadgeData>;
      const today = getDateString(new Date());

      // Reset today's count if it's a new day
      const todayRecordings = parsed.todayDate === today
        ? (parsed.todayRecordings ?? 0)
        : 0;

      // Check if streak should be reset (more than 1 day gap)
      let currentStreak = parsed.currentStreak ?? 0;
      if (parsed.lastRecordingDate) {
        const lastDate = new Date(parsed.lastRecordingDate);
        const daysSinceLastRecording = Math.floor(
          (new Date().getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24)
        );
        if (daysSinceLastRecording > 1) {
          currentStreak = 0;
        }
      }

      set({
        totalRecordings: parsed.totalRecordings ?? 0,
        todayRecordings,
        todayDate: today,
        currentStreak,
        lastRecordingDate: parsed.lastRecordingDate ?? null,
        earnedBadges: parsed.earnedBadges ?? [],
        isLoaded: true,
      });
    } catch (error) {
      LoggingService.warn('Failed to load badge progress', {
        error: error instanceof Error ? error.message : String(error),
      });
      set({ isLoaded: true });
    }
  },

  checkAndAwardBadges: async (recordingTime?: Date) => {
    const state = get();
    const now = recordingTime ?? new Date();
    const today = getDateString(now);
    const hour = now.getHours();

    // Update recording counts
    let newTodayRecordings = state.todayRecordings;
    if (state.todayDate !== today) {
      // New day - reset today's count
      newTodayRecordings = 1;
    } else {
      newTodayRecordings += 1;
    }

    const newTotalRecordings = state.totalRecordings + 1;

    // Update streak
    let newStreak = state.currentStreak;
    if (state.lastRecordingDate === null) {
      newStreak = 1;
    } else if (!isSameDay(state.lastRecordingDate, today)) {
      if (isConsecutiveDay(state.lastRecordingDate, today)) {
        newStreak += 1;
      } else {
        newStreak = 1;
      }
    }

    // Check for new badges
    const earnedBadgeIds = new Set(state.earnedBadges.map(b => b.badgeId));
    const newBadges: BadgeDefinition[] = [];

    // Check milestone badges
    for (const badge of MILESTONE_BADGES) {
      if (!earnedBadgeIds.has(badge.id) && newTotalRecordings >= badge.requirement.value) {
        newBadges.push(badge);
      }
    }

    // Check special badges
    for (const badge of SPECIAL_BADGES) {
      if (earnedBadgeIds.has(badge.id)) continue;

      switch (badge.requirement.type) {
        case 'daily_burst':
          if (newTodayRecordings >= badge.requirement.value) {
            newBadges.push(badge);
          }
          break;

        case 'streak':
          if (newStreak >= badge.requirement.value) {
            newBadges.push(badge);
          }
          break;

        case 'time_based':
          // Night Owl: after midnight (0-4 AM)
          if (badge.id === 'night_owl' && hour >= 0 && hour < 5) {
            newBadges.push(badge);
          }
          // Early Bird: 5-7 AM
          if (badge.id === 'early_bird' && hour >= 5 && hour < 7) {
            newBadges.push(badge);
          }
          break;
      }
    }

    // Create earned badge records
    const newEarnedBadges: EarnedBadge[] = newBadges.map(badge => ({
      badgeId: badge.id,
      earnedAt: now.toISOString(),
      recordingCount: newTotalRecordings,
    }));

    const updatedProgress: StoredBadgeData = {
      totalRecordings: newTotalRecordings,
      todayRecordings: newTodayRecordings,
      todayDate: today,
      currentStreak: newStreak,
      lastRecordingDate: today,
      earnedBadges: [...state.earnedBadges, ...newEarnedBadges],
    };

    // Persist and update state
    await persistBadgeData(updatedProgress);

    set({
      ...updatedProgress,
      pendingCelebration: newBadges.length > 0 ? newBadges[0] : null,
      recentlyEarnedBadges: newBadges,
    });

    const result: BadgeCheckResult = {
      newBadges,
      progress: updatedProgress,
      nextMilestone: getNextMilestoneBadge(newTotalRecordings),
      progressToNext: getProgressToNextBadge(newTotalRecordings).percentage,
    };

    if (newBadges.length > 0) {
      LoggingService.info('New badges earned', {
        badges: newBadges.map(b => b.id),
        totalRecordings: newTotalRecordings,
      });
    }

    return result;
  },

  dismissCelebration: () => {
    const state = get();
    const remaining = state.recentlyEarnedBadges.slice(1);

    set({
      pendingCelebration: remaining.length > 0 ? remaining[0] : null,
      recentlyEarnedBadges: remaining,
    });
  },

  clearRecentBadges: () => {
    set({
      pendingCelebration: null,
      recentlyEarnedBadges: [],
    });
  },

  getEarnedBadgeDefinitions: () => {
    const state = get();
    return state.earnedBadges
      .map(earned => ALL_BADGES.find(b => b.id === earned.badgeId))
      .filter((b): b is BadgeDefinition => b !== undefined);
  },

  getHighestBadge: () => {
    const state = get();
    const earnedMilestones = state.earnedBadges
      .map(earned => MILESTONE_BADGES.find(b => b.id === earned.badgeId))
      .filter((b): b is BadgeDefinition => b !== undefined);

    if (earnedMilestones.length === 0) return null;

    return earnedMilestones.reduce((highest, badge) =>
      badge.tier > highest.tier ? badge : highest
    );
  },

  resetProgress: async () => {
    await AsyncStorage.removeItem(BADGE_STORAGE_KEY);
    set({
      ...DEFAULT_PROGRESS,
      todayDate: getDateString(new Date()),
      pendingCelebration: null,
      recentlyEarnedBadges: [],
    });
  },
}));
