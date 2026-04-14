ALTER TABLE `apps` ADD `track_ads` integer DEFAULT false;--> statement-breakpoint
ALTER TABLE `apps` ADD `watchlist_reason` text;--> statement-breakpoint
CREATE INDEX `apps_track_ads_idx` ON `apps` (`track_ads`);