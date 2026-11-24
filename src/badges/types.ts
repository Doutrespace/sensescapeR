/**
 * Badge system types for gamification
 */

export type BadgeType =
  | 'recording_milestone'
  | 'daily_burst'
  | 'streak'
  | 'time_based'
  | 'location';

export interface BadgeDefinition {
  id: string;
  name: string;
  description: string;
  /** MaterialCommunityIcons glyph. */
  icon: string;
  color: string;
  glowColor: string;
  requirement: {
    type: BadgeType;
    value: number;
    timeWindow?: 'day' | 'week' | 'month';
  };
  tier: number;
  isSpecial?: boolean;
}

export interface EarnedBadge {
  badgeId: string;
  earnedAt: string;
  recordingCount: number;
}

export interface BadgeProgress {
  totalRecordings: number;
  todayRecordings: number;
  todayDate: string;
  currentStreak: number;
  lastRecordingDate: string | null;
  earnedBadges: EarnedBadge[];
}

export interface BadgeCheckResult {
  newBadges: BadgeDefinition[];
  progress: BadgeProgress;
  nextMilestone: BadgeDefinition | null;
  progressToNext: number;
}
