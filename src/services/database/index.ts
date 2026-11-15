import * as Crypto from 'expo-crypto';
import { Directory, File, Paths } from 'expo-file-system';
import * as SecureStore from 'expo-secure-store';
import * as SQLite from 'expo-sqlite';
import { Platform } from 'react-native';
import { LoggingService } from '../logging';

const DATABASE_NAME = 'soundscape.db';
const DATABASE_MIGRATION_NAME = 'soundscape.migration.db';
const CURRENT_VERSION = 9;
const DATABASE_KEY_ALIAS = 'soundscape.db.key.v1';
const DATABASE_ENCRYPTION_STATE_ALIAS = 'soundscape.db.encryption.v1';
const DATABASE_ENCRYPTION_ENABLED = 'enabled';

let db: SQLite.SQLiteDatabase | null = null;
let dbInitializationPromise: Promise<SQLite.SQLiteDatabase> | null = null;

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (db) {
    return db;
  }

  if (!dbInitializationPromise) {
    dbInitializationPromise = initializeDatabase();
  }

  try {
    db = await dbInitializationPromise;
    return db;
  } catch (error) {
    dbInitializationPromise = null;
    throw error;
  }
}

async function initializeDatabase(): Promise<SQLite.SQLiteDatabase> {
  const encryptionKey = await prepareDatabaseEncryption();
  const database = await SQLite.openDatabaseAsync(DATABASE_NAME);

  if (encryptionKey) {
    await applyEncryptionKey(database, encryptionKey);
  }

  await runMigrations(database);
  return database;
}

async function runMigrations(database: SQLite.SQLiteDatabase): Promise<void> {
  // Enable WAL mode for better performance
  await database.execAsync('PRAGMA journal_mode = WAL;');
  await database.execAsync('PRAGMA foreign_keys = ON;');

  // Get current version
  const result = await database.getFirstAsync<{ user_version: number }>(
    'PRAGMA user_version;'
  );
  const currentVersion = result?.user_version ?? 0;

  if (currentVersion < 1) {
    await migrateV1(database);
  }

  if (currentVersion < 2) {
    await migrateV2(database);
  }

  if (currentVersion < 3) {
    await migrateV3(database);
  }

  if (currentVersion < 4) {
    await migrateV4(database);
  }

  if (currentVersion < 5) {
    await migrateV5(database);
  }

  if (currentVersion < 6) {
    await migrateV6(database);
  }

  if (currentVersion < 7) {
    await migrateV7(database);
  }

  if (currentVersion < 8) {
    await migrateV8(database);
  }

  if (currentVersion < 9) {
    await migrateV9(database);
  }
}

async function prepareDatabaseEncryption(): Promise<string | null> {
  if (Platform.OS === 'web') {
    return null;
  }

  const encryptionKey = await getOrCreateDatabaseKey();
  await migratePlaintextDatabaseIfNeeded(encryptionKey);
  return encryptionKey;
}

async function getOrCreateDatabaseKey(): Promise<string> {
  const existingKey = await SecureStore.getItemAsync(DATABASE_KEY_ALIAS);
  if (existingKey) {
    return existingKey;
  }

  const encryptionState = await SecureStore.getItemAsync(DATABASE_ENCRYPTION_STATE_ALIAS);
  if (encryptionState === DATABASE_ENCRYPTION_ENABLED && getDatabaseFile(DATABASE_NAME).exists) {
    throw new Error('The local database encryption key is unavailable on this device. Clear local app data or reinstall to create a fresh encrypted database.');
  }

  const key = bytesToHex(Crypto.getRandomBytes(32));
  await SecureStore.setItemAsync(DATABASE_KEY_ALIAS, key);
  return key;
}

