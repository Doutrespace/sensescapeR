# Soundscape App Improvement Plan

## Overview

This plan addresses three major improvement areas:
1. **Visual Design** - Fullscreen-first approach, eliminate boxes-in-boxes
2. **User Flow** - Streamlined recording workflow
3. **Photo Classification** - Add camera capture with MediaPipe classification after recording

---

## Phase 1: Visual Design Overhaul

### Problem: Boxes-in-Boxes UI Pattern

Current nesting creates excessive padding:
```
SafeAreaView
  └─ Animated.View
       └─ ScrollView (padding: 24px)
            └─ GlassSurface (padding: 24px + 16px internal)
                 └─ Component (own padding: 24px)
```

**Result:** 64-88px of cumulative padding stealing screen real estate.

### Solution: Fullscreen Components

#### 1.1 Remove GlassSurface Wrapper from Main Flow
- Make perception screens (Circumplex, PAQ) fullscreen
- Use subtle backgrounds instead of card containers
- Reserve GlassSurface for secondary/modal content only

#### 1.2 Maximize Interactive Elements
- Circumplex plane: Currently capped at 300px → Make it 85% screen width
- PAQ wheel: Currently capped at 340px → Make it responsive to screen
- Spectrogram: Already fullscreen (good!)

#### 1.3 Updated index.tsx Structure
```tsx
// BEFORE
<ScrollView contentContainerStyle={{ padding: 24 }}>
  <GlassSurface style={{ padding: 24 }}>
    {renderContent()}
  </GlassSurface>
</ScrollView>

// AFTER
<View style={{ flex: 1 }}>
  {renderContent()}
</View>
```

#### 1.4 Component-Level Changes

**CircumplexInput.tsx:**
- Remove container padding
- Change PLANE_SIZE from `Math.min(screenWidth - 48, 300)` to `screenWidth * 0.85`
- Pin larger hit target
- Footer buttons at bottom with SafeAreaView inset

**PAQWheel.tsx:**
- Similar fullscreen treatment
- Larger wheel radius
- Floating continue button

**ContextScreen.tsx:**
- Use bottom sheet style (sheet slides up from bottom)
- Or fullscreen with larger touch targets
- Tab navigation remains but with better spacing

---

## Phase 2: Photo Classification Integration

