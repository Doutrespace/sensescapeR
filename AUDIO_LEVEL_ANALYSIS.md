# Audio Recording Level Inconsistency Analysis

## Problem Statement

Some users' recordings are significantly quieter than others, leading to inconsistent audio levels across the dataset.

---

## Root Causes Identified

### 1. Missing `audioLevelingMode` Prop (Bug)

**Location:** `app/(tabs)/index.tsx:96-100`

```tsx
<EnhancedRecorder
  targetDuration={flow.store.targetDuration}
  onRecordingComplete={flow.handleRecordingComplete}
  onCancel={flow.handleRecordingCancel}
  // MISSING: audioLevelingMode={preferences.audioLevelingMode}
/>
```

The `EnhancedRecorder` component accepts an `audioLevelingMode` prop but it's never passed from the parent. This means the preference is ignored and normalization defaults are used.

**Impact:** Users who set `audioLevelingMode: 'off'` still get normalization (default), but more critically, the preference store is disconnected from the actual recording pipeline.

---

### 2. Insufficient Maximum Normalization Gain

**Location:** `src/services/audio/pcmWavRecorder.ts:10`

```typescript
const MAX_NORMALIZATION_GAIN = 6;  // Only ~15.5 dB boost
```

**Problem:** A 6x gain limit (15.5 dB) is insufficient for very quiet recordings.

| Original Level | With 6x Gain | Target (-20 dB RMS) | Gap |
|---------------|--------------|---------------------|-----|
| -50 dB | -34.5 dB | -20 dB | 14.5 dB short |
| -45 dB | -29.5 dB | -20 dB | 9.5 dB short |
| -40 dB | -24.5 dB | -20 dB | 4.5 dB short |
| -35 dB | -19.5 dB | -20 dB | OK |

**Recommendation:** Increase to `MAX_NORMALIZATION_GAIN = 18` (~25 dB) or higher.

---

### 3. Device Microphone Sensitivity Variation

Different devices have dramatically different microphone sensitivities:

| Device Type | Typical Sensitivity | Notes |
|------------|---------------------|-------|
| iPhone (recent) | -38 to -42 dBFS for conversation | Consistent |
| iPhone (older) | -45 to -50 dBFS | Quieter |
| Samsung flagship | -35 to -40 dBFS | Varies |
| Budget Android | -50 to -60 dBFS | Very quiet |
| Tablets | -55 to -65 dBFS | Often quieter |

**The app applies NO device-specific gain compensation.**

---

### 4. iOS Audio Session Configuration

**Location:** `src/services/audio/audioAnalyzer.ts:140-147`

```typescript
AudioManager.setAudioSessionOptions({
  iosCategory: 'playAndRecord',
  iosMode: 'measurement',  // No AGC applied
  iosOptions: ['defaultToSpeaker', 'allowBluetooth'],
  iosAllowHaptics: true,
});
```

**`measurement` mode:**
- Provides accurate, unprocessed audio (correct for research)
- Does NOT apply Automatic Gain Control (AGC)
- Does NOT apply noise reduction

This is technically correct for soundscape research (we want raw audio), but explains why some recordings are very quiet.

---

### 5. Normalization Logic Gaps

**Location:** `src/services/audio/pcmWavRecorder.ts:123-136`

```typescript
if (
  analysis.peakLinear <= 0 ||
  (
    analysis.rmsDb > QUIET_RMS_THRESHOLD_DB &&  // > -28 dB
    analysis.peakDb > QUIET_PEAK_THRESHOLD_DB   // > -12 dB
  )
) {
  return { chunks, appliedGain: 1, ... };  // NO normalization
}
```

**Problem:** A recording with:
- High peaks (> -12 dB) due to a single loud event
- Very low RMS (< -40 dB) for most of the recording

...will NOT be normalized because peak threshold is met.

---

### 6. No Pre-Recording Level Check

Users are not warned about low input levels before recording starts. They only see the issue after completing a recording.

---

## Recommended Fixes

### Priority 1: Pass audioLevelingMode Prop (Quick Fix)

```tsx
// app/(tabs)/index.tsx
import { usePreferencesStore } from '../../src/stores/usePreferencesStore';

// In component:
const { audioLevelingMode } = usePreferencesStore();

// In render:
<EnhancedRecorder
  targetDuration={flow.store.targetDuration}
  audioLevelingMode={audioLevelingMode}
  onRecordingComplete={flow.handleRecordingComplete}
  onCancel={flow.handleRecordingCancel}
/>
```

### Priority 2: Increase Maximum Normalization Gain

```typescript
// src/services/audio/pcmWavRecorder.ts
const MAX_NORMALIZATION_GAIN = 18;  // ~25 dB (was 6)
```

Consider making this configurable or applying different limits based on original level:
- Very quiet (-50 dB or below): Allow up to 32x gain
- Moderately quiet (-40 to -50 dB): Allow up to 18x gain
- Slightly quiet (-28 to -40 dB): Allow up to 6x gain

### Priority 3: Add Real-Time Level Warning

During recording, show a warning when levels are consistently low:

```typescript
// In EnhancedRecorder metering interval
if (rmsDb < -45 && duration > 3000) {
  // Show "Low input level" warning badge
  setShowLowLevelWarning(true);
}
```

### Priority 4: Improve Normalization Logic

Consider normalizing based on RMS alone, not combined peak+RMS:

```typescript
// Normalize if RMS is quiet, regardless of peaks
if (analysis.rmsDb < QUIET_RMS_THRESHOLD_DB) {
  // Apply normalization targeting RMS
}
```

### Priority 5: Add Optional AGC Mode

Add a preference for users who want automatic gain control:

```typescript
type AudioLevelingMode = 'off' | 'playback' | 'agc';

// In audio session setup for AGC mode:
AudioManager.setAudioSessionOptions({
  iosCategory: 'playAndRecord',
  iosMode: 'default',  // Enables AGC on iOS
  ...
});
```

**Tradeoff:** AGC affects scientific accuracy but improves consistency.

### Priority 6: Device Calibration (Advanced)

Store device-specific gain offsets:

```typescript
interface DeviceCalibration {
  deviceModel: string;
  gainOffset: number;  // dB offset to apply
}

// Crowd-sourced calibration data could be fetched
```

---

## Implementation Plan

| Task | Priority | Effort | Impact |
|------|----------|--------|--------|
| Pass audioLevelingMode prop | P0 | Small | Medium |
| Increase MAX_NORMALIZATION_GAIN | P0 | Small | High |
| Add low-level warning UI | P1 | Medium | Medium |
| Fix normalization logic (RMS-based) | P1 | Medium | High |
| Add AGC mode option | P2 | Medium | Medium |
| Pre-recording level check | P2 | Large | Medium |
| Device calibration system | P3 | Large | High |

---

## Quick Verification Steps

1. **Check current normalization behavior:**
   ```bash
   # Record in a quiet environment
   # Check saved WAV file levels
   # Verify normalizationApplied and normalizationGain in recording result
   ```

2. **Test on multiple devices:**
   - iPhone 12+
   - iPhone SE/older
   - Samsung flagship
   - Budget Android

3. **Compare peakDb and rmsDb** stored in database across users' recordings

---

## Metrics to Track

After implementing fixes, monitor:

1. **Distribution of rmsDb values** - Should center around -20 to -25 dB
2. **Normalization application rate** - What % of recordings are normalized
3. **Maximum gain applied** - Are we hitting the new ceiling?
4. **User complaints about quiet recordings** - Should decrease

---

*Analysis Date: 2026-03-09*
