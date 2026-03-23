CREATE TABLE `ad_creatives` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`app_id` integer NOT NULL,
	`platform` text NOT NULL,
	`creative_type` text,
	`creative_url` text,
	`ad_copy` text,
	`headline` text,
	`cta` text,
	`first_seen` text,
	`last_seen` text,
	`is_active` integer DEFAULT true,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP),
	FOREIGN KEY (`app_id`) REFERENCES `apps`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `ad_creatives_app_platform_idx` ON `ad_creatives` (`app_id`,`platform`);--> statement-breakpoint
CREATE TABLE `apps` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`store` text NOT NULL,
	`store_id` text NOT NULL,
	`name` text NOT NULL,
	`developer` text,
	`category` text,
	`icon_url` text,
	`is_own_game` integer DEFAULT false,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP),
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `apps_store_store_id_unique` ON `apps` (`store`,`store_id`);--> statement-breakpoint
CREATE TABLE `aso_keywords` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`app_id` integer NOT NULL,
	`keyword` text NOT NULL,
	`search_volume` integer,
	`difficulty` real,
	`rank_position` integer,
	`source` text,
	`date` text NOT NULL,
	FOREIGN KEY (`app_id`) REFERENCES `apps`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `aso_keywords_app_date_idx` ON `aso_keywords` (`app_id`,`date`);--> statement-breakpoint
CREATE TABLE `community_signals` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`app_id` integer NOT NULL,
	`source` text NOT NULL,
	`title` text,
	`url` text,
	`content_summary` text,
	`sentiment_score` real,
	`engagement_score` real,
	`date` text NOT NULL,
	FOREIGN KEY (`app_id`) REFERENCES `apps`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `community_signals_source_date_idx` ON `community_signals` (`source`,`date`);--> statement-breakpoint
CREATE TABLE `market_snapshots` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`app_id` integer NOT NULL,
	`source` text NOT NULL,
	`date` text NOT NULL,
	`rank` integer,
	`category_rank` integer,
	`rating` real,
	`rating_count` integer,
	`downloads_estimate` integer,
	`revenue_estimate` integer,
	`price` real,
	`version` text,
	`raw_json` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP),
	FOREIGN KEY (`app_id`) REFERENCES `apps`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `market_snapshots_app_date_idx` ON `market_snapshots` (`app_id`,`date`);--> statement-breakpoint
CREATE INDEX `market_snapshots_source_date_idx` ON `market_snapshots` (`source`,`date`);--> statement-breakpoint
CREATE TABLE `scraper_runs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`scraper_name` text NOT NULL,
	`started_at` text NOT NULL,
	`finished_at` text,
	`status` text NOT NULL,
	`records_fetched` integer,
	`error_message` text
);
--> statement-breakpoint
CREATE INDEX `scraper_runs_name_started_idx` ON `scraper_runs` (`scraper_name`,`started_at`);--> statement-breakpoint
CREATE TABLE `sdk_usage` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`app_id` integer NOT NULL,
	`sdk_name` text NOT NULL,
	`sdk_category` text,
	`detected_at` text,
	`removed_at` text,
	`source` text,
	FOREIGN KEY (`app_id`) REFERENCES `apps`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `sdk_usage_app_idx` ON `sdk_usage` (`app_id`);--> statement-breakpoint
CREATE TABLE `top_charts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`store` text NOT NULL,
	`country` text NOT NULL,
	`category` text NOT NULL,
	`chart_type` text NOT NULL,
	`date` text NOT NULL,
	`rank` integer NOT NULL,
	`app_id` integer NOT NULL,
	FOREIGN KEY (`app_id`) REFERENCES `apps`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `top_charts_unique` ON `top_charts` (`store`,`country`,`category`,`chart_type`,`date`,`rank`);--> statement-breakpoint
CREATE INDEX `top_charts_store_country_category_date_idx` ON `top_charts` (`store`,`country`,`category`,`date`);--> statement-breakpoint
CREATE TABLE `trends_data` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`app_id` integer NOT NULL,
	`keyword` text NOT NULL,
	`region` text,
	`interest_score` real,
	`date` text NOT NULL,
	`raw_json` text,
	FOREIGN KEY (`app_id`) REFERENCES `apps`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `trends_data_app_date_idx` ON `trends_data` (`app_id`,`date`);