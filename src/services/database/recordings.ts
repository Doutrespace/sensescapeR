import { getDatabase } from './index';
import { Recording, RecordingFilters, SyncStatus, RecordingWithPerception } from '../../types/recording';
import type { ImageClassification } from '../../utils/imageClassification';
import { LoggingService } from '../logging';
import { toRuntimeUri, toStoredUri } from '../media/uriMapping';
import {
  sanitizeFilePath,
  sanitizeOptionalText,
  validateAudioUri,
  validateCoordinates,
} from '../../utils/validation';

interface QueryOptions {
  limit?: number;
  offset?: number;
}

function applyRecordingFilters(
  filters: RecordingFilters | undefined,
  alias: string,
  query: string,
  params: any[]
): string {
  if (!filters) {
    return query;
  }

  const prefix = alias ? `${alias}.` : '';

  if (filters.dateRange) {
    query += ` AND ${prefix}recorded_at >= ? AND ${prefix}recorded_at <= ?`;
    params.push(filters.dateRange.start, filters.dateRange.end);
  }

  if (filters.protocols && filters.protocols.length > 0) {
    const placeholders = filters.protocols.map(() => '?').join(',');
    query += ` AND ${prefix}protocol_type IN (${placeholders})`;
    params.push(...filters.protocols);
  }

  if (filters.habitats && filters.habitats.length > 0) {
    const placeholders = filters.habitats.map(() => '?').join(',');
    query += ` AND ${prefix}habitat_type IN (${placeholders})`;
    params.push(...filters.habitats);
  }

  if (filters.syncStatus && filters.syncStatus.length > 0) {
    const placeholders = filters.syncStatus.map(() => '?').join(',');
    query += ` AND ${prefix}sync_status IN (${placeholders})`;
    params.push(...filters.syncStatus);
  }

  if (filters.hasQualityIssues !== undefined) {
    if (filters.hasQualityIssues) {
      query += ` AND (${prefix}has_clipping = 1 OR ${prefix}has_wind_handling = 1 OR ${prefix}has_low_snr = 1)`;
    } else {
      query += ` AND ${prefix}has_clipping = 0 AND ${prefix}has_wind_handling = 0 AND ${prefix}has_low_snr = 0`;
    }
  }

  return query;
}

