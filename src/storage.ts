// storage.ts
// Offline-first local store using the browser's IndexedDB. Records persist
// across reloads and survive being offline indefinitely.

import type { InspectionRecord } from './types';

const DB_NAME = 'inspections';
const STORE = 'records';

function getDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'id' });
        store.createIndex('synced', 'synced');
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveRecord(rec: InspectionRecord): Promise<void> {
  const db = await getDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(rec);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getAll(): Promise<InspectionRecord[]> {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => {
      const records = (req.result as InspectionRecord[]) ?? [];
      records.sort((a, b) => (a.capturedAt < b.capturedAt ? 1 : -1));
      resolve(records);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function getUnsynced(): Promise<InspectionRecord[]> {
  const all = await getAll();
  return all.filter((r) => !r.synced).sort((a, b) => (a.capturedAt < b.capturedAt ? -1 : 1));
}

export async function markSynced(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const db = await getDb();
  const wanted = new Set(ids);
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    const req = store.getAll();
    req.onsuccess = () => {
      for (const rec of req.result as InspectionRecord[]) {
        if (wanted.has(rec.id)) store.put({ ...rec, synced: true });
      }
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
