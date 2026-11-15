import { supabase, isSupabaseConfigured } from '../../utils/supabase';
import {
  hasResearchProfileData,
  normalizeResearchProfile,
  type ResearchProfile,
} from '../../types/researchProfile';

function toDatabasePayload(profile: ResearchProfile) {
  return {
    age_range: profile.ageRange ?? null,
    gender: profile.gender ?? null,
    occupation: profile.occupation ?? null,
    living_area: profile.livingArea ?? null,
  };
}

function fromDatabaseRow(row: Record<string, unknown> | null | undefined): ResearchProfile {
  if (!row) {
    return {};
  }

  return normalizeResearchProfile({
    ageRange: row.age_range,
    gender: row.gender,
    occupation: row.occupation,
    livingArea: row.living_area,
  });
}

export async function syncActiveResearchProfile(profile: ResearchProfile): Promise<{ error?: string }> {
  if (!isSupabaseConfigured) {
    return {};
  }

  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError) {
    return { error: sessionError.message };
  }

  const userId = session?.user?.id;
  if (!userId) {
    return {};
  }

  if (!hasResearchProfileData(profile)) {
    const { error } = await supabase
      .from('research_profiles')
      .delete()
      .eq('user_id', userId);

    return error ? { error: error.message } : {};
  }

  const { error } = await supabase
    .from('research_profiles')
    .upsert(
      {
        user_id: userId,
        ...toDatabasePayload(profile),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    );

  return error ? { error: error.message } : {};
}

export async function getActiveResearchProfile(): Promise<ResearchProfile> {
  if (!isSupabaseConfigured) {
    return {};
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const metadataProfile = normalizeResearchProfile(user?.user_metadata?.research_profile);
  if (!user?.id) {
    return metadataProfile;
  }

  const { data, error } = await supabase
    .from('research_profiles')
    .select('age_range, gender, occupation, living_area')
    .eq('user_id', user.id)
    .maybeSingle();

  if (error) {
    return metadataProfile;
  }

  const tableProfile = fromDatabaseRow(data as Record<string, unknown> | null | undefined);
  return hasResearchProfileData(tableProfile) ? tableProfile : metadataProfile;
}
