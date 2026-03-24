PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_community_signals` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`app_id` integer,
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
INSERT INTO `__new_community_signals`("id", "app_id", "source", "title", "url", "content_summary", "sentiment_score", "engagement_score", "date") SELECT "id", "app_id", "source", "title", "url", "content_summary", "sentiment_score", "engagement_score", "date" FROM `community_signals`;--> statement-breakpoint
DROP TABLE `community_signals`;--> statement-breakpoint
ALTER TABLE `__new_community_signals` RENAME TO `community_signals`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `community_signals_source_date_idx` ON `community_signals` (`source`,`date`);