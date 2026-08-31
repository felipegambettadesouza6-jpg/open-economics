CREATE TABLE `usage_actors` (
	`actor_hash` text PRIMARY KEY NOT NULL,
	`first_seen_day` text NOT NULL,
	`last_seen_day` text NOT NULL,
	`active_days` integer DEFAULT 1 NOT NULL,
	`first_activated_at` integer,
	`last_activated_at` integer,
	`activation_type` text,
	`activation_count` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_usage_actors_activated` ON `usage_actors` (`first_activated_at`);--> statement-breakpoint
CREATE INDEX `idx_usage_actors_last_seen` ON `usage_actors` (`last_seen_day`);