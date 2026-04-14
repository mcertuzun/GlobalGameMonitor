ALTER TABLE `ad_creatives` ADD `countries` text;--> statement-breakpoint
ALTER TABLE `ad_creatives` ADD `platforms` text;--> statement-breakpoint
ALTER TABLE `ad_creatives` ADD `variant_group_id` text;--> statement-breakpoint
ALTER TABLE `ad_creatives` ADD `impressions_upper` integer;--> statement-breakpoint
ALTER TABLE `ad_creatives` ADD `impressions_lower` integer;--> statement-breakpoint
ALTER TABLE `ad_creatives` ADD `investment_score` real;--> statement-breakpoint
CREATE INDEX `ad_creatives_variant_group_idx` ON `ad_creatives` (`variant_group_id`);--> statement-breakpoint
CREATE INDEX `ad_creatives_investment_score_idx` ON `ad_creatives` (`investment_score`);