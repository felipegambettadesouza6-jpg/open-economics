import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const seriesSnapshots = sqliteTable(
  "series_snapshots",
  {
    cacheKey: text("cache_key").primaryKey(),
    indicatorId: text("indicator_id").notNull(),
    adapterVersion: integer("adapter_version").notNull().default(1),
    payloadJson: text("payload_json").notNull(),
    fetchedAt: integer("fetched_at").notNull(),
    expiresAt: integer("expires_at").notNull(),
  },
  (table) => [index("idx_series_snapshots_indicator").on(table.indicatorId)],
);

