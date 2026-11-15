import { getDatabase } from './index';
import { Perception, CircumplexPerception, PAQPerception } from '../../types/recording';

const COS_45 = Math.cos(Math.PI / 4);

function generateId(): string {
  return `perc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function clampUnit(value: number): number {
  return Math.max(-1, Math.min(1, value));
}

function clampLikert(value: number): number {
  return Math.max(1, Math.min(5, Math.round(value)));
}

function toLikert(value: number): number {
  return clampLikert(((clampUnit(value) + 1) * 2) + 1);
}

function resolvePaq(
  circumplex: CircumplexPerception,
  paq?: PAQPerception
): PAQPerception {
  return paq ?? calculatePAQFromCircumplex(circumplex);
}

// Create a perception for a recording
export async function createPerception(
  recordingId: string,
  circumplex: CircumplexPerception,
  paq?: PAQPerception
): Promise<Perception> {
  const db = await getDatabase();
  const now = new Date().toISOString();
  const id = generateId();
  const resolvedPaq = resolvePaq(circumplex, paq);

  const perception: Perception = {
    id,
    recordingId,
    isoPleasant: circumplex.pleasant,
    isoEventful: circumplex.eventful,
    paqPleasant: resolvedPaq.pleasant,
    paqVibrant: resolvedPaq.vibrant,
    paqEventful: resolvedPaq.eventful,
    paqChaotic: resolvedPaq.chaotic,
    paqAnnoying: resolvedPaq.annoying,
    paqMonotonous: resolvedPaq.monotonous,
    paqUneventful: resolvedPaq.uneventful,
    paqCalm: resolvedPaq.calm,
    createdAt: now,
  };

  await db.runAsync(
    `INSERT INTO perceptions (
      id, recording_id,
      iso_pleasant, iso_eventful,
      paq_pleasant, paq_vibrant, paq_eventful, paq_chaotic,
      paq_annoying, paq_monotonous, paq_uneventful, paq_calm,
      created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      perception.id,
      perception.recordingId,
      perception.isoPleasant,
      perception.isoEventful,
      perception.paqPleasant ?? null,
      perception.paqVibrant ?? null,
      perception.paqEventful ?? null,
      perception.paqChaotic ?? null,
      perception.paqAnnoying ?? null,
      perception.paqMonotonous ?? null,
      perception.paqUneventful ?? null,
      perception.paqCalm ?? null,
      perception.createdAt,
    ]
  );

  return perception;
}

// Get perception by recording ID
export async function getPerceptionByRecordingId(
  recordingId: string
): Promise<Perception | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<any>(
    'SELECT * FROM perceptions WHERE recording_id = ?',
    [recordingId]
  );

  return row ? mapRowToPerception(row) : null;
}

// Get perception by ID
export async function getPerception(id: string): Promise<Perception | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<any>(
    'SELECT * FROM perceptions WHERE id = ?',
    [id]
  );

  return row ? mapRowToPerception(row) : null;
}

// Update perception
export async function updatePerception(
  id: string,
  circumplex?: CircumplexPerception,
  paq?: PAQPerception
): Promise<void> {
  const db = await getDatabase();

  const fields: string[] = [];
  const values: any[] = [];

  if (circumplex) {
    fields.push('iso_pleasant = ?', 'iso_eventful = ?');
    values.push(circumplex.pleasant, circumplex.eventful);
  }

  const resolvedPaq = circumplex ? resolvePaq(circumplex, paq) : paq;

  if (resolvedPaq) {
    fields.push(
      'paq_pleasant = ?',
      'paq_vibrant = ?',
      'paq_eventful = ?',
      'paq_chaotic = ?',
      'paq_annoying = ?',
      'paq_monotonous = ?',
      'paq_uneventful = ?',
      'paq_calm = ?'
    );
    values.push(
      resolvedPaq.pleasant,
      resolvedPaq.vibrant,
      resolvedPaq.eventful,
      resolvedPaq.chaotic,
      resolvedPaq.annoying,
      resolvedPaq.monotonous,
      resolvedPaq.uneventful,
      resolvedPaq.calm
    );
  }

  if (fields.length === 0) return;

  values.push(id);
  await db.runAsync(
    `UPDATE perceptions SET ${fields.join(', ')} WHERE id = ?`,
    values
  );
}

