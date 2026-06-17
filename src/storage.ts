// storage.ts
// Offline-first local store using expo-sqlite.
// (If you're not on Expo, swap to op-sqlite / react-native-sqlite-storage —
//  only the three db.* calls below change.)
//
// install: npx expo install expo-sqlite

import * as SQLite from 'expo-sqlite';
import type { InspectionRecord } from './types';

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = SQLite.openDatabaseAsync('inspections.db').then(async (db) => {
      await db.execAsync(`
        PRAGMA journal_mode = WAL;
        CREATE TABLE IF NOT EXISTS records (
          id         TEXT PRIMARY KEY NOT NULL,
          templateId TEXT NOT NULL,
          capturedAt TEXT NOT NULL,
          payload    TEXT NOT NULL,   -- full record as JSON
          synced     INTEGER NOT NULL DEFAULT 0
        );
        CREATE INDEX IF NOT EXISTS idx_unsynced ON records(synced);
      `);
      return db;
    });
  }
  return dbPromise;
}

export async function saveRecord(rec: InspectionRecord): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT OR REPLACE INTO records (id, templateId, capturedAt, payload, synced)
     VALUES (?, ?, ?, ?, ?)`,
    [rec.id, rec.templateId, rec.capturedAt, JSON.stringify(rec), rec.synced ? 1 : 0],
  );
}

export async function getUnsynced(): Promise<InspectionRecord[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ payload: string }>(
    `SELECT payload FROM records WHERE synced = 0 ORDER BY capturedAt ASC`,
  );
  return rows.map((r) => JSON.parse(r.payload) as InspectionRecord);
}

export async function markSynced(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const db = await getDb();
  const placeholders = ids.map(() => '?').join(',');
  await db.runAsync(
    `UPDATE records SET synced = 1 WHERE id IN (${placeholders})`,
    ids,
  );
}

export async function getAll(): Promise<InspectionRecord[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ payload: string }>(
    `SELECT payload FROM records ORDER BY capturedAt DESC`,
  );
  return rows.map((r) => JSON.parse(r.payload) as InspectionRecord);
}