function generateId(): string {
  return `rec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Create a new recording
export async function createRecording(
  recording: Omit<Recording, 'id' | 'createdAt' | 'updatedAt'>
): Promise<Recording> {
  const db = await getDatabase();
  const now = new Date().toISOString();
  const id = generateId();

  const sanitizedAudioUri = sanitizeFilePath(recording.audioUri);
  if (!validateAudioUri(sanitizedAudioUri)) {
    throw new Error('Invalid audio file path');
  }

  if (
    recording.latitude !== null
    && recording.longitude !== null
    && !validateCoordinates(recording.latitude, recording.longitude)
  ) {
    throw new Error('Invalid coordinates');
  }

  const newRecording: Recording = {
    ...recording,
    audioUri: sanitizedAudioUri,
    photoUri: recording.photoUri ? sanitizeFilePath(recording.photoUri) : undefined,
    spectrogramUri: recording.spectrogramUri ? sanitizeFilePath(recording.spectrogramUri) : undefined,
    fieldNotes: sanitizeOptionalText(recording.fieldNotes) ?? undefined,
    spokenDescription: sanitizeOptionalText(recording.spokenDescription) ?? undefined,
    id,
    createdAt: now,
    updatedAt: now,
  };

  await db.runAsync(
    `INSERT INTO recordings (
      id, audio_uri, sample_rate, bit_depth, duration_ms,
      device_model, os_version, mic_route,
      recorded_at, timezone, latitude, longitude, gps_accuracy, privacy_mode,
      protocol_type, project_id,
      has_clipping, has_wind_handling, has_low_snr, peak_db, rms_db,
      normalization_applied, normalization_gain, acoustic_metrics,
      spectrogram_uri, detected_sounds,
      photo_uri, photo_classification,
      field_notes, spoken_description,
      habitat_type, setting_chips, source_dominance,
      license, community_visibility, sync_status, remote_id,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      newRecording.id,
      toStoredUri(newRecording.audioUri),
      newRecording.sampleRate,
      newRecording.bitDepth,
      newRecording.durationMs,
      newRecording.deviceModel,
      newRecording.osVersion,
      newRecording.micRoute,
      newRecording.recordedAt,
      newRecording.timezone,
      newRecording.latitude ?? null,
      newRecording.longitude ?? null,
      newRecording.gpsAccuracy ?? null,
      newRecording.privacyMode,
      newRecording.protocolType,
      newRecording.projectId ?? null,
      newRecording.hasClipping ? 1 : 0,
      newRecording.hasWindHandling ? 1 : 0,
      newRecording.hasLowSNR ? 1 : 0,
      newRecording.peakDb ?? null,
      newRecording.rmsDb ?? null,
      newRecording.normalizationApplied ? 1 : 0,
      newRecording.normalizationGain ?? null,
      newRecording.acousticMetrics ?? null,
      newRecording.spectrogramUri ? toStoredUri(newRecording.spectrogramUri) : null,
      newRecording.detectedSounds ?? null,
      newRecording.photoUri ? toStoredUri(newRecording.photoUri) : null,
      newRecording.photoClassification ? JSON.stringify(newRecording.photoClassification) : null,
      newRecording.fieldNotes ?? null,
      newRecording.spokenDescription ?? null,
      newRecording.habitatType ?? null,
      newRecording.settingChips ?? null,
      newRecording.sourceDominance ?? null,
      newRecording.license ?? null,
      newRecording.communityVisibility,
      newRecording.syncStatus,
      newRecording.remoteId ?? null,
      newRecording.createdAt,
      newRecording.updatedAt,
    ]
  );

  return newRecording;
}

// Get a recording by ID
export async function getRecording(id: string): Promise<Recording | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<any>(
    'SELECT * FROM recordings WHERE id = ?',
    [id]
  );

  return row ? mapRowToRecording(row) : null;
}

// Get all recordings with optional filters
export async function getRecordings(
  filters?: RecordingFilters,
  options: QueryOptions = {}
): Promise<Recording[]> {
  const db = await getDatabase();
  let query = 'SELECT * FROM recordings WHERE 1=1';
  const params: any[] = [];

  query = applyRecordingFilters(filters, '', query, params);
  query += ' ORDER BY recorded_at DESC';
  if (typeof options.limit === 'number') {
    query += ' LIMIT ?';
    params.push(options.limit);
  }
  if (typeof options.offset === 'number') {
    query += ' OFFSET ?';
    params.push(options.offset);
  }

  const rows = await db.getAllAsync<any>(query, params);
  return rows.map(mapRowToRecording);
}

// Get recordings with perceptions joined (single query with LEFT JOIN)
export async function getRecordingsWithPerceptions(
  filters?: RecordingFilters,
  options: QueryOptions = {}
): Promise<RecordingWithPerception[]> {
  const db = await getDatabase();

  let query = `
    SELECT
      r.*,
      p.id as p_id,
      p.iso_pleasant as p_iso_pleasant,
      p.iso_eventful as p_iso_eventful,
      p.paq_pleasant as p_paq_pleasant,
      p.paq_vibrant as p_paq_vibrant,
      p.paq_eventful as p_paq_eventful,
      p.paq_chaotic as p_paq_chaotic,
      p.paq_annoying as p_paq_annoying,
      p.paq_monotonous as p_paq_monotonous,
      p.paq_uneventful as p_paq_uneventful,
      p.paq_calm as p_paq_calm,
      p.created_at as p_created_at
    FROM recordings r
    LEFT JOIN perceptions p ON r.id = p.recording_id
    WHERE 1=1
  `;
  const params: any[] = [];

  query = applyRecordingFilters(filters, 'r', query, params);
  query += ' ORDER BY r.recorded_at DESC';
  if (typeof options.limit === 'number') {
    query += ' LIMIT ?';
    params.push(options.limit);
  }
  if (typeof options.offset === 'number') {
    query += ' OFFSET ?';
    params.push(options.offset);
  }

  const rows = await db.getAllAsync<any>(query, params);

  return rows.map((row) => ({
    ...mapRowToRecording(row),
    perception: row.p_id ? {
      id: row.p_id,
      recordingId: row.id,
      isoPleasant: row.p_iso_pleasant,
      isoEventful: row.p_iso_eventful,
      paqPleasant: row.p_paq_pleasant,
      paqVibrant: row.p_paq_vibrant,
      paqEventful: row.p_paq_eventful,
      paqChaotic: row.p_paq_chaotic,
      paqAnnoying: row.p_paq_annoying,
      paqMonotonous: row.p_paq_monotonous,
      paqUneventful: row.p_paq_uneventful,
      paqCalm: row.p_paq_calm,
      createdAt: row.p_created_at,
    } : undefined,
  }));
}

