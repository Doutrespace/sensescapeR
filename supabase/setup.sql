-- ============================================================================
-- Sensescape Explorer: central database for the course (Supabase / PostgreSQL)
-- ============================================================================
--
-- STATUS: run on the course project on 2026-11-24 (existing measurements
-- kept; a test upload from the app checked the result). Running it again is
-- safe.
--
-- What it sets up
--   * recordings / perceptions: one row per measurement, written by the app.
--     `participant_id`, `group_id`, `study_data` and `export_row` carry the
--     study variables; `export_row` is the same flat record the CSV export
--     writes, so the complete data table can be read from this one column.
--   * Row level security: everybody sees only their own uploads, plus the
--     measurements their owner published to the community map.
--   * Column access: the study variables are never readable through the
--     public API, not even for community measurements.
--   * A private storage bucket for sound files, photos and spectrograms.
--
-- Steps
--   1. Supabase dashboard > SQL editor: run this whole file.
--   2. Authentication > Sign In / Providers: switch on "Allow anonymous
--      sign-ins". Students then upload without creating an account. Each
--      phone signs in once; the default limit of 30 anonymous sign-ins per
--      hour and IP address (Authentication > Rate Limits) is enough for a
--      class on one Wi-Fi. Anybody with the link can upload, so a CAPTCHA
--      (Attack Protection) is worth adding if junk data shows up.
--   3. GitHub repository > Settings > Secrets and variables > Actions: set
--      EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY the way the
--      deploy workflow expects them, then publish the site again.
--
-- Getting the data out
--   SQL editor:  select export_row from public.recordings order by recorded_at;
--   Download the result (CSV or JSON) and convert it into the study table:
--     node scripts/merge-exports.mjs downloaded-file.csv -o all.csv
--   Sound files and photos are in Storage > soundscapes, named by run id:
--     recordings/<run_id>.wav, photos/<run_id>.jpg
--
-- The file can be run again at any time; it only adds what is missing.
-- ============================================================================

