CREATE TABLE `usage_counters` (
	`day` text NOT NULL,
	`event` text NOT NULL,
	`dimension` text NOT NULL,
	`count` integer DEFAULT 0 NOT NULL,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`day`, `event`, `dimension`)
);
--> statement-breakpoint
CREATE INDEX `idx_usage_counters_day_event` ON `usage_counters` (`day`,`event`);--> statement-breakpoint
CREATE TABLE `usage_uniques` (
	`day` text NOT NULL,
	`session_hash` text NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`day`, `session_hash`)
);
--> statement-breakpoint
CREATE INDEX `idx_usage_uniques_day` ON `usage_uniques` (`day`);