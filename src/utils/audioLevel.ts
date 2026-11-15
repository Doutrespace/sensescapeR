const DB_MIN = -60;
const DB_MAX = 0;
const CLIP_THRESHOLD_DB = -3;
const LOW_LEVEL_THRESHOLD_DB = -40;

export type AudioLevelTone = 'low' | 'good' | 'hot';

export interface FormattedAudioLevel {
  percent: number;
  normalized: number;
  dbfs: number;
  tone: AudioLevelTone;
  label: string;
}

export function formatAudioLevel(dbfs: number): FormattedAudioLevel {
  const normalized = Math.max(0, Math.min(1, (dbfs - DB_MIN) / (DB_MAX - DB_MIN)));
  const percent = Math.round(normalized * 100);

  if (dbfs >= CLIP_THRESHOLD_DB) {
    return {
      percent,
      normalized,
      dbfs,
      tone: 'hot',
      label: 'Near clipping',
    };
  }

  if (dbfs <= LOW_LEVEL_THRESHOLD_DB) {
    return {
      percent,
      normalized,
      dbfs,
      tone: 'low',
      label: 'Low level',
    };
  }

  return {
    percent,
    normalized,
    dbfs,
    tone: 'good',
    label: 'Usable level',
  };
}

export function formatDbfs(dbfs: number): string {
  const clamped = Math.max(DB_MIN, Math.min(DB_MAX, dbfs));
  return `${clamped.toFixed(1)} dBFS`;
}