create schema if not exists extensions;
create extension if not exists postgis with schema extensions;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.recordings (
  id uuid primary key default gen_random_uuid(),
  audio_path text not null,
  recorded_at timestamptz not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.recordings
  add column if not exists photo_path text,
  add column if not exists spectrogram_path text,
  add column if not exists sample_rate integer,
  add column if not exists bit_depth integer,
  add column if not exists duration_ms integer,
  add column if not exists device_model text,
  add column if not exists os_version text,
  add column if not exists mic_route text,
  add column if not exists timezone text,
  add column if not exists latitude double precision,
  add column if not exists longitude double precision,
  -- Unqualified: PostGIS lives in `extensions` on new projects and in
  -- `public` on older ones; the SQL editor searches both.
  add column if not exists location geography(point),
  add column if not exists gps_accuracy real,
  add column if not exists privacy_mode text default 'exact',
  add column if not exists protocol_type text default 'opportunistic',
  add column if not exists project_id uuid,
  add column if not exists has_clipping boolean default false,
  add column if not exists has_wind_handling boolean default false,
  add column if not exists has_low_snr boolean default false,
  add column if not exists peak_db real,
  add column if not exists rms_db real,
  add column if not exists normalization_applied boolean default false,
  add column if not exists normalization_gain double precision,
  add column if not exists habitat_type text,
  add column if not exists setting_chips jsonb,
  add column if not exists source_dominance jsonb,
  add column if not exists field_notes text,
  add column if not exists spoken_description text,
  add column if not exists photo_classification jsonb,
  add column if not exists visual_context jsonb,
  add column if not exists note_themes jsonb,
  add column if not exists detected_sounds jsonb,
  add column if not exists multisensory jsonb,
  add column if not exists license text,
  add column if not exists community_visibility text default 'private',
  -- ID of the measurement on the device (the `run_id` of the CSV export)
  add column if not exists local_id text,
  add column if not exists user_id uuid references auth.users(id) on delete set null,
  -- Study variables
  add column if not exists participant_id text,
  add column if not exists group_id text,
  add column if not exists study_data jsonb,
  add column if not exists export_row jsonb;

create index if not exists recordings_recorded_at_idx on public.recordings (recorded_at);
create index if not exists recordings_participant_idx on public.recordings (participant_id);
create index if not exists recordings_group_idx on public.recordings (group_id);
create index if not exists recordings_local_id_idx on public.recordings (user_id, local_id);

create table if not exists public.perceptions (
  id uuid primary key default gen_random_uuid(),
  recording_id uuid not null references public.recordings(id) on delete cascade,
  iso_pleasant real,
  iso_eventful real,
  paq_pleasant integer,
  paq_vibrant integer,
  paq_eventful integer,
  paq_chaotic integer,
  paq_annoying integer,
  paq_monotonous integer,
  paq_uneventful integer,
  paq_calm integer,
  created_at timestamptz default now()
);

create index if not exists perceptions_recording_id_idx on public.perceptions (recording_id);

create table if not exists public.research_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  age_range text,
  gender text,
  occupation text,
  living_area text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table public.recordings enable row level security;
alter table public.perceptions enable row level security;
alter table public.research_profiles enable row level security;

-- Start from a clean slate. Earlier setups created policies under other
-- names (e.g. "Recordings are viewable by everyone"), and policies only ever
-- add access: any one left behind would stay in force.
do $$
declare
  p record;
begin
  for p in
    select policyname, tablename from pg_policies
    where schemaname = 'public'
      and tablename in ('recordings', 'perceptions', 'research_profiles')
  loop
    execute format('drop policy %I on public.%I', p.policyname, p.tablename);
  end loop;
end $$;

create policy "recordings_select_own" on public.recordings
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "recordings_select_community" on public.recordings
  for select to anon, authenticated using (community_visibility = 'community');
create policy "recordings_insert_own" on public.recordings
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "recordings_update_own" on public.recordings
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "recordings_delete_own" on public.recordings
  for delete to authenticated using ((select auth.uid()) = user_id);

create policy "perceptions_select_own" on public.perceptions
  for select to authenticated using (exists (
    select 1 from public.recordings r
    where r.id = perceptions.recording_id and r.user_id = (select auth.uid())
  ));
create policy "perceptions_select_community" on public.perceptions
  for select to anon, authenticated using (exists (
    select 1 from public.recordings r
    where r.id = perceptions.recording_id and r.community_visibility = 'community'
  ));
create policy "perceptions_insert_own" on public.perceptions
  for insert to authenticated with check (exists (
    select 1 from public.recordings r
    where r.id = perceptions.recording_id and r.user_id = (select auth.uid())
  ));
create policy "perceptions_update_own" on public.perceptions
  for update to authenticated
  using (exists (
    select 1 from public.recordings r
    where r.id = perceptions.recording_id and r.user_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.recordings r
    where r.id = perceptions.recording_id and r.user_id = (select auth.uid())
  ));
create policy "perceptions_delete_own" on public.perceptions
  for delete to authenticated using (exists (
    select 1 from public.recordings r
    where r.id = perceptions.recording_id and r.user_id = (select auth.uid())
  ));

create policy "research_profiles_select_own" on public.research_profiles
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "research_profiles_insert_own" on public.research_profiles
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "research_profiles_update_own" on public.research_profiles
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "research_profiles_delete_own" on public.research_profiles
  for delete to authenticated using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- Column access
-- ---------------------------------------------------------------------------
-- Measurements shared on the community map can be read by anybody with the
-- app's public key. The study variables (personal details and answers) must
-- never be: they can be read in the dashboard (SQL editor, table editor) or
-- with the service key only. Columns added later are hidden until granted.

revoke select on public.recordings from anon, authenticated;
grant select (
  id, audio_path, recorded_at, created_at, updated_at, photo_path,
  spectrogram_path, sample_rate, bit_depth, duration_ms, device_model,
  os_version, mic_route, timezone, latitude, longitude, location,
  gps_accuracy, privacy_mode, protocol_type, project_id, has_clipping,
  has_wind_handling, has_low_snr, peak_db, rms_db, normalization_applied,
  normalization_gain, habitat_type, setting_chips, source_dominance,
  field_notes, spoken_description, photo_classification, visual_context,
  note_themes, detected_sounds, multisensory, license,
  community_visibility, local_id, user_id
) on public.recordings to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Storage: sound files, photos, spectrograms
-- ---------------------------------------------------------------------------
-- The earlier policies let every visitor read, and every signed-in user
-- overwrite or delete, ALL files in the bucket. Recordings can contain
-- voices and photos can show people, so access is limited here to the person
-- who uploaded a file, plus read access to files of published measurements.

insert into storage.buckets (id, name, public)
values ('soundscapes', 'soundscapes', false)
on conflict (id) do update set public = false;

drop policy if exists "soundscapes_select_all" on storage.objects;
drop policy if exists "soundscapes_insert_authenticated" on storage.objects;
drop policy if exists "soundscapes_update_authenticated" on storage.objects;
drop policy if exists "soundscapes_delete_authenticated" on storage.objects;
drop policy if exists "soundscapes_select_own_or_community" on storage.objects;
drop policy if exists "soundscapes_update_own" on storage.objects;
drop policy if exists "soundscapes_delete_own" on storage.objects;

create policy "soundscapes_insert_authenticated" on storage.objects
  for insert to authenticated with check (bucket_id = 'soundscapes');

create policy "soundscapes_select_own_or_community" on storage.objects
  for select to anon, authenticated using (
    bucket_id = 'soundscapes'
    and (
      owner_id = (select auth.uid())::text
      or exists (
        select 1 from public.recordings r
        where r.community_visibility = 'community'
          and storage.objects.name in (r.audio_path, r.photo_path, r.spectrogram_path)
      )
    )
  );

create policy "soundscapes_update_own" on storage.objects
  for update to authenticated
  using (bucket_id = 'soundscapes' and owner_id = (select auth.uid())::text)
  with check (bucket_id = 'soundscapes' and owner_id = (select auth.uid())::text);

create policy "soundscapes_delete_own" on storage.objects
  for delete to authenticated
  using (bucket_id = 'soundscapes' and owner_id = (select auth.uid())::text);
