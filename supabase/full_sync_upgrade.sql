create schema if not exists extensions;
create extension if not exists postgis with schema extensions;

create table if not exists public.research_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  age_range text,
  gender text,
  occupation text,
  living_area text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.recordings
  add column if not exists photo_path text,
  add column if not exists spectrogram_path text,
  add column if not exists field_notes text,
  add column if not exists spoken_description text,
  add column if not exists photo_classification jsonb,
  add column if not exists detected_sounds jsonb,
  add column if not exists latitude double precision,
  add column if not exists longitude double precision,
  add column if not exists community_visibility text default 'private',
  add column if not exists normalization_applied boolean default false,
  add column if not exists normalization_gain double precision,
  add column if not exists visual_context jsonb,
  add column if not exists note_themes jsonb,
  -- Multisensory assessment (visual, smell, thermal, restorativeness,
  -- emotion, environmental qualities); see src/types/multisensory.ts
  add column if not exists multisensory jsonb;

update public.recordings
set
  latitude = coalesce(latitude, st_y(location::geometry)),
  longitude = coalesce(longitude, st_x(location::geometry)),
  community_visibility = coalesce(community_visibility, 'private')
where location is not null
   or community_visibility is null;

alter table public.recordings enable row level security;
alter table public.perceptions enable row level security;
alter table public.research_profiles enable row level security;

drop policy if exists "recordings_select_all" on public.recordings;
drop policy if exists "recordings_insert_authenticated" on public.recordings;
drop policy if exists "recordings_delete_authenticated" on public.recordings;
drop policy if exists "perceptions_select_all" on public.perceptions;
drop policy if exists "perceptions_insert_authenticated" on public.perceptions;
drop policy if exists "perceptions_delete_authenticated" on public.perceptions;
drop policy if exists "recordings_select_own" on public.recordings;
drop policy if exists "recordings_select_community" on public.recordings;
drop policy if exists "recordings_insert_own" on public.recordings;
drop policy if exists "recordings_update_own" on public.recordings;
drop policy if exists "recordings_delete_own" on public.recordings;
drop policy if exists "perceptions_select_own" on public.perceptions;
drop policy if exists "perceptions_select_community" on public.perceptions;
drop policy if exists "perceptions_insert_own" on public.perceptions;
drop policy if exists "perceptions_update_own" on public.perceptions;
drop policy if exists "perceptions_delete_own" on public.perceptions;
drop policy if exists "research_profiles_select_own" on public.research_profiles;
drop policy if exists "research_profiles_insert_own" on public.research_profiles;
drop policy if exists "research_profiles_update_own" on public.research_profiles;
drop policy if exists "research_profiles_delete_own" on public.research_profiles;

create policy "recordings_select_own"
on public.recordings
for select
to authenticated
using (auth.uid() = user_id);

create policy "recordings_select_community"
on public.recordings
for select
to anon, authenticated
using (community_visibility = 'community');

create policy "recordings_insert_own"
on public.recordings
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "recordings_update_own"
on public.recordings
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "recordings_delete_own"
on public.recordings
for delete
to authenticated
using (auth.uid() = user_id);

create policy "perceptions_select_own"
on public.perceptions
for select
to authenticated
using (
  exists (
    select 1
    from public.recordings r
    where r.id = perceptions.recording_id
      and r.user_id = auth.uid()
  )
);

create policy "perceptions_select_community"
on public.perceptions
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.recordings r
    where r.id = perceptions.recording_id
      and r.community_visibility = 'community'
  )
);

create policy "perceptions_insert_own"
on public.perceptions
for insert
to authenticated
with check (
  exists (
    select 1
    from public.recordings r
    where r.id = perceptions.recording_id
      and r.user_id = auth.uid()
  )
);

create policy "perceptions_update_own"
on public.perceptions
for update
to authenticated
using (
  exists (
    select 1
    from public.recordings r
    where r.id = perceptions.recording_id
      and r.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.recordings r
    where r.id = perceptions.recording_id
      and r.user_id = auth.uid()
  )
);

create policy "perceptions_delete_own"
on public.perceptions
for delete
to authenticated
using (
  exists (
    select 1
    from public.recordings r
    where r.id = perceptions.recording_id
      and r.user_id = auth.uid()
  )
);

create policy "research_profiles_select_own"
on public.research_profiles
for select
to authenticated
using (auth.uid() = user_id);

create policy "research_profiles_insert_own"
on public.research_profiles
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "research_profiles_update_own"
on public.research_profiles
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "research_profiles_delete_own"
on public.research_profiles
for delete
to authenticated
using (auth.uid() = user_id);

insert into storage.buckets (id, name, public)
values ('soundscapes', 'soundscapes', false)
on conflict (id) do nothing;

drop policy if exists "soundscapes_select_all" on storage.objects;
drop policy if exists "soundscapes_insert_authenticated" on storage.objects;
drop policy if exists "soundscapes_update_authenticated" on storage.objects;
drop policy if exists "soundscapes_delete_authenticated" on storage.objects;

create policy "soundscapes_select_all"
on storage.objects
for select
using (bucket_id = 'soundscapes');

create policy "soundscapes_insert_authenticated"
on storage.objects
for insert
to authenticated
with check (bucket_id = 'soundscapes');

create policy "soundscapes_update_authenticated"
on storage.objects
for update
to authenticated
using (bucket_id = 'soundscapes')
with check (bucket_id = 'soundscapes');

create policy "soundscapes_delete_authenticated"
on storage.objects
for delete
to authenticated
using (bucket_id = 'soundscapes');

-- ============================================================
-- Clears the "RLS Disabled in Public" lint on an EXISTING DB where
-- PostGIS was previously installed into public (it cannot be moved:
-- PostGIS does not support ALTER EXTENSION ... SET SCHEMA).
-- Removes spatial_ref_sys from the PostgREST API surface. The app never
-- queries it (uses recordings.latitude/longitude columns directly).
-- May error "must be owner of table spatial_ref_sys" depending on role;
-- that is harmless — the table holds only public projection reference data
-- and writes are already blocked. Run this line on its own to check.
-- ============================================================
revoke all on table public.spatial_ref_sys from anon, authenticated;
