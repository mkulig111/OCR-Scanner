// sync.ts
// The ONLY part that touches the network. Pushes unsynced records to your
// server when a connection is available; marks them synced on success.

import { getUnsynced, markSynced } from './storage';
import type { InspectionRecord } from './types';

export interface SyncConfig {
  endpoint: string;                       // e.g. https://api.yourserver.com/inspections
  headers?: Record<string, string>;       // auth, etc.
  batchSize?: number;
}

export interface SyncResult {
  attempted: number;
  succeeded: number;
  skipped: 'offline' | null;
}

function isOnline(): boolean {
  return navigator.onLine;
}

/**
 * Push pending records. Safe to call on app load, on a timer, or when the
 * browser reports connectivity returns. No-op when offline.
 */
export async function syncPending(cfg: SyncConfig): Promise<SyncResult> {
  if (!isOnline()) {
    return { attempted: 0, succeeded: 0, skipped: 'offline' };
  }

  const pending = await getUnsynced();
  if (pending.length === 0) return { attempted: 0, succeeded: 0, skipped: null };

  const batchSize = cfg.batchSize ?? 25;
  let succeeded = 0;

  for (let i = 0; i < pending.length; i += batchSize) {
    const batch = pending.slice(i, i + batchSize);
    const ok = await pushBatch(cfg, batch);
    if (ok) {
      await markSynced(batch.map((r) => r.id));
      succeeded += batch.length;
    } else {
      break; // stop on first failed batch; retry next cycle
    }
  }

  return { attempted: pending.length, succeeded, skipped: null };
}

async function pushBatch(cfg: SyncConfig, batch: InspectionRecord[]): Promise<boolean> {
  try {
    const res = await fetch(cfg.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(cfg.headers ?? {}) },
      body: JSON.stringify({ records: batch }),
    });
    return res.ok;
  } catch {
    return false; // network blip -> leave unsynced, retry later
  }
}

/** Auto-flush whenever connectivity is (re)gained. Returns an unsubscribe fn. */
export function startAutoSync(cfg: SyncConfig): () => void {
  const handler = () => void syncPending(cfg);
  window.addEventListener('online', handler);
  return () => window.removeEventListener('online', handler);
}