async function migratePlaintextDatabaseIfNeeded(encryptionKey: string): Promise<void> {
  const encryptionState = await SecureStore.getItemAsync(DATABASE_ENCRYPTION_STATE_ALIAS);
  const primaryDatabaseFile = getDatabaseFile(DATABASE_NAME);

  if (encryptionState === DATABASE_ENCRYPTION_ENABLED || !primaryDatabaseFile.exists) {
    return;
  }

  cleanupDatabaseArtifacts(DATABASE_MIGRATION_NAME);

  const plaintextDb = await SQLite.openDatabaseAsync(DATABASE_NAME, { useNewConnection: true });
  let plaintextReadable = true;

  try {
    await plaintextDb.getFirstAsync('PRAGMA user_version;');
  } catch (error) {
    plaintextReadable = false;
    LoggingService.warn('Skipped plaintext SQLCipher migration because the database did not open as plaintext', {
      error: error instanceof Error ? error.message : String(error),
    });
  }

  if (!plaintextReadable) {
    await plaintextDb.closeAsync();
    return;
  }

  try {
    await runMigrations(plaintextDb);

    const encryptedPath = buildDatabasePath(DATABASE_MIGRATION_NAME);
    await plaintextDb.execAsync(`
      ATTACH DATABASE '${escapeSqliteString(encryptedPath)}' AS encrypted KEY '${escapeSqliteString(encryptionKey)}';
      SELECT sqlcipher_export('encrypted');
      PRAGMA encrypted.user_version = ${CURRENT_VERSION};
      DETACH DATABASE encrypted;
    `);
  } finally {
    await plaintextDb.closeAsync();
  }

  cleanupDatabaseArtifacts(DATABASE_NAME);
  moveDatabaseArtifacts(DATABASE_MIGRATION_NAME, DATABASE_NAME);
  await SecureStore.setItemAsync(DATABASE_ENCRYPTION_STATE_ALIAS, DATABASE_ENCRYPTION_ENABLED);
  LoggingService.info('Migrated plaintext SQLite database to encrypted SQLCipher storage');
}

async function applyEncryptionKey(database: SQLite.SQLiteDatabase, encryptionKey: string): Promise<void> {
  await database.execAsync(`PRAGMA key = '${escapeSqliteString(encryptionKey)}';`);
  await database.execAsync('PRAGMA cipher_memory_security = ON;');
  await SecureStore.setItemAsync(DATABASE_ENCRYPTION_STATE_ALIAS, DATABASE_ENCRYPTION_ENABLED);
}

function getDatabaseDirectory(): Directory {
  return new Directory(Paths.document, 'SQLite');
}

function buildDatabasePath(databaseName: string): string {
  return `${SQLite.defaultDatabaseDirectory.replace(/\/*$/, '')}/${databaseName.replace(/^\/+/, '')}`;
}

function getDatabaseFile(databaseName: string): File {
  return new File(getDatabaseDirectory(), databaseName);
}

function cleanupDatabaseArtifacts(databaseName: string): void {
  for (const suffix of ['', '-wal', '-shm', '-journal']) {
    const file = getDatabaseFile(`${databaseName}${suffix}`);
    if (file.exists) {
      file.delete();
    }
  }
}

function moveDatabaseArtifacts(sourceName: string, destinationName: string): void {
  for (const suffix of ['', '-wal', '-shm', '-journal']) {
    const source = getDatabaseFile(`${sourceName}${suffix}`);
    if (!source.exists) {
      continue;
    }

    const destination = getDatabaseFile(`${destinationName}${suffix}`);
    if (destination.exists) {
      destination.delete();
    }
    source.move(destination);
  }
}