// Delete perception
export async function deletePerception(id: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM perceptions WHERE id = ?', [id]);
}

// Delete perception by recording ID
export async function deletePerceptionByRecordingId(
  recordingId: string
): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM perceptions WHERE recording_id = ?', [recordingId]);
}

// Helper to map DB row to Perception type
function mapRowToPerception(row: any): Perception {
  return {
    id: row.id,
    recordingId: row.recording_id,
    isoPleasant: row.iso_pleasant,
    isoEventful: row.iso_eventful,
    paqPleasant: row.paq_pleasant,
    paqVibrant: row.paq_vibrant,
    paqEventful: row.paq_eventful,
    paqChaotic: row.paq_chaotic,
    paqAnnoying: row.paq_annoying,
    paqMonotonous: row.paq_monotonous,
    paqUneventful: row.paq_uneventful,
    paqCalm: row.paq_calm,
    createdAt: row.created_at,
  };
}

export function calculatePAQFromCircumplex(
  circumplex: CircumplexPerception
): PAQPerception;
export function calculatePAQFromCircumplex(
  pleasant: number,
  eventful: number
): PAQPerception;
export function calculatePAQFromCircumplex(
  pleasantOrCircumplex: CircumplexPerception | number,
  eventfulArg?: number
): PAQPerception {
  const pleasant = typeof pleasantOrCircumplex === 'number'
    ? pleasantOrCircumplex
    : pleasantOrCircumplex.pleasant;
  const eventful = typeof pleasantOrCircumplex === 'number'
    ? (eventfulArg ?? 0)
    : pleasantOrCircumplex.eventful;

  const vibrant = clampUnit((pleasant + eventful) / 2);
  const chaotic = clampUnit((-pleasant + eventful) / 2);
  const calm = clampUnit((pleasant - eventful) / 2);
  const monotonous = clampUnit((-pleasant - eventful) / 2);

  return {
    pleasant: toLikert(pleasant),
    annoying: toLikert(-pleasant),
    eventful: toLikert(eventful),
    uneventful: toLikert(-eventful),
    vibrant: toLikert(vibrant),
    chaotic: toLikert(chaotic),
    calm: toLikert(calm),
    monotonous: toLikert(monotonous),
  };
}

// Calculate circumplex coordinates from PAQ values
export function calculateCircumplexFromPAQ(paq: PAQPerception): CircumplexPerception {
  // Normalize PAQ values from 1-5 to -1 to 1
  const normalize = (v: number) => (v - 3) / 2;

  const pleasant = (
    (normalize(paq.pleasant) - normalize(paq.annoying)) +
    COS_45 * (normalize(paq.calm) - normalize(paq.chaotic)) +
    COS_45 * (normalize(paq.vibrant) - normalize(paq.monotonous))
  ) / (1 + (2 * COS_45));

  const eventful = (
    (normalize(paq.eventful) - normalize(paq.uneventful)) +
    COS_45 * (normalize(paq.chaotic) - normalize(paq.calm)) +
    COS_45 * (normalize(paq.vibrant) - normalize(paq.monotonous))
  ) / (1 + (2 * COS_45));

  // Clamp to -1 to 1 range
  return {
    pleasant: clampUnit(pleasant),
    eventful: clampUnit(eventful),
  };
}

export function getCircumplexQuadrantLabel(
  pleasant: number,
  eventful: number
): string {
  if (pleasant >= 0 && eventful >= 0) return 'Vibrant';
  if (pleasant >= 0 && eventful < 0) return 'Calm';
  if (pleasant < 0 && eventful >= 0) return 'Chaotic';
  return 'Monotonous';
}

export function getIsoAxisLabel(
  value: number,
  positiveLabel: string,
  negativeLabel: string
): string {
  if (Math.abs(value) < 0.05) {
    return 'Neutral';
  }

  return value >= 0 ? positiveLabel : negativeLabel;
}

export function getIsoAxisPercent(value: number): number {
  return Math.round(Math.abs(value) * 100);
}
