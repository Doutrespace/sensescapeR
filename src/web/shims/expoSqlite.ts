/**
 * Web replacement for `expo-sqlite`, backed by sql.js (SQLite compiled to
 * WebAssembly). The database lives in memory and is written to IndexedDB
 * after every change, so the same SQL and migrations run on every platform.
 */
// @ts-ignore - no bundled types for the browser build
import initSqlJs from 'sql.js/dist/sql-wasm-browser.js';
import { kvGet, kvSet, mediaStoreReady, publicAssetUrl } from '../mediaStore';

type BindValue = string | number | null | boolean | Uint8Array;

export const defaultDatabaseDirectory = '/document/SQLite';

let sqlJsPromise: Promise<any> | null = null;

function loadSqlJs(): Promise<any> {
  if (!sqlJsPromise) {
    sqlJsPromise = initSqlJs({
      locateFile: (file: string) => publicAssetUrl(`sqljs/${file}`),
    });
  }
  return sqlJsPromise!;
}

function normalizeParams(params: unknown[]): BindValue[] {
  const flat = params.length === 1 && Array.isArray(params[0])
    ? (params[0] as unknown[])
    : params;
  return flat.map((value) => {
    if (value === undefined) {
      return null;
    }
    if (typeof value === 'boolean') {
      return value ? 1 : 0;
    }
    return value as BindValue;
  });
}

export class SQLiteDatabase {
  private persistTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private readonly db: any, private readonly storageKey: string) {}

  private schedulePersist(): void {
    if (this.persistTimer) {
      clearTimeout(this.persistTimer);
    }
    this.persistTimer = setTimeout(() => {
      this.persistTimer = null;
      void this.persistNow();
    }, 150);
  }

  private async persistNow(throwOnError = false): Promise<void> {
    try {
      const bytes: Uint8Array = this.db.export();
      // sql.js reopens the database on export, which drops connection pragmas.
      this.db.run('PRAGMA foreign_keys = ON;');
      await kvSet(this.storageKey, bytes);
    } catch (error) {
      console.warn('[sqlite] Could not persist database', error);
      if (throwOnError) {
        throw error;
      }
    }
  }

  /**
   * Writes the database to browser storage now and reports failure. Used
   * after saving a measurement, where "saved" must mean "on disk".
   */
  async flushAsync(): Promise<void> {
    if (this.persistTimer) {
      clearTimeout(this.persistTimer);
      this.persistTimer = null;
    }
    await this.persistNow(true);
  }

  async execAsync(sql: string): Promise<void> {
    this.db.exec(sql);
    this.schedulePersist();
  }

  async runAsync(sql: string, ...params: unknown[]): Promise<{ changes: number; lastInsertRowId: number }> {
    this.db.run(sql, normalizeParams(params));
    const changes = this.db.getRowsModified();
    const rowIdResult = this.db.exec('SELECT last_insert_rowid() AS id;');
    const lastInsertRowId = Number(rowIdResult?.[0]?.values?.[0]?.[0] ?? 0);
    this.schedulePersist();
    return { changes, lastInsertRowId };
  }

  async getAllAsync<T = any>(sql: string, ...params: unknown[]): Promise<T[]> {
    const statement = this.db.prepare(sql);
    try {
      statement.bind(normalizeParams(params));
      const rows: T[] = [];
      while (statement.step()) {
        rows.push(statement.getAsObject() as T);
      }
      return rows;
    } finally {
      statement.free();
    }
  }

  async getFirstAsync<T = any>(sql: string, ...params: unknown[]): Promise<T | null> {
    const rows = await this.getAllAsync<T>(sql, ...params);
    return rows[0] ?? null;
  }

  async withTransactionAsync(task: () => Promise<void>): Promise<void> {
    this.db.exec('BEGIN;');
    try {
      await task();
      this.db.exec('COMMIT;');
    } catch (error) {
      this.db.exec('ROLLBACK;');
      throw error;
    } finally {
      this.schedulePersist();
    }
  }

  async closeAsync(): Promise<void> {
    if (this.persistTimer) {
      clearTimeout(this.persistTimer);
      this.persistTimer = null;
    }
    await this.persistNow();
    this.db.close();
  }
}

export async function openDatabaseAsync(databaseName: string): Promise<SQLiteDatabase> {
  // Recording rows reference media by stable id; make sure the media store is
  // loaded before any row is mapped back to a playable URL.
  const [SQL] = await Promise.all([loadSqlJs(), mediaStoreReady()]);
  const storageKey = `sqlite:${databaseName}`;

  // If the stored database cannot be read, do NOT continue with an empty
  // one: its first write would replace all saved measurements. Try once
  // more, then fail loudly.
  let existing: Uint8Array | undefined;
  try {
    existing = await kvGet<Uint8Array>(storageKey);
  } catch (firstError) {
    console.warn('[sqlite] Could not read persisted database, retrying', firstError);
    await new Promise((resolve) => setTimeout(resolve, 300));
    existing = await kvGet<Uint8Array>(storageKey);
  }

  const db = existing ? new SQL.Database(existing) : new SQL.Database();
  const database = new SQLiteDatabase(db, storageKey);

  if (typeof window !== 'undefined') {
    // Flush pending writes when the tab is hidden or closed.
    window.addEventListener('pagehide', () => {
      void (database as any).persistNow();
    });
    // iOS often skips `pagehide` when the browser goes to the background.
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        void (database as any).persistNow();
      }
    });
  }

  return database;
}
