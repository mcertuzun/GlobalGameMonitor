PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_trends_data` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`app_id` integer,
	`keyword` text NOT NULL,
	`region` text,
	`interest_score` real,
	`date` text NOT NULL,
	`raw_json` text,
	FOREIGN KEY (`app_id`) REFERENCES `apps`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_trends_data`("id", "app_id", "keyword", "region", "interest_score", "date", "raw_json") SELECT "id", "app_id", "keyword", "region", "interest_score", "date", "raw_json" FROM `trends_data`;--> statement-breakpoint
DROP TABLE `trends_data`;--> statement-breakpoint
ALTER TABLE `__new_trends_data` RENAME TO `trends_data`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `trends_data_app_date_idx` ON `trends_data` (`app_id`,`date`);