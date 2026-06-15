ALTER TABLE `cards` ADD `photo_key` text;--> statement-breakpoint
ALTER TABLE `cards` ADD `photo_content_type` text;--> statement-breakpoint
ALTER TABLE `cards` ADD `share_token` text;--> statement-breakpoint
ALTER TABLE `cards` ADD `share_expires_at` text;--> statement-breakpoint
CREATE UNIQUE INDEX `cards_share_token_unique` ON `cards` (`share_token`);--> statement-breakpoint
CREATE INDEX `cards_share_token_idx` ON `cards` (`share_token`);