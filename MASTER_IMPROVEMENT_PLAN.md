# Soundscape App - Master Improvement Plan

## Executive Summary

**App:** React Native/Expo soundscape recording application for environmental sound assessment
**Purpose:** ISO 12913-2 compliant soundscape perception and audio recording
**Current State:** Functional MVP with solid architecture, needs polish before production
**Overall Assessment:** 7.2/10

---

## Current Architecture Overview

```
soundscape-app/
├── app/                    # Expo Router navigation (tabs, onboarding)
├── src/
│   ├── components/         # Feature-organized UI components
│   ├── stores/             # Zustand state management (6 stores)
│   ├── services/           # Database, audio, sync, export, logging
│   ├── hooks/              # Custom hooks (recording flow, classifiers)
│   ├── utils/              # Audio processing, ML inference
│   ├── types/              # TypeScript interfaces
│   ├── constants/          # Protocols, thresholds, habitats
│   └── theme/              # Colors, typography, spacing
├── assets/                 # Icons, models (YAMNet TFLite)
└── test/                   # Unit tests (minimal coverage)
```

**Key Technologies:**
- Expo SDK 54 + React Native 0.81.5
- Zustand for state management
- expo-sqlite with WAL mode (5 migrations)
- react-native-audio-api for recording
- Skia Canvas for spectrogram visualization
- TensorFlow Lite for audio/image classification
- Supabase for optional cloud sync

---

## Issue Categories

### Critical (Must Fix)

| # | Issue | Location | Impact |
|---|-------|----------|--------|
| 1 | Console spam in production | `SpectrogramView.tsx` (10% diagnostic logging) | Performance, battery drain |
| 2 | No database pagination | `getRecordings()` loads ALL records | Memory crash with large datasets |
| 3 | Upload failures silent | `uploader.ts`, no UI feedback | Users don't know sync failed |
| 4 | No input validation | GPS coords, file paths unsanitized | Data corruption, security |
| 5 | Test coverage ~5% | Only 4 test files for utilities | Regression risk |

### High Priority

| # | Issue | Location | Impact |
|---|-------|----------|--------|
| 6 | Unencrypted local database | SQLite stores all data in plaintext | Privacy/security risk |
| 7 | No photo compression | Full resolution uploads | Slow uploads, bandwidth waste |
| 8 | No data cleanup strategy | Old recordings accumulate | Storage exhaustion |
| 9 | Memory leaks | AudioAnalyzer, spectrogram buffers | App slowdown, crashes |
| 10 | PAQ perception incomplete | Only Circumplex implemented | Incomplete ISO compliance |

### Medium Priority

| # | Issue | Location | Impact |
|---|-------|----------|--------|
| 11 | No accessibility audit | Colors, labels, screen readers | Excludes users with disabilities |
| 12 | Profile settings stubbed | "Coming Soon" alerts | Incomplete feature |
| 13 | Export UI missing | Service exists, no UI | Users can't export data |
| 14 | Error messages generic | Throughout codebase | Poor debugging experience |
| 15 | No offline indicator | UI doesn't show network state | User confusion |

### Low Priority (Nice to Have)

| # | Issue | Location | Impact |
|---|-------|----------|--------|
| 16 | No dark/light toggle | Hardcoded dark theme | User preference |
| 17 | No i18n | English only | International users |
| 18 | No batch operations | Single record operations only | Power user efficiency |
| 19 | No recording templates | Start fresh each time | Workflow efficiency |
| 20 | No analytics dashboard | No usage insights | Product decisions |

---

## Improvement Roadmap

### Phase 1: Stability & Quality (Week 1-2)

**Goal:** Fix critical bugs, establish testing foundation

#### 1.1 Fix Production Logging
```typescript
// SpectrogramView.tsx - Remove or gate diagnostic logging
// Current: Math.random() < 0.1 && console.log(...)
// Fix: Use LoggingService with debug flag
if (__DEV__ && LoggingService.isDebugEnabled()) {
  LoggingService.debug('Spectrogram', data);
}
```

#### 1.2 Implement Database Pagination
```typescript
// recordings.ts
export async function getRecordings(
  limit: number = 50,
  offset: number = 0,
  filters?: RecordingFilters
): Promise<{ recordings: Recording[]; total: number }> {
  // Add LIMIT/OFFSET to queries
  // Return total count for pagination UI
}
```

#### 1.3 Add Upload Error UI
- Create `SyncStatusBanner` component
- Show failed uploads with retry button
- Display detailed error messages
- Add toast notifications for sync events

#### 1.4 Input Validation Layer
```typescript
// Create src/utils/validation.ts
export function validateCoordinates(lat: number, lon: number): boolean;
export function validateAudioUri(uri: string): boolean;
export function sanitizeFilePath(path: string): string;
```

