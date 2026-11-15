import { create } from 'zustand';
import { supabase, isSupabaseConfigured } from '../utils/supabase';
import { LoggingService } from '../services/logging';
import type { ImageClassification } from '../utils/imageClassification';
import type { VisualContextAssessment } from '../utils/visualContext';

interface CommunityPerception {
  isoPleasant: number | null;
  isoEventful: number | null;
  paqPleasant: number | null;
  paqVibrant: number | null;
  paqEventful: number | null;
  paqChaotic: number | null;
  paqAnnoying: number | null;
  paqMonotonous: number | null;
  paqUneventful: number | null;
  paqCalm: number | null;
}

export interface CommunityRecording {
  id: string;
  photoPath: string | null;
  spectrogramPath: string | null;
  sampleRate: number;
  bitDepth: number;
  deviceModel: string;
  osVersion: string;
  micRoute: string;
  latitude: number;
  longitude: number;
  recordedAt: string;
  timezone: string;
  habitatType: string | null;
  protocolType: string;
  durationMs: number;
  privacyMode: string | null;
  gpsAccuracy: number | null;
  audioPath: string | null;
  fieldNotes: string | null;
  spokenDescription: string | null;
  detectedSounds: Array<any>;
  photoClassification: ImageClassification[];
  visualContext: VisualContextAssessment | null;
  noteThemes: Array<any>;
  perception: CommunityPerception | null;
}

interface LatLngBounds {
  northeast: { latitude: number; longitude: number };
  southwest: { latitude: number; longitude: number };
}

interface ExploreStoreState {
  recordings: CommunityRecording[];
  isLoading: boolean;
  error: string | null;
  selectedRecording: CommunityRecording | null;
  lastFetchBounds: LatLngBounds | null;

  fetchRecordingsInBounds: (bounds: LatLngBounds) => Promise<void>;
  selectRecording: (recording: CommunityRecording | null) => void;
  clearError: () => void;
}

