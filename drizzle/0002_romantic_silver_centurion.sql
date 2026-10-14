CREATE TABLE `artist_sales` (
	`artist_id` text NOT NULL,
	`id` text NOT NULL,
	`event_id` text NOT NULL,
	`date` text NOT NULL,
	`data` text NOT NULL,
	PRIMARY KEY(`artist_id`, `id`),
	FOREIGN KEY (`artist_id`) REFERENCES `artists`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `artist_sales_event_date` ON `artist_sales` (`artist_id`,`event_id`,`date`);--> statement-breakpoint
ALTER TABLE `artist_workspaces` ADD `sales_migrated` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `artist_workspaces` ADD `mutation` text;