function escapeSqliteString(value: string): string {
  return value.replace(/'/g, "''");
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

async function migrateV1(database: SQLite.SQLiteDatabase): Promise<void> {
  await database.execAsync(`
    -- Recordings table
    CREATE TABLE IF NOT EXISTS recordings (
      id TEXT PRIMARY KEY,
      audio_uri TEXT NOT NULL,
      sample_rate INTEGER DEFAULT 44100,
      bit_depth INTEGER DEFAULT 16,
      duration_ms INTEGER DEFAULT 0,
      device_model TEXT,
      os_version TEXT,
      mic_route TEXT,
      recorded_at TEXT NOT NULL,
      timezone TEXT,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      gps_accuracy REAL,
      privacy_mode TEXT DEFAULT 'exact',
      protocol_type TEXT DEFAULT 'opportunistic',
      project_id TEXT,
      has_clipping INTEGER DEFAULT 0,
      has_wind_handling INTEGER DEFAULT 0,
      has_low_snr INTEGER DEFAULT 0,
      peak_db REAL,
      rms_db REAL,
      habitat_type TEXT,
      setting_chips TEXT,
      source_dominance TEXT,
      license TEXT,
      community_visibility TEXT DEFAULT 'private',
      sync_status TEXT DEFAULT 'local',
      remote_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    -- Perceptions table
    CREATE TABLE IF NOT EXISTS perceptions (
      id TEXT PRIMARY KEY,
      recording_id TEXT NOT NULL,
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
      created_at TEXT NOT NULL,
      FOREIGN KEY (recording_id) REFERENCES recordings(id) ON DELETE CASCADE
    );

    -- Upload queue table
    CREATE TABLE IF NOT EXISTS upload_queue (
      id TEXT PRIMARY KEY,
      recording_id TEXT UNIQUE NOT NULL,
      attempts INTEGER DEFAULT 0,
      next_retry_at TEXT,
      last_error TEXT,
      FOREIGN KEY (recording_id) REFERENCES recordings(id) ON DELETE CASCADE
    );

    -- Indexes for common queries
    CREATE INDEX IF NOT EXISTS idx_recordings_sync_status ON recordings(sync_status);
    CREATE INDEX IF NOT EXISTS idx_recordings_recorded_at ON recordings(recorded_at);
    CREATE INDEX IF NOT EXISTS idx_recordings_location ON recordings(latitude, longitude);
    CREATE INDEX IF NOT EXISTS idx_perceptions_recording_id ON perceptions(recording_id);
    CREATE INDEX IF NOT EXISTS idx_upload_queue_next_retry ON upload_queue(next_retry_at);

    -- Set version
    PRAGMA user_version = 1;
  `);
  LoggingService.info('Database migration v1 completed');
}

async function migrateV7(database: SQLite.SQLiteDatabase): Promise<void> {
  await database.execAsync(`
    ALTER TABLE recordings ADD COLUMN community_visibility TEXT DEFAULT 'private';
    UPDATE recordings
    SET community_visibility = COALESCE(community_visibility, 'private');
    PRAGMA user_version = 7;
  `);

  LoggingService.info('Database migration v7 completed', {
    change: 'added community_visibility column',
  });
}

async function migrateV8(database: SQLite.SQLiteDatabase): Promise<void> {
  await database.execAsync(`
    ALTER TABLE recordings ADD COLUMN normalization_applied INTEGER DEFAULT 0;
    ALTER TABLE recordings ADD COLUMN normalization_gain REAL;

    PRAGMA user_version = 8;
  `);

  LoggingService.info('Database migration v8 completed', {
    change: 'added playback normalization metadata columns',
  });
}

async function migrateV9(database: SQLite.SQLiteDatabase): Promise<void> {
  await database.execAsync(`
    ALTER TABLE recordings ADD COLUMN acoustic_metrics TEXT;

    PRAGMA user_version = 9;
  `);

  LoggingService.info('Database migration v9 completed', {
    change: 'added IEC-weighted acoustic_metrics column (LAeq, percentiles)',
  });
}

async function migrateV2(database: SQLite.SQLiteDatabase): Promise<void> {
  await database.execAsync(`
    -- Add spectrogram_uri column to recordings table
    ALTER TABLE recordings ADD COLUMN spectrogram_uri TEXT;

    -- Set version
    PRAGMA user_version = 2;
  `);
  LoggingService.info('Database migration v2 completed', { change: 'added spectrogram_uri column' });
}

async function migrateV3(database: SQLite.SQLiteDatabase): Promise<void> {
  await database.execAsync(`
    -- Add detected_sounds column for YAMNet AI-classified sound labels (JSON)
    ALTER TABLE recordings ADD COLUMN detected_sounds TEXT;

    -- Set version
    PRAGMA user_version = 3;
  `);
  LoggingService.info('Database migration v3 completed', { change: 'added detected_sounds column' });
}

async function migrateV4(database: SQLite.SQLiteDatabase): Promise<void> {
  await database.execAsync(`
    -- Add photo_uri column for environment photo
    ALTER TABLE recordings ADD COLUMN photo_uri TEXT;

    -- Add photo_classification column for image classification results (JSON)
    ALTER TABLE recordings ADD COLUMN photo_classification TEXT;

    -- Set version
    PRAGMA user_version = 4;
  `);
  LoggingService.info('Database migration v4 completed', {
    change: 'added photo_uri and photo_classification columns',
  });
}

async function migrateV5(database: SQLite.SQLiteDatabase): Promise<void> {
  await database.execAsync(`
    CREATE TABLE recordings_v5 (
      id TEXT PRIMARY KEY,
      audio_uri TEXT NOT NULL,
      sample_rate INTEGER DEFAULT 44100,
      bit_depth INTEGER DEFAULT 16,
      duration_ms INTEGER DEFAULT 0,
      device_model TEXT,
      os_version TEXT,
      mic_route TEXT,
      recorded_at TEXT NOT NULL,
      timezone TEXT,
      latitude REAL,
      longitude REAL,
      gps_accuracy REAL,
      privacy_mode TEXT DEFAULT 'exact',
      protocol_type TEXT DEFAULT 'opportunistic',
      project_id TEXT,
      has_clipping INTEGER DEFAULT 0,
      has_wind_handling INTEGER DEFAULT 0,
      has_low_snr INTEGER DEFAULT 0,
      peak_db REAL,
      rms_db REAL,
      habitat_type TEXT,
      setting_chips TEXT,
      source_dominance TEXT,
      license TEXT,
      sync_status TEXT DEFAULT 'local',
      remote_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      spectrogram_uri TEXT,
      detected_sounds TEXT,
      photo_uri TEXT,
      photo_classification TEXT
    );

    INSERT INTO recordings_v5 (
      id, audio_uri, sample_rate, bit_depth, duration_ms,
      device_model, os_version, mic_route,
      recorded_at, timezone, latitude, longitude, gps_accuracy, privacy_mode,
      protocol_type, project_id,
      has_clipping, has_wind_handling, has_low_snr, peak_db, rms_db,
      habitat_type, setting_chips, source_dominance,
      license, sync_status, remote_id,
      created_at, updated_at,
      spectrogram_uri, detected_sounds,
      photo_uri, photo_classification
    )
    SELECT
      id, audio_uri, sample_rate, bit_depth, duration_ms,
      device_model, os_version, mic_route,
      recorded_at, timezone,
      CASE
        WHEN privacy_mode = 'hidden' THEN NULL
        WHEN privacy_mode = 'fuzzed' AND latitude IS NOT NULL AND longitude IS NOT NULL THEN ROUND(latitude * 200.0) / 200.0
        WHEN latitude = 0 AND longitude = 0 AND COALESCE(gps_accuracy, 0) = 0 THEN NULL
        ELSE latitude
      END,
      CASE
        WHEN privacy_mode = 'hidden' THEN NULL
        WHEN privacy_mode = 'fuzzed' AND latitude IS NOT NULL AND longitude IS NOT NULL THEN ROUND(longitude * 200.0) / 200.0
        WHEN latitude = 0 AND longitude = 0 AND COALESCE(gps_accuracy, 0) = 0 THEN NULL
        ELSE longitude
      END,
      CASE
        WHEN privacy_mode = 'hidden' THEN NULL
        WHEN privacy_mode = 'fuzzed' AND latitude IS NOT NULL AND longitude IS NOT NULL THEN MAX(COALESCE(gps_accuracy, 0), 500)
        WHEN latitude = 0 AND longitude = 0 AND COALESCE(gps_accuracy, 0) = 0 THEN NULL
        ELSE gps_accuracy
      END,
      privacy_mode,
      protocol_type, project_id,
      has_clipping, has_wind_handling, has_low_snr, peak_db, rms_db,
      habitat_type, setting_chips, source_dominance,
      license, sync_status, remote_id,
      created_at, updated_at,
      spectrogram_uri, detected_sounds,
      photo_uri, photo_classification
    FROM recordings;

    DROP TABLE recordings;
    ALTER TABLE recordings_v5 RENAME TO recordings;

    CREATE INDEX IF NOT EXISTS idx_recordings_sync_status ON recordings(sync_status);
    CREATE INDEX IF NOT EXISTS idx_recordings_recorded_at ON recordings(recorded_at);
    CREATE INDEX IF NOT EXISTS idx_recordings_location ON recordings(latitude, longitude);

    PRAGMA user_version = 5;
  `);
  LoggingService.info('Database migration v5 completed', {
    change: 'made stored coordinates privacy-aware and nullable',
  });
}

async function migrateV6(database: SQLite.SQLiteDatabase): Promise<void> {
  await database.execAsync(`
    ALTER TABLE recordings ADD COLUMN field_notes TEXT;
    ALTER TABLE recordings ADD COLUMN spoken_description TEXT;

    PRAGMA user_version = 6;
  `);
  LoggingService.info('Database migration v6 completed', {
    change: 'added field notes and spoken description columns',
  });
}

export async function closeDatabase(): Promise<void> {
  if (db) {
    await db.closeAsync();
    db = null;
  }
}

export async function clearAllData(): Promise<void> {
  const database = await getDatabase();
  await database.execAsync(`
    DELETE FROM upload_queue;
    DELETE FROM perceptions;
    DELETE FROM recordings;
  `);
  LoggingService.info('Local database rows cleared');
}
