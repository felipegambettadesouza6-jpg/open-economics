import type { SeriesResult } from "@/lib/domain/types";

export interface Snapshot {
  payload: SeriesResult;
  fetchedAt: number;
  expiresAt: number;
}

export interface SnapshotRepository {
  get(cacheKey: string): Promise<Snapshot | null>;
  put(
    cacheKey: string,
    indicatorId: string,
    payload: SeriesResult,
    ttlSeconds: number,
  ): Promise<void>;
}

class NullSnapshotRepository implements SnapshotRepository {
  async get() {
    return null;
  }
  async put() {}
}

class D1SnapshotRepository implements SnapshotRepository {
  private initialized = false;

  constructor(private readonly db: D1Database) {}

  private async initialize() {
    if (this.initialized) return;
    await this.db.batch([
      this.db
        .prepare(
          `CREATE TABLE IF NOT EXISTS series_snapshots (
            cache_key TEXT PRIMARY KEY,
            indicator_id TEXT NOT NULL,
            adapter_version INTEGER NOT NULL DEFAULT 1,
            payload_json TEXT NOT NULL,
            fetched_at INTEGER NOT NULL,
            expires_at INTEGER NOT NULL
          )`,
        ),
      this.db
        .prepare(
          "CREATE INDEX IF NOT EXISTS idx_series_snapshots_indicator ON series_snapshots(indicator_id)",
        ),
    ]);
    this.initialized = true;
  }

  async get(cacheKey: string) {
    await this.initialize();
    const row = await this.db
      .prepare(
        "SELECT payload_json, fetched_at, expires_at FROM series_snapshots WHERE cache_key = ? AND adapter_version = 1",
      )
      .bind(cacheKey)
      .first<{ payload_json: string; fetched_at: number; expires_at: number }>();

    if (!row) return null;
    try {
      return {
        payload: JSON.parse(row.payload_json) as SeriesResult,
        fetchedAt: row.fetched_at,
        expiresAt: row.expires_at,
      };
    } catch {
      return null;
    }
  }

  async put(cacheKey: string, indicatorId: string, payload: SeriesResult, ttlSeconds: number) {
    await this.initialize();
    const fetchedAt = Date.now();
    const expiresAt = fetchedAt + ttlSeconds * 1000;
    await this.db
      .prepare(
        `INSERT INTO series_snapshots
          (cache_key, indicator_id, adapter_version, payload_json, fetched_at, expires_at)
         VALUES (?, ?, 1, ?, ?, ?)
         ON CONFLICT(cache_key) DO UPDATE SET
          indicator_id = excluded.indicator_id,
          adapter_version = 1,
          payload_json = excluded.payload_json,
          fetched_at = excluded.fetched_at,
          expires_at = excluded.expires_at`,
      )
      .bind(cacheKey, indicatorId, JSON.stringify(payload), fetchedAt, expiresAt)
      .run();
  }
}

export function createSnapshotRepository(db?: D1Database): SnapshotRepository {
  return db ? new D1SnapshotRepository(db) : new NullSnapshotRepository();
}