### Overview
After completing an audio recording, capture a photo of the environment and classify it using MediaPipe (Google's ML framework).

### 2.1 New Recording Flow
```
RECORDING → REVIEW → PHOTO_CAPTURE → CIRCUMPLEX → PAQ → CONTEXT → SAVING
                         ↑ NEW
```

### 2.2 Required Dependencies
```json
{
  "expo-camera": "~17.0.0",
  "expo-image-picker": "~17.0.0",
  "@mediapipe/tasks-vision": "latest"
}
```

Note: MediaPipe for React Native has limited support. Options:
- **Option A:** Use TensorFlow Lite with MobileNet/EfficientNet (same pattern as YAMNet)
- **Option B:** Use cloud-based classification (Google Cloud Vision API via Supabase Edge Functions)
- **Option C:** Build native module wrapper for MediaPipe Android/iOS

**Recommended: Option A** - Consistent with existing TFLite audio classification approach.

### 2.3 New Components

**PhotoCaptureScreen.tsx:**
- Fullscreen camera view
- Large capture button (same style as record button)
- Preview after capture with retake/confirm options
- Skip option (photo is optional)

**PhotoClassificationResults.tsx:**
- Display top detected objects/scenes
- Store with recording metadata
- Show environment type (indoor, outdoor, urban, nature, etc.)

### 2.4 New Flow State
Add to `useRecordingFlow.ts`:
```typescript
type FlowState =
  | 'IDLE'
  | 'PROTOCOL'
  | 'COUNTDOWN'
  | 'RECORDING'
  | 'REVIEW'
  | 'PHOTO_CAPTURE'  // NEW
  | 'CIRCUMPLEX'
  | 'PAQ'
  | 'CONTEXT'
  | 'SAVING';
```

### 2.5 Database Schema Update
Add to recordings table:
```sql
ALTER TABLE recordings ADD COLUMN photo_uri TEXT;
ALTER TABLE recordings ADD COLUMN photo_classification JSONB;
```

### 2.6 Image Classification Model
Download MobileNetV3 or EfficientNet-Lite TFLite model:
- `assets/models/mobilenet_v3.tflite` (~5MB)
- Classify into scene categories (nature, urban, indoor, water, forest, etc.)

---

## Phase 3: Supabase Integration Completion

### 3.1 Current State
- Auth: Working (sign up/sign in)
- Upload: Queue-based with retry
- Storage: Audio files to bucket
- Database: Recordings & perceptions tables

### 3.2 Additions for Photo Feature
- Upload photos to separate bucket
- Store classification results in recordings table
- Add photo_uri column

### 3.3 Edge Function (Optional)
If using cloud classification:
```typescript
// supabase/functions/classify-image/index.ts
// Use Google Cloud Vision API for classification
```

---

## Implementation Order

### Sprint 1: Visual Design (Core) ✅ COMPLETED
1. [x] Create new fullscreen component variants
2. [x] Update CircumplexInput for fullscreen (85% width, dynamic sizing)
3. [x] Update PAQWheel for fullscreen (92% width, dynamic sizing)
4. [x] Remove GlassSurface wrapper from index.tsx (CIRCUMPLEX, PAQ, CONTEXT, RECORDING now fullscreen)
5. [x] Update ContextScreen layout (fixed footer, cleaner tabs)
6. [x] Add proper SafeAreaView handling per-component (tab bar height + insets)

### Sprint 2: Photo Capture ✅ COMPLETED
1. [x] Add expo-camera dependency
2. [x] Create PhotoCaptureScreen component
3. [x] Update recording flow state machine (PHOTO_CAPTURE state added after REVIEW)
4. [x] Add camera permission handling (with settings redirect)
5. [x] Implement photo storage (permanent storage in documents/photos folder)
6. [x] Update database schema (v4 migration with photo_uri, photo_classification columns)
7. [x] Update Recording type and store to support photo data

### Sprint 3: Image Classification
1. [ ] Download/integrate TFLite image model
2. [ ] Create useImageClassifier hook (mirror useAudioClassifier)
3. [ ] Display classification results
4. [ ] Store results with recording

### Sprint 4: Polish & Integration
1. [ ] Update Supabase schema
2. [ ] Add photo upload to sync pipeline
3. [ ] UI transitions and animations
4. [ ] Testing and bug fixes

---

## File Changes Summary

### Modified Files
- `app/(tabs)/index.tsx` - Remove GlassSurface wrapper
- `src/components/perception/CircumplexInput.tsx` - Fullscreen redesign
- `src/components/perception/PAQWheel.tsx` - Fullscreen redesign
- `src/components/context/ContextScreen.tsx` - Layout updates
- `src/components/ui/GlassSurface.tsx` - Make padding optional
- `src/hooks/useRecordingFlow.ts` - Add PHOTO_CAPTURE state
- `src/stores/useRecordingStore.ts` - Add photo fields
- `src/types/recording.ts` - Add photo types
- `src/services/database/recordings.ts` - Add photo columns
- `package.json` - Add camera dependencies

### New Files
- `src/components/photo/PhotoCaptureScreen.tsx`
- `src/components/photo/PhotoPreview.tsx`
- `src/components/photo/PhotoClassificationBadge.tsx`
- `src/hooks/useImageClassifier.ts`
- `src/utils/imageClassification.ts`
- `assets/models/mobilenet_v3.tflite`

---

## Design Mockup (ASCII)

### Current vs Proposed Circumplex Screen

```
CURRENT:                          PROPOSED:
┌────────────────────┐           ┌────────────────────┐
│ ┌────────────────┐ │           │   Perception       │
│ │ ┌────────────┐ │ │           │                    │
│ │ │            │ │ │           │ ┌────────────────┐ │
│ │ │  [300px]   │ │ │  ──────>  │ │                │ │
│ │ │  Circumplex│ │ │           │ │   [85% width]  │ │
│ │ │            │ │ │           │ │   Circumplex   │ │
│ │ └────────────┘ │ │           │ │                │ │
│ │  Values        │ │           │ └────────────────┘ │
│ │  [Continue]    │ │           │                    │
│ └────────────────┘ │           │  Pleasant: +45%    │
└────────────────────┘           │                    │
    24+24+16 = 64px              │    [Continue]      │
       padding                   └────────────────────┘
                                      0px edge padding
                                    (SafeArea handled)
```

---

## Questions to Confirm

1. **Photo requirement:** Should photo capture be mandatory or optional?
   → Suggested: Optional with skip button

2. **Classification model:** TFLite local vs Cloud API?
   → Suggested: TFLite local (consistent with audio)

3. **Scene categories:** What classifications are most useful?
   → Suggested: Nature, Urban, Indoor, Water, Traffic, Park, etc.

4. **Existing data:** Should we add photo to existing recordings retroactively?
   → Suggested: No, only new recordings