export const useExploreStore = create<ExploreStoreState>((set, get) => ({
  recordings: [],
  isLoading: false,
  error: null,
  selectedRecording: null,
  lastFetchBounds: null,

  fetchRecordingsInBounds: async (bounds) => {
    if (!isSupabaseConfigured) {
      set({ error: 'Cloud sync not configured', isLoading: false });
      return;
    }

    // Skip if bounds haven't changed significantly
    const lastBounds = get().lastFetchBounds;
    if (lastBounds && boundsAreSimilar(lastBounds, bounds)) {
      return;
    }

    set({ isLoading: true, error: null });

    try {
      // Query recordings within the bounding box
      // Note: This assumes PostGIS is set up with a location column
      // For simpler queries without PostGIS, we use lat/lng columns directly
      const { data, error } = await supabase
        .from('recordings')
        .select(`
          id,
          audio_path,
          photo_path,
          spectrogram_path,
          sample_rate,
          bit_depth,
          device_model,
          os_version,
          mic_route,
          latitude,
          longitude,
          recorded_at,
          timezone,
          habitat_type,
          protocol_type,
          duration_ms,
          privacy_mode,
          gps_accuracy,
          field_notes,
          spoken_description,
          detected_sounds,
          photo_classification,
          visual_context,
          note_themes,
          perceptions (
            iso_pleasant,
            iso_eventful,
            paq_pleasant,
            paq_vibrant,
            paq_eventful,
            paq_chaotic,
            paq_annoying,
            paq_monotonous,
            paq_uneventful,
            paq_calm
          )
        `)
        .eq('community_visibility', 'community')
        .gte('latitude', bounds.southwest.latitude)
        .lte('latitude', bounds.northeast.latitude)
        .gte('longitude', bounds.southwest.longitude)
        .lte('longitude', bounds.northeast.longitude)
        .limit(100);

      if (error) {
        // Fallback: check whether recordings exist at all, but don't fabricate map coordinates.
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('recordings')
          .select(`
            id,
            recorded_at,
            habitat_type,
            protocol_type,
            duration_ms
          `)
          .eq('community_visibility', 'community')
          .limit(50);

        if (fallbackError) {
          throw fallbackError;
        }

        set({
          recordings: [],
          isLoading: false,
          lastFetchBounds: bounds,
          error: (fallbackData?.length ?? 0) > 0
            ? 'Community recordings are available, but their map coordinates could not be loaded from the backend.'
            : null,
        });
        return;
      }

      const recordings: CommunityRecording[] = (data || [])
        .filter((r: any) => typeof r.latitude === 'number' && typeof r.longitude === 'number')
        .map((r: any) => ({
          id: r.id,
          audioPath: r.audio_path ?? null,
          photoPath: r.photo_path ?? null,
          spectrogramPath: r.spectrogram_path ?? null,
          sampleRate: typeof r.sample_rate === 'number' ? r.sample_rate : 0,
          bitDepth: typeof r.bit_depth === 'number' ? r.bit_depth : 0,
          deviceModel: r.device_model ?? 'Unknown device',
          osVersion: r.os_version ?? 'Unknown OS',
          micRoute: r.mic_route ?? 'Unknown route',
          latitude: r.latitude,
          longitude: r.longitude,
          recordedAt: r.recorded_at,
          timezone: r.timezone ?? 'UTC',
          habitatType: r.habitat_type,
          protocolType: r.protocol_type,
          durationMs: r.duration_ms,
          privacyMode: r.privacy_mode ?? null,
          gpsAccuracy: typeof r.gps_accuracy === 'number' ? r.gps_accuracy : null,
          fieldNotes: r.field_notes ?? null,
          spokenDescription: r.spoken_description ?? null,
          detectedSounds: coerceJsonArray(r.detected_sounds),
          photoClassification: coerceImageClassifications(r.photo_classification),
          visualContext: coerceVisualContext(r.visual_context),
          noteThemes: coerceJsonArray(r.note_themes),
          perception: r.perceptions?.[0]
            ? {
                isoPleasant: r.perceptions[0].iso_pleasant ?? null,
                isoEventful: r.perceptions[0].iso_eventful ?? null,
                paqPleasant: r.perceptions[0].paq_pleasant ?? null,
                paqVibrant: r.perceptions[0].paq_vibrant ?? null,
                paqEventful: r.perceptions[0].paq_eventful ?? null,
                paqChaotic: r.perceptions[0].paq_chaotic ?? null,
                paqAnnoying: r.perceptions[0].paq_annoying ?? null,
                paqMonotonous: r.perceptions[0].paq_monotonous ?? null,
                paqUneventful: r.perceptions[0].paq_uneventful ?? null,
                paqCalm: r.perceptions[0].paq_calm ?? null,
              }
            : null,
        }));

      set({
        recordings,
        isLoading: false,
        lastFetchBounds: bounds,
      });
    } catch (error: any) {
      LoggingService.warn('Failed to fetch community recordings', {
        error: error?.message ?? String(error),
      });
      set({
        error: error.message || 'Failed to fetch recordings',
        isLoading: false,
      });
    }
  },

  selectRecording: (recording) => set({ selectedRecording: recording }),

  clearError: () => set({ error: null }),
}));

// Helper to check if bounds are similar (to avoid refetching)
function boundsAreSimilar(a: LatLngBounds, b: LatLngBounds): boolean {
  const threshold = 0.01; // About 1km at equator
  return (
    Math.abs(a.northeast.latitude - b.northeast.latitude) < threshold &&
    Math.abs(a.northeast.longitude - b.northeast.longitude) < threshold &&
    Math.abs(a.southwest.latitude - b.southwest.latitude) < threshold &&
    Math.abs(a.southwest.longitude - b.southwest.longitude) < threshold
  );
}

function coerceJsonArray(value: unknown): any[] {
  if (Array.isArray(value)) {
    return value;
  }

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  return [];
}

function coerceImageClassifications(value: unknown): ImageClassification[] {
  return coerceJsonArray(value) as ImageClassification[];
}

function coerceVisualContext(value: unknown): VisualContextAssessment | null {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as VisualContextAssessment;
  }

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? parsed as VisualContextAssessment
        : null;
    } catch {
      return null;
    }
  }

  return null;
}
