import { index, integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

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

export const usageCounters = sqliteTable(
  "usage_counters",
  {
    day: text("day").notNull(),
    event: text("event").notNull(),
    dimension: text("dimension").notNull(),
    count: integer("count").notNull().default(0),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.day, table.event, table.dimension], name: "usage_counters_pk" }),
    index("idx_usage_counters_day_event").on(table.day, table.event),
  ],
);

export const usageUniques = sqliteTable(
  "usage_uniques",
  {
    day: text("day").notNull(),
    sessionHash: text("session_hash").notNull(),
    createdAt: integer("created_at").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.day, table.sessionHash], name: "usage_uniques_pk" }),
    index("idx_usage_uniques_day").on(table.day),
  ],
);

export const usageActors = sqliteTable(
  "usage_actors",
  {
    actorHash: text("actor_hash").primaryKey(),
    firstSeenDay: text("first_seen_day").notNull(),
    lastSeenDay: text("last_seen_day").notNull(),
    activeDays: integer("active_days").notNull().default(1),
    firstChannel: text("first_channel"),
    firstReferrer: text("first_referrer"),
    firstCampaign: text("first_campaign"),
    firstActivatedAt: integer("first_activated_at"),
    lastActivatedAt: integer("last_activated_at"),
    activationType: text("activation_type"),
    activationCount: integer("activation_count").notNull().default(0),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [
    index("idx_usage_actors_activated").on(table.firstActivatedAt),
    index("idx_usage_actors_last_seen").on(table.lastSeenDay),
  ],
);
