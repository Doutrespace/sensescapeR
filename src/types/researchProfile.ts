export interface ResearchProfile {
  ageRange?: string;
  gender?: string;
  occupation?: string;
  livingArea?: string;
}

export const AGE_RANGE_OPTIONS = [
  'Under 18',
  '18-24',
  '25-34',
  '35-44',
  '45-54',
  '55-64',
  '65+',
] as const;

export const GENDER_OPTIONS = [
  'Female',
  'Male',
  'Non-binary',
  'Prefer not to say',
] as const;

export const LIVING_AREA_OPTIONS = [
  'Urban',
  'Suburban',
  'Rural',
  'Prefer not to say',
] as const;

export function normalizeResearchProfile(
  value: unknown
): ResearchProfile {
  if (!value || typeof value !== 'object') {
    return {};
  }

  const source = value as Record<string, unknown>;
  return {
    ageRange: typeof source.ageRange === 'string' ? source.ageRange : undefined,
    gender: typeof source.gender === 'string' ? source.gender : undefined,
    occupation: typeof source.occupation === 'string' ? source.occupation : undefined,
    livingArea: typeof source.livingArea === 'string' ? source.livingArea : undefined,
  };
}

export function hasResearchProfileData(profile: ResearchProfile): boolean {
  return Boolean(
    profile.ageRange ||
    profile.gender ||
    profile.occupation ||
    profile.livingArea
  );
}