#### 1.5 Testing Foundation
- Set up Jest with React Native Testing Library
- Add component tests for critical flows
- Target 40% coverage for services/
- Add integration tests for database operations

**Deliverables:**
- [ ] Remove/gate all console.log in production
- [ ] Pagination for library view (infinite scroll)
- [ ] Sync status UI with retry capability
- [ ] Validation utilities with tests
- [ ] 40% test coverage for core services

---

### Phase 2: Security & Performance (Week 3-4)

**Goal:** Harden security, optimize performance

#### 2.1 Database Encryption
```bash
npm install @journeyapps/sqlcipher-expo
```
- Migrate to SQLCipher for encrypted SQLite
- Add secure key storage (expo-secure-store)
- Handle migration from unencrypted DB

#### 2.2 Photo Optimization
```typescript
// Add image compression before upload
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';

async function compressPhoto(uri: string): Promise<string> {
  const result = await manipulateAsync(
    uri,
    [{ resize: { width: 1920 } }],
    { compress: 0.8, format: SaveFormat.JPEG }
  );
  return result.uri;
}
```

#### 2.3 Memory Management
- Implement circular buffer for spectrogram data
- Add cleanup in AudioAnalyzer.dispose()
- Memoize expensive computations
- Add memory monitoring in dev mode

#### 2.4 Performance Optimizations
```typescript
// Add frame skipping for classifier
const CLASSIFIER_SKIP_FRAMES = 3;
let frameCount = 0;
onAudioFrame((frame) => {
  if (++frameCount % CLASSIFIER_SKIP_FRAMES === 0) {
    classifyAudio(frame);
  }
});
```

#### 2.5 Data Cleanup Strategy
- Add setting for max recording age
- Implement automatic cleanup job
- Add manual "Clear old data" in profile
- Show storage usage stats

**Deliverables:**
- [ ] Encrypted SQLite database
- [ ] Photo compression (< 500KB uploads)
- [ ] Memory leak fixes verified
- [ ] 30% performance improvement measured
- [ ] Auto-cleanup for recordings > 90 days

---

### Phase 3: Feature Completion (Week 5-6)

**Goal:** Complete partially implemented features

#### 3.1 Complete PAQ Perception Model
```typescript
// Currently only Circumplex (pleasant/eventful)
// Add full PAQ wheel with 8 dimensions:
// pleasant, vibrant, eventful, chaotic,
// annoying, monotonous, uneventful, calm

// Option A: Add PAQ as separate screen after Circumplex
// Option B: Replace Circumplex with full PAQ wheel
// Option C: Calculate PAQ from Circumplex (current approach, validate)
```

#### 3.2 Profile Settings Implementation
- Account settings (if authenticated)
- Default privacy mode preference
- Default license preference
- Audio quality presets
- Storage management
- Export options

#### 3.3 Export Functionality UI
```typescript
// Add export screen with options:
// - Format: CSV, JSON, GeoJSON
// - Date range filter
// - Include audio files toggle
// - Share via system sheet
```

#### 3.4 Offline Indicator
- Add network status banner
- Show "Offline mode" indicator
- Queue upload count badge
- Auto-retry when online

#### 3.5 Error Message Improvement
- Create error code system
- Add user-friendly messages
- Include recovery suggestions
- Log detailed errors for debugging

**Deliverables:**
- [ ] Complete PAQ perception input
- [ ] Functional profile settings
- [ ] Export to CSV/JSON/GeoJSON
- [ ] Network status indicator
- [ ] Improved error messages throughout

---

### Phase 4: Polish & Accessibility (Week 7-8)

**Goal:** Production-ready polish

#### 4.1 Accessibility Audit
- Color contrast verification (WCAG AA)
- Screen reader labels (accessibilityLabel)
- Touch target sizes (minimum 44x44)
- Reduce motion support
- Voice control testing

#### 4.2 UI/UX Refinements
- Consistent icon system
- Loading state skeletons
- Empty state illustrations
- Onboarding improvements
- Gesture hints

#### 4.3 Error Boundaries Enhancement
- Integrate with LoggingService
- Add crash reporting (Sentry)
- User-friendly error screens
- Recovery options

#### 4.4 Performance Monitoring
- Add performance marks
- Track screen load times
- Monitor memory usage
- Analytics integration

#### 4.5 Documentation
- User guide
- API documentation
- Contributing guide
- Architecture decision records

**Deliverables:**
- [ ] WCAG AA compliance
- [ ] Polished loading/empty states
- [ ] Crash reporting integrated
- [ ] Performance baseline established
- [ ] User documentation complete

---

## Architecture Improvements

### Recommended Refactors

#### 1. State Machine for Recording Flow
Replace string states with XState machine for:
- Type-safe transitions
- Side effect management
- Visualization/debugging
- Guard conditions

