CREATE TABLE `game_metadata` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`source` text NOT NULL,
	`source_id` text NOT NULL,
	`name` text NOT NULL,
	`genres` text,
	`tags` text,
	`platforms` text,
	`rating` real,
	`rating_count` integer,
	`release_date` text,
	`developer` text,
	`publisher` text,
	`description` text,
	`image_url` text,
	`metacritic_score` integer,
	`playtime` integer,
	`raw_json` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP),
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_game_metadata_source_id` ON `game_metadata` (`source`,`source_id`);--> statement-breakpoint
CREATE INDEX `idx_game_metadata_name` ON `game_metadata` (`name`);--> statement-breakpoint
CREATE TABLE `trend_signals` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`source` text NOT NULL,
	`signal_type` text NOT NULL,
	`name` text NOT NULL,
	`value` real,
	`metadata` text,
	`date` text NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP)
);
--> statement-breakpoint
CREATE INDEX `idx_trend_signals_source_date` ON `trend_signals` (`source`,`date`);--> statement-breakpoint
CREATE INDEX `idx_trend_signals_name` ON `trend_signals` (`name`);