// Update recording
export async function updateRecording(
  id: string,
  updates: Partial<Recording>
): Promise<void> {
  const db = await getDatabase();
  const now = new Date().toISOString();

  // Build dynamic update query
  const fields: string[] = [];
  const values: any[] = [];

  if (updates.syncStatus !== undefined) {
    fields.push('sync_status = ?');
    values.push(updates.syncStatus);
  }
  if (updates.remoteId !== undefined) {
    fields.push('remote_id = ?');
    values.push(updates.remoteId);
  }
  if (updates.habitatType !== undefined) {
    fields.push('habitat_type = ?');
    values.push(updates.habitatType);
  }
  if (updates.settingChips !== undefined) {
    fields.push('setting_chips = ?');
    values.push(updates.settingChips);
  }
  if (updates.sourceDominance !== undefined) {
    fields.push('source_dominance = ?');
    values.push(updates.sourceDominance);
  }
  if (updates.license !== undefined) {
    fields.push('license = ?');
    values.push(updates.license);
  }
  if (updates.communityVisibility !== undefined) {
    fields.push('community_visibility = ?');
    values.push(updates.communityVisibility);
  }
  if (updates.privacyMode !== undefined) {
    fields.push('privacy_mode = ?');
    values.push(updates.privacyMode);
  }
  if (updates.spectrogramUri !== undefined) {
    fields.push('spectrogram_uri = ?');
    values.push(updates.spectrogramUri ? toStoredUri(sanitizeFilePath(updates.spectrogramUri)) : null);
  }
  if (updates.photoUri !== undefined) {
    fields.push('photo_uri = ?');
    values.push(updates.photoUri ? toStoredUri(sanitizeFilePath(updates.photoUri)) : null);
  }
  if (updates.photoClassification !== undefined) {
    fields.push('photo_classification = ?');
    values.push(
      updates.photoClassification
        ? JSON.stringify(updates.photoClassification)
        : null
    );
  }
  if (updates.fieldNotes !== undefined) {
    fields.push('field_notes = ?');
    values.push(sanitizeOptionalText(updates.fieldNotes) ?? null);
  }
  if (updates.spokenDescription !== undefined) {
    fields.push('spoken_description = ?');
    values.push(sanitizeOptionalText(updates.spokenDescription) ?? null);
  }
  if (updates.normalizationApplied !== undefined) {
    fields.push('normalization_applied = ?');
    values.push(updates.normalizationApplied ? 1 : 0);
  }
  if (updates.normalizationGain !== undefined) {
    fields.push('normalization_gain = ?');
    values.push(updates.normalizationGain ?? null);
  }

  fields.push('updated_at = ?');
  values.push(now);
  values.push(id);

  await db.runAsync(
    `UPDATE recordings SET ${fields.join(', ')} WHERE id = ?`,
    values
  );
}

// Update sync status
export async function updateSyncStatus(
  id: string,
  status: SyncStatus,
  remoteId?: string
): Promise<void> {
  const db = await getDatabase();
  const now = new Date().toISOString();

  await db.runAsync(
    'UPDATE recordings SET sync_status = ?, remote_id = ?, updated_at = ? WHERE id = ?',
    [status, remoteId ?? null, now, id]
  );
}

// Delete recording
export async function deleteRecording(id: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM perceptions WHERE recording_id = ?', [id]);
  await db.runAsync('DELETE FROM upload_queue WHERE recording_id = ?', [id]);
  await db.runAsync('DELETE FROM recordings WHERE id = ?', [id]);
}

// Get recordings by bounding box (for map)
export async function getRecordingsInBounds(
  minLat: number,
  maxLat: number,
  minLng: number,
  maxLng: number
): Promise<Recording[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<any>(
    `SELECT * FROM recordings
     WHERE latitude BETWEEN ? AND ?
     AND longitude BETWEEN ? AND ?
     ORDER BY recorded_at DESC`,
    [minLat, maxLat, minLng, maxLng]
  );

  return rows.map(mapRowToRecording);
}

// Get recording count
export async function getRecordingCount(filters?: RecordingFilters): Promise<number> {
  const db = await getDatabase();
  let query = 'SELECT COUNT(*) as count FROM recordings WHERE 1=1';
  const params: any[] = [];
  query = applyRecordingFilters(filters, '', query, params);
  const result = await db.getFirstAsync<{ count: number }>(
    query,
    params
  );
  return result?.count ?? 0;
}

// Get recordings by sync status
export async function getRecordingsBySyncStatus(status: SyncStatus): Promise<Recording[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<any>(
    'SELECT * FROM recordings WHERE sync_status = ? ORDER BY recorded_at DESC',
    [status]
  );
  return rows.map(mapRowToRecording);
}

// Helper to map DB row to Recording type
function mapRowToRecording(row: any): Recording {
  return {
    id: row.id,
    audioUri: toRuntimeUri(row.audio_uri),
    sampleRate: row.sample_rate,
    bitDepth: row.bit_depth,
    durationMs: row.duration_ms,
    deviceModel: row.device_model,
    osVersion: row.os_version,
    micRoute: row.mic_route,
    recordedAt: row.recorded_at,
    timezone: row.timezone,
    latitude: typeof row.latitude === 'number' ? row.latitude : null,
    longitude: typeof row.longitude === 'number' ? row.longitude : null,
    gpsAccuracy: typeof row.gps_accuracy === 'number' ? row.gps_accuracy : null,
    privacyMode: row.privacy_mode,
    protocolType: row.protocol_type,
    projectId: row.project_id,
    hasClipping: !!row.has_clipping,
    hasWindHandling: !!row.has_wind_handling,
    hasLowSNR: !!row.has_low_snr,
    peakDb: row.peak_db,
    rmsDb: row.rms_db,
    normalizationApplied: !!row.normalization_applied,
    normalizationGain: typeof row.normalization_gain === 'number' ? row.normalization_gain : null,
    acousticMetrics: row.acoustic_metrics ?? undefined,
    spectrogramUri: row.spectrogram_uri ? toRuntimeUri(row.spectrogram_uri) : row.spectrogram_uri,
    detectedSounds: row.detected_sounds ?? undefined,
    photoUri: row.photo_uri ? toRuntimeUri(row.photo_uri) : undefined,
    photoClassification: parsePhotoClassification(row.photo_classification),
    fieldNotes: row.field_notes ?? undefined,
    spokenDescription: row.spoken_description ?? undefined,
    habitatType: row.habitat_type,
    settingChips: row.setting_chips,
    sourceDominance: row.source_dominance,
    license: row.license,
    communityVisibility: row.community_visibility ?? 'private',
    syncStatus: row.sync_status,
    remoteId: row.remote_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function parsePhotoClassification(
  value: string | null | undefined
): ImageClassification[] | undefined {
  if (!value) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : undefined;
  } catch (error) {
    LoggingService.warn('Failed to parse photo classification JSON', {
      error: error instanceof Error ? error.message : String(error),
    });
    return undefined;
  }
}