```typescript
// Current: store.setState('RECORDING')
// Proposed: recordingMachine.send('START_RECORDING')
```

#### 2. Service Layer Abstraction
```typescript
// Create unified service interface
interface RecordingService {
  startRecording(config: RecordingConfig): Promise<void>;
  stopRecording(): Promise<RecordingResult>;
  saveRecording(data: RecordingData): Promise<Recording>;
  uploadRecording(id: string): Promise<UploadResult>;
}
```

#### 3. Error Handling Strategy
```typescript
// Create custom error types
class NetworkError extends AppError { ... }
class ValidationError extends AppError { ... }
class StorageError extends AppError { ... }

// Centralized error handler
function handleError(error: AppError): void {
  LoggingService.error(error);
  showUserFriendlyMessage(error);
  if (error.shouldReport) {
    reportToSentry(error);
  }
}
```

#### 4. Dependency Injection
- Abstract database operations
- Mock services for testing
- Environment-specific implementations

---

## New Feature Proposals

### High Value Features

| Feature | Effort | Impact | Priority |
|---------|--------|--------|----------|
| Background recording | High | High | P1 |
| Batch recording mode | Medium | High | P1 |
| Sound event detection | High | High | P2 |
| Multi-user projects | High | Medium | P2 |
| Recording templates | Low | Medium | P2 |
| Real-time collaboration | Very High | Medium | P3 |

### Background Recording
```typescript
// Use expo-task-manager for background audio
import * as TaskManager from 'expo-task-manager';

TaskManager.defineTask('BACKGROUND_RECORDING', async () => {
  // Continue recording when app backgrounded
  // Show persistent notification
  // Handle system interruptions
});
```

### Batch Recording Mode
- Queue multiple recording configurations
- Auto-start next recording after save
- Summary view of batch results
- Bulk upload option

---

## Testing Strategy

### Test Pyramid

```
           /\
          /  \  E2E Tests (10%)
         /----\  - Critical user flows
        /      \  - Recording + Upload
       /--------\  Integration Tests (30%)
      /          \  - Database operations
     /            \  - Audio processing
    /--------------\  Unit Tests (60%)
   /                \  - Utilities
  /                  \  - Hooks
 /--------------------\  - Components
```

### Priority Test Cases

1. **Recording Flow**
   - Start/stop recording
   - Quality flag detection
   - Audio file creation
   - Metadata capture

2. **Database Operations**
   - CRUD for recordings
   - Migration execution
   - Query performance

3. **Sync System**
   - Upload queue management
   - Retry logic
   - Conflict handling

4. **Perception Input**
   - Circumplex calculations
   - PAQ mapping
   - Value persistence

---

## Success Metrics

| Metric | Current | Target | Timeline |
|--------|---------|--------|----------|
| Test coverage | ~5% | 60% | Week 4 |
| Crash-free sessions | Unknown | 99.5% | Week 6 |
| Upload success rate | Unknown | 95% | Week 4 |
| App startup time | ~2s | <1.5s | Week 4 |
| Memory usage (recording) | Unknown | <200MB | Week 4 |
| User rating | N/A | 4.5+ stars | Week 8 |

---

## Resource Estimates

### Development Time

| Phase | Duration | Focus |
|-------|----------|-------|
| Phase 1: Stability | 2 weeks | Bugs, testing |
| Phase 2: Security | 2 weeks | Encryption, performance |
| Phase 3: Features | 2 weeks | Complete features |
| Phase 4: Polish | 2 weeks | Accessibility, docs |
| **Total** | **8 weeks** | |

### Additional Resources Needed

- [ ] UI/UX designer for accessibility audit
- [ ] Security review (encryption implementation)
- [ ] QA testing (device matrix)
- [ ] User testing (perception input validation)

---

## Appendix

### A. File Inventory

**Components:** 45 files
**Services:** 12 files
**Hooks:** 8 files
**Stores:** 6 files
**Utils:** 10 files
**Types:** 2 files
**Tests:** 4 files

### B. Dependency Audit

**Production dependencies:** 45+
**Key dependencies to monitor:**
- expo: 54.x (major updates yearly)
- react-native: 0.81.x (frequent updates)
- react-native-audio-api: experimental
- supabase-js: 2.x (stable)

### C. Database Schema Summary

```
recordings (26 columns)
  └── perceptions (12 columns, FK)
upload_queue (5 columns)
```

### D. Recording States

```
IDLE → PROTOCOL → COUNTDOWN → RECORDING → REVIEW →
PHOTO_CAPTURE → CIRCUMPLEX → CONTEXT → SAVING → IDLE
```

---

*Generated: 2026-03-07*
*Version: 1.0*
