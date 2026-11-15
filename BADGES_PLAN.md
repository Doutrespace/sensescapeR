# Achievement Badges System - Implementation Plan

## Overview

A gamification system with collectible badges that reward users for recording milestones, creating engagement and a sense of accomplishment.

---

## Badge Tiers

### Recording Milestones

| Badge | Requirement | Icon | Color | Name |
|-------|-------------|------|-------|------|
| 🌱 | 10 recordings | Seedling | `#84CC16` | "First Steps" |
| 🌿 | 50 recordings | Herb | `#22C55E` | "Getting Started" |
| 🌳 | 100 recordings | Tree | `#16A34A` | "Sound Explorer" |
| ⭐ | 250 recordings | Star | `#EAB308` | "Rising Star" |
| 🔥 | 500 recordings | Fire | `#F97316` | "On Fire" |
| 💎 | 1,000 recordings | Diamond | `#06B6D4` | "Diamond Ears" |
| 👑 | 2,500 recordings | Crown | `#A855F7` | "Sound Royalty" |
| 🏆 | 5,000 recordings | Trophy | `#FBBF24` | "Legend" |
| 🌟 | 10,000+ recordings | Glowing Star | Gradient Gold | "Grandmaster" |

### Special Achievements

| Badge | Requirement | Icon | Color | Name |
|-------|-------------|------|-------|------|
| ⚡ | 5 recordings in one day | Lightning | `#F59E0B` | "Daily Burst" |
| 🔥 | 7-day streak | Flame | `#EF4444` | "Week Warrior" |
| 🌍 | 10 different locations | Globe | `#3B82F6` | "World Listener" |
| 🌙 | Recording after midnight | Moon | `#6366F1` | "Night Owl" |
| 🌅 | Recording at sunrise (5-7am) | Sunrise | `#FB923C` | "Early Bird" |

---

## Visual Design

### Badge Display on Profile

```
    ┌─────────────┐
    │  Profile    │
    │   Avatar    │──┐
    │             │  │ Badge overlay
    └─────────────┘  │ (bottom-right)
           ┌────────┴────────┐
           │  🏆 x3          │
           │  (stacked if    │
           │   multiple)     │
           └─────────────────┘
```

### Badge Popup (on tap)

```
┌────────────────────────────────┐
│                                │
│         🏆                     │
│      (large, animated)         │
│                                │
│    "Legend"                    │
│    5,000 Recordings            │
│                                │
│    Earned: March 10, 2026      │
│                                │
│    ━━━━━━━━━━━━━━━━━━━━━━      │
│    Progress to next:           │
│    [████████░░] 80%            │
│    2,000 / 2,500               │
│                                │
└────────────────────────────────┘
```

---

## Animations

### 1. Badge Earned Celebration
- Full-screen confetti burst
- Badge flies in from center with spring animation
- Haptic: Success notification
- Glow pulse effect
- Optional: Subtle sound effect

### 2. Badge Tap Animation
- Scale bounce (1.0 → 1.3 → 1.0)
- Glow/shine sweep effect
- Haptic: Light impact
- Show badge detail modal

### 3. Daily Burst Achievement (5 recordings/day)
- Lightning bolt animation
- Screen flash effect
- Particle burst from recording button
- Haptic: Heavy impact

### 4. Progress Milestone (halfway to next badge)
- Subtle glow on profile badge
- Toast notification: "Halfway to [Next Badge]!"

---

## Data Structure

### Badge Definition
```typescript
interface BadgeDefinition {
  id: string;
  name: string;
  description: string;
  icon: string;  // Emoji or custom icon
  color: string;
  requirement: {
    type: 'recording_count' | 'daily_count' | 'streak' | 'locations' | 'time';
    value: number;
    timeWindow?: 'day' | 'week' | 'month';
  };
  tier: number;  // For sorting/display
}

interface UserBadge {
  badgeId: string;
  earnedAt: string;  // ISO timestamp
  progress: number;  // Current progress toward this badge
}

interface BadgeProgress {
  totalRecordings: number;
  todayRecordings: number;
  currentStreak: number;
  uniqueLocations: number;
  badges: UserBadge[];
  lastRecordingDate: string;
}
```

### Storage
- **AsyncStorage** for badge progress (fast, local)
- **SQLite** for backup/sync (optional)

---

## Implementation Steps

### Phase 1: Core Badge System
1. Create badge definitions and types
2. Create `useBadgeStore` Zustand store
3. Create badge progress tracking logic
4. Create `BadgeService` for checking/awarding badges

### Phase 2: Badge Display
1. Create `BadgeIcon` component (renders single badge)
2. Create `BadgeStack` component (stacked badges on profile)
3. Create `BadgeDetailModal` (shows on tap)
4. Integrate with profile screen

### Phase 3: Animations
1. Create `BadgeCelebration` component (full-screen celebration)
2. Create confetti animation
3. Add haptic feedback
4. Create badge tap animations

### Phase 4: Integration
1. Hook into recording save flow
2. Trigger badge checks after each recording
3. Show celebrations at appropriate moments
4. Add badge progress to profile stats

---

## File Structure

```
src/
├── badges/
│   ├── definitions.ts      # Badge definitions
│   ├── types.ts            # TypeScript types
│   └── service.ts          # Badge logic
├── stores/
│   └── useBadgeStore.ts    # Badge state
├── components/
│   └── badges/
│       ├── BadgeIcon.tsx           # Single badge
│       ├── BadgeStack.tsx          # Stacked badges
│       ├── BadgeDetailModal.tsx    # Detail popup
│       ├── BadgeCelebration.tsx    # Celebration overlay
│       └── ConfettiAnimation.tsx   # Confetti effect
```

---

## User Experience Flow

### Recording Saved
```
1. User completes recording
2. Recording saved to database
3. BadgeService.checkProgress() called
4. If new badge earned:
   a. Show BadgeCelebration overlay
   b. Play haptic feedback
   c. Update badge store
   d. Badge appears on profile
5. If milestone (50% to next):
   a. Show subtle toast notification
```

### Profile Badge Tap
```
1. User taps badge on profile
2. Badge bounces with haptic
3. BadgeDetailModal slides up
4. Shows:
   - Large badge icon (animated)
   - Badge name and description
   - Date earned
   - Progress to next badge
5. Tap outside to dismiss
```

---

## Technical Notes

- Use `react-native-reanimated` for smooth animations
- Use `expo-haptics` for tactile feedback
- Store badge state in Zustand for reactivity
- Persist to AsyncStorage for offline support
- Consider `lottie-react-native` for complex animations (optional)

---

*Ready to implement!*
