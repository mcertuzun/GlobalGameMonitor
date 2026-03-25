CREATE TABLE `app_reviews` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`app_id` integer NOT NULL,
	`store` text NOT NULL,
	`review_id` text,
	`user_name` text,
	`score` integer NOT NULL,
	`title` text,
	`text` text,
	`thumbs_up` integer,
	`version` text,
	`date` text NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP),
	FOREIGN KEY (`app_id`) REFERENCES `apps`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_app_reviews_app_date` ON `app_reviews` (`app_id`,`date`);--> statement-breakpoint
CREATE INDEX `idx_app_reviews_score` ON `app_reviews` (`score`);--> statement-breakpoint
CREATE TABLE `keyword_scores` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`keyword` text NOT NULL,
	`store` text NOT NULL,
	`traffic_score` real,
	`difficulty_score` real,
	`date` text NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP)
);
--> statement-breakpoint
CREATE INDEX `idx_keyword_scores_keyword` ON `keyword_scores` (`keyword`,`date`);--> statement-breakpoint
CREATE TABLE `similar_apps` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`app_id` integer NOT NULL,
	`similar_store_id` text NOT NULL,
	`similar_name` text NOT NULL,
	`similar_developer` text,
	`similar_score` real,
	`store` text NOT NULL,
	`discovered_at` text DEFAULT (CURRENT_TIMESTAMP),
	FOREIGN KEY (`app_id`) REFERENCES `apps`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_similar_apps_app` ON `similar_apps` (`app_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_similar_apps_unique` ON `similar_apps` (`app_id`,`similar_store_id`);