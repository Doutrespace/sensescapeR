# Soundscape Assessment Workflow Improvement Plan

## Overview

This plan addresses improvements to align the app with ISO 12913-2/3 standards and Soundscapy data structures for urban soundscape assessment through sound, photos, and text.

**Reference:** [Soundscapy Documentation](https://soundscapy.readthedocs.io/en/stable/tutorials/HowToAnalyseAndRepresentSoundscapes/)

---

## Current Workflow Analysis

### Recording Flow (Existing)
```
IDLE → PROTOCOL → RECORDING → REVIEW → PHOTO_CAPTURE → NOTES → CIRCUMPLEX → CONTEXT → SAVING
```

### Data Captured Currently

| Category | Data | Status |
|----------|------|--------|
| **Audio** | WAV file, spectrogram, YAMNet classifications | Complete |
| **Photo** | Image + COCO-SSD/ADE20K classifications | Complete |
| **Text** | Field notes, spoken description transcript | Complete |
| **Perception** | Circumplex (pleasant, eventful) only | **Incomplete** |
| **Context** | Habitat, source dominance, setting, privacy, license | Complete |
| **Acoustic** | peakDb, rmsDb, clipping, SNR, wind flags | **Display issue** |

---

## Issue #1: PAQ Values Not Derived from Circumplex

### Current State

The `CircumplexInput` component captures:
```typescript
interface CircumplexPerception {
  pleasant: number;  // -1 to 1
  eventful: number;  // -1 to 1
}
```

But the database schema expects all 8 PAQ values:
```sql
iso_pleasant, iso_eventful,  -- Currently stored
paq_pleasant, paq_vibrant, paq_eventful, paq_chaotic,
paq_annoying, paq_monotonous, paq_uneventful, paq_calm  -- Always NULL
```

### ISO 12913-3 Calculation (Forward)

The app has `calculateCircumplexFromPAQ()` for PAQ → Circumplex:
```typescript
ISOPleasant = [(pleasant - annoying) + cos(45°) × (calm - chaotic) + cos(45°) × (vibrant - monotonous)] × 1/(4 + √32)
ISOEventful = [(eventful - uneventful) + cos(45°) × (chaotic - calm) + cos(45°) × (vibrant - monotonous)] × 1/(4 + √32)
```

### Missing: Reverse Calculation (Circumplex → PAQ)

When user places pin on circumplex, derive estimated PAQ values:

```typescript
function calculatePAQFromCircumplex(
  pleasant: number,  // -1 to 1
  eventful: number   // -1 to 1
): PAQPerception {
  // The circumplex position implies relative values on opposing axes
  // pleasant/annoying are opposite poles
  // eventful/uneventful are opposite poles
  // Diagonal attributes (vibrant, chaotic, monotonous, calm) derive from quadrant

  const cos45 = Math.cos(Math.PI / 4);  // ≈ 0.707

  // Map -1..1 to 1..5 Likert scale
  const toScale = (v: number) => (v + 1) * 2 + 1;  // -1→1, 0→3, 1→5

  // Primary axis mapping
  const pleasantRaw = pleasant;
  const eventfulRaw = eventful;

  // Diagonal attributes from quadrant position
  // Vibrant: +pleasant, +eventful (top-right)
  // Chaotic: -pleasant, +eventful (top-left)
  // Calm: +pleasant, -eventful (bottom-right)
  // Monotonous: -pleasant, -eventful (bottom-left)

  const vibrant = (pleasant + eventful) / 2;
  const chaotic = (-pleasant + eventful) / 2;
  const calm = (pleasant - eventful) / 2;
  const monotonous = (-pleasant - eventful) / 2;

  return {
    pleasant: toScale(pleasantRaw),
    annoying: toScale(-pleasantRaw),
    eventful: toScale(eventfulRaw),
    uneventful: toScale(-eventfulRaw),
    vibrant: toScale(vibrant),
    chaotic: toScale(chaotic),
    calm: toScale(calm),
    monotonous: toScale(monotonous),
  };
}
```

### Proposed Changes

1. **Add `calculatePAQFromCircumplex()` function** in `perceptions.ts`
2. **Update `createPerception()` to auto-derive PAQ** when only circumplex provided
3. **Display derived PAQ values** in CircumplexInput UI feedback
4. **Export complete PAQ data** for Soundscapy compatibility

---

## Issue #2: dB Values Display (Always Negative)

### Current State

The ReviewScreen shows:
```
Peak: -23.5 dB
```

This is **dBFS (decibels relative to Full Scale)** where:
- 0 dBFS = maximum digital level (clipping)
- -60 dBFS = near silence
- Typical ambient: -40 to -20 dBFS

### Problem

Users see negative numbers and think it's an error or wrong. Negative dB is confusing outside audio engineering contexts.

### Proposed Solutions

#### Option A: Show Level Percentage (Recommended for Mobile)
```
Peak Level: 72%
RMS Level: 45%
```
Uses existing `dbToNormalized()` function.

#### Option B: Show dBFS with Context
```
Peak: -23 dBFS (Good)
          ████████████░░░░░░
          Quiet ←→ Loud
```

#### Option C: Estimated dB SPL (Requires Calibration)
```
Estimated: ~65 dB SPL
(Uncalibrated estimate)
```
Map dBFS to approximate SPL using device microphone sensitivity curves.

### Proposed Changes

1. **Update `ReviewScreen.tsx`** - Replace raw dBFS with percentage or visual meter
2. **Update `ResultsPanel.tsx`** - Add live level indicator during recording
3. **Add `formatAudioLevel()` utility** - Consistent formatting across app
4. **Consider color coding** - Green (good), yellow (low), red (clipping)

---

## Issue #3: Soundscapy-Compatible Data Export

### Soundscapy Expected Columns

Based on [Soundscapy documentation](https://soundscapy.readthedocs.io/en/latest/tutorials/QuickStart/):

```
RecordID, GroupID, SessionID, LocationID,
pleasant, vibrant, eventful, chaotic, annoying, monotonous, uneventful, calm,
ISOPleasant, ISOEventful,
LAeq, LAmax, LA10, LA90, N5, Sharpness, ... (acoustics)
```

### Current Export Format

The app has `formatters.ts` with CSV export, but:
- PAQ values are always NULL (not derived)
- Column names differ from Soundscapy standard
- Missing acoustic metrics beyond peak/RMS

### Proposed Export Schema

```typescript
interface SoundscapyExportRow {
  // Identifiers
  RecordID: string;
  LocationID: string;  // from habitatType or GPS cluster
  Timestamp: string;

  // PAQ attributes (1-5 scale)
  pleasant: number;
  vibrant: number;
  eventful: number;
  chaotic: number;
  annoying: number;
  monotonous: number;
  uneventful: number;
  calm: number;

  // ISO coordinates (-1 to 1)
  ISOPleasant: number;
  ISOEventful: number;

  // Acoustic metrics
  LAeq_approx: number;  // from rmsDb
  LAmax_approx: number; // from peakDb

  // Context
  HabitatType: string;
  Biophony: number;
  Geophony: number;
  Anthrophony: number;

  // Environment (from photo classification)
  DominantScene: string;
  DetectedObjects: string;

  // Text descriptions
  FieldNotes: string;
  SpokenDescription: string;

  // Metadata
  DeviceModel: string;
  Latitude: number | null;
  Longitude: number | null;
  PrivacyMode: string;
}
```

### Proposed Changes

1. **Create `soundscapyExport.ts`** - New formatter for Soundscapy format
2. **Add export UI** in Profile screen with format selector
3. **Calculate all PAQ values** before export
4. **Validate against Soundscapy schema**

---

## Issue #4: Environment Assessment Completeness

### Current Photo Classification

- Object detection (COCO-SSD): people, cars, benches, etc.
- Environment segmentation (ADE20K): sky, building, vegetation, etc.
- Scene categorization: nature, urban, water, etc.

### Enhancements for Soundscape Context

#### Add Semantic Grouping for Soundscape Relevance

```typescript
interface EnvironmentAssessment {
  // Visual dominance (from segmentation coverage)
  visualDominance: {
    natural: number;     // trees, grass, water, sky
    built: number;       // buildings, roads, structures
    transitional: number; // parks, gardens
  };

  // Sound source indicators (from object detection)
  potentialSoundSources: {
    traffic: string[];   // ['car', 'bus', 'motorcycle']
    nature: string[];    // ['bird', 'tree', 'water']
    human: string[];     // ['person', 'group', 'activity']
  };

  // Space type estimation
  spaceType: 'open' | 'enclosed' | 'semi-open';
  vegetationCoverage: number;  // 0-1
}
```

### Proposed Changes

1. **Enhance `imageClassification.ts`** - Add soundscape-relevant grouping
2. **Auto-suggest source dominance** - Pre-fill biophony/geophony/anthrophony from photo
3. **Cross-validate** - Compare detected sounds (YAMNet) with visible sources (photo)

---

## Issue #5: Text Description Integration

### Current State

- Field notes: free text (600 chars)
- Spoken description: transcribed text (600 chars)

### Enhancements

#### Structured Prompts

Instead of blank text fields, provide guided prompts:

```
What sounds can you hear? (list them)
What is the dominant sound source?
How does this place make you feel?
What activity is happening here?
Is this typical for this location?
```

#### Auto-Tagging from Text

Use NLP to extract:
- Sound mentions: "birds", "traffic", "music"
- Temporal: "constant", "intermittent", "occasional"
- Emotional: "relaxing", "stressful", "pleasant"

### Proposed Changes

1. **Add guided prompts** - Optional structured input mode
2. **Show prompt suggestions** - Contextual hints based on photo/sound
3. **Extract keywords** - Tag detected sound sources from text

---

## Implementation Roadmap

### Phase 1: PAQ Derivation (Priority: High)

| Task | File | Effort |
|------|------|--------|
| Add `calculatePAQFromCircumplex()` | `perceptions.ts` | Small |
| Update `createPerception()` to auto-derive | `perceptions.ts` | Small |
| Show PAQ values in CircumplexInput UI | `CircumplexInput.tsx` | Medium |
| Validate calculation against ISO standard | Test files | Medium |

### Phase 2: dB Display Fix (Priority: High)

| Task | File | Effort |
|------|------|--------|
| Create `formatAudioLevel()` utility | `audio.ts` | Small |
| Update ReviewScreen to show percentage | `ReviewScreen.tsx` | Small |
| Add visual level meter | `ReviewScreen.tsx` | Medium |
| Color coding for level ranges | Theme/constants | Small |

### Phase 3: Soundscapy Export (Priority: Medium)

| Task | File | Effort |
|------|------|--------|
| Create Soundscapy export formatter | `soundscapyExport.ts` | Medium |
| Add export UI to Profile | `profile.tsx` | Medium |
| Column name mapping | `formatters.ts` | Small |
| Test with Soundscapy Python package | Manual | Medium |

### Phase 4: Environment Enhancement (Priority: Medium)

| Task | File | Effort |
|------|------|--------|
| Add soundscape-relevant grouping | `imageClassification.ts` | Medium |
| Auto-suggest source dominance | `ContextScreen.tsx` | Medium |
| Cross-validation UI | New component | Large |

### Phase 5: Text Improvements (Priority: Low)

| Task | File | Effort |
|------|------|--------|
| Guided prompt mode | `FieldNotesScreen.tsx` | Medium |
| Contextual hints | `FieldNotesScreen.tsx` | Medium |
| Keyword extraction | New utility | Large |

---

## Data Structure Alignment

### Current Database Schema vs Soundscapy

| Soundscapy Field | Current Field | Status |
|------------------|---------------|--------|
| pleasant (1-5) | paqPleasant | NULL (needs derivation) |
| vibrant (1-5) | paqVibrant | NULL (needs derivation) |
| eventful (1-5) | paqEventful | NULL (needs derivation) |
| chaotic (1-5) | paqChaotic | NULL (needs derivation) |
| annoying (1-5) | paqAnnoying | NULL (needs derivation) |
| monotonous (1-5) | paqMonotonous | NULL (needs derivation) |
| uneventful (1-5) | paqUneventful | NULL (needs derivation) |
| calm (1-5) | paqCalm | NULL (needs derivation) |
| ISOPleasant (-1 to 1) | isoPleasant | Stored |
| ISOEventful (-1 to 1) | isoEventful | Stored |
| LAeq | rmsDb | Approximate (uncalibrated) |
| LAmax | peakDb | Approximate (uncalibrated) |
| Latitude | latitude | Stored (privacy-aware) |
| Longitude | longitude | Stored (privacy-aware) |

---

## UI/UX Improvements

### CircumplexInput Enhancements

1. **Show derived PAQ values** as user drags pin
2. **Add quadrant intensity feedback** - "Strongly Vibrant", "Mildly Calm"
3. **Animate transitions** between quadrants
4. **Add ISO coordinate display** - Show exact (-0.45, 0.72) position

### ReviewScreen Audio Display

1. **Replace "-23.5 dB" with level bar** - Visual percentage
2. **Add RMS display** alongside Peak
3. **Color code quality** - Green/Yellow/Red ranges
4. **Show clipping warning** more prominently

### Export Integration

1. **Add "Export for Soundscapy" button** in Profile
2. **Show export preview** before saving
3. **Support multiple formats** - CSV, JSON, GeoJSON
4. **Include audio file references** or optionally bundle

---

## Validation Requirements

### PAQ Calculation Validation

```typescript
// Test case: Center position should give neutral PAQ values
const center = calculatePAQFromCircumplex(0, 0);
expect(center.pleasant).toBe(3);  // Neutral on 1-5 scale
expect(center.eventful).toBe(3);

// Test case: Top-right should be vibrant
const topRight = calculatePAQFromCircumplex(1, 1);
expect(topRight.vibrant).toBeGreaterThan(4);
expect(topRight.pleasant).toBeGreaterThan(4);
expect(topRight.eventful).toBeGreaterThan(4);

// Test case: Round-trip consistency
const paq = calculatePAQFromCircumplex(0.5, -0.3);
const circumplex = calculateCircumplexFromPAQ(paq);
expect(circumplex.pleasant).toBeCloseTo(0.5, 1);
expect(circumplex.eventful).toBeCloseTo(-0.3, 1);
```

### Export Validation

```python
# Python test with Soundscapy
import soundscapy as sspy

# Load exported data
df = sspy.load("soundscape_export.csv")

# Validate ISO coordinates
df = sspy.add_iso_coords(df)

# Should match stored values
assert df['ISOPleasant_calculated'].equals(df['ISOPleasant'])
```

---

## Summary

| Issue | Priority | Effort | Impact |
|-------|----------|--------|--------|
| PAQ derivation from circumplex | High | Medium | Data completeness, Soundscapy compatibility |
| dB display improvement | High | Small | User understanding, professionalism |
| Soundscapy export format | Medium | Medium | Research compatibility, data sharing |
| Environment assessment | Medium | Medium | Context accuracy |
| Text improvements | Low | Large | User experience |

**Total estimated effort:** 2-3 weeks for Phase 1-3 (core improvements)

---

## References

- [ISO 12913-2:2018](https://www.iso.org/standard/75267.html) - Soundscape field surveys
- [ISO 12913-3:2019](https://www.iso.org/standard/69864.html) - Data analysis
- [Soundscapy Documentation](https://soundscapy.readthedocs.io/)
- [How to analyse and represent quantitative soundscape data](https://pubs.aip.org/asa/jel/article/2/3/037201/2845750/How-to-analyse-and-represent-quantitative)

---

*Generated: 2026-03-07*
