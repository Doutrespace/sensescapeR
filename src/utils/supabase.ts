import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Linking from 'expo-linking';
import { Platform } from 'react-native';
import { createClient } from '@supabase/supabase-js';

// ============================================================
// SUPABASE CONFIGURATION
// ============================================================
// Configure via environment variables:
// 1. Create a Supabase project at https://supabase.com
// 2. Create a .env file with:
//    EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
//    EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
// ============================================================

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

// Check if Supabase is configured
export const isSupabaseConfigured = !!(SUPABASE_URL && SUPABASE_ANON_KEY);
export const AUTH_CONFIRM_PATH = 'auth/confirm';

export function getSupabaseEmailRedirectUrl(): string {
  return Linking.createURL(AUTH_CONFIRM_PATH);
}

// Provide a dummy URL and key so the client creation doesn't crash on init
const url = SUPABASE_URL || 'https://placeholder.supabase.co';
const key = SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.placeholder.signature';

export const supabase = createClient(url, key, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    // On web the email-confirmation link lands on this page with the session in the URL.
    detectSessionInUrl: Platform.OS === 'web',
  },
});

// ============================================================
// SUPABASE SCHEMA
// ============================================================
// Run this SQL in your Supabase SQL editor to create the required tables:
/*

-- Enable PostGIS extension for location data
CREATE EXTENSION IF NOT EXISTS postgis;

-- Recordings table
CREATE TABLE recordings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  audio_path TEXT NOT NULL,
  sample_rate INTEGER DEFAULT 44100,
  bit_depth INTEGER DEFAULT 16,
  duration_ms INTEGER DEFAULT 0,
  device_model TEXT,
  os_version TEXT,
  mic_route TEXT,
  recorded_at TIMESTAMPTZ NOT NULL,
  timezone TEXT,
  location GEOGRAPHY(POINT),
  gps_accuracy REAL,
  privacy_mode TEXT DEFAULT 'exact',
  protocol_type TEXT DEFAULT 'opportunistic',
  project_id UUID,
  has_clipping BOOLEAN DEFAULT FALSE,
  has_wind_handling BOOLEAN DEFAULT FALSE,
  has_low_snr BOOLEAN DEFAULT FALSE,
  peak_db REAL,
  rms_db REAL,
  habitat_type TEXT,
  setting_chips JSONB,
  source_dominance JSONB,
  license TEXT,
  local_id TEXT,
  user_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Perceptions table
CREATE TABLE perceptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  recording_id UUID NOT NULL REFERENCES recordings(id) ON DELETE CASCADE,
  iso_pleasant REAL,
  iso_eventful REAL,
  paq_pleasant INTEGER,
  paq_vibrant INTEGER,
  paq_eventful INTEGER,
  paq_chaotic INTEGER,
  paq_annoying INTEGER,
  paq_monotonous INTEGER,
  paq_uneventful INTEGER,
  paq_calm INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_recordings_location ON recordings USING GIST (location);
CREATE INDEX idx_recordings_recorded_at ON recordings (recorded_at);
CREATE INDEX idx_perceptions_recording_id ON perceptions (recording_id);

-- Row Level Security
ALTER TABLE recordings ENABLE ROW LEVEL SECURITY;
ALTER TABLE perceptions ENABLE ROW LEVEL SECURITY;

-- Policies (adjust based on your auth requirements)
CREATE POLICY "Recordings are viewable by everyone" ON recordings
  FOR SELECT USING (true);

CREATE POLICY "Recordings are insertable by authenticated users" ON recordings
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Perceptions are viewable by everyone" ON perceptions
  FOR SELECT USING (true);

CREATE POLICY "Perceptions are insertable by authenticated users" ON perceptions
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Storage bucket (run in Supabase Dashboard > Storage)
-- Create a bucket called 'soundscapes' with public access

*/
