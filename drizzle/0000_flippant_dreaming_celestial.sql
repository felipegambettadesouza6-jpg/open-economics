CREATE TABLE `series_snapshots` (
	`cache_key` text PRIMARY KEY NOT NULL,
	`indicator_id` text NOT NULL,
	`adapter_version` integer DEFAULT 1 NOT NULL,
	`payload_json` text NOT NULL,
	`fetched_at` integer NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_series_snapshots_indicator` ON `series_snapshots` (`indicator_id`);