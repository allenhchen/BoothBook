CREATE TABLE `artist_finance` (
	`artist_id` text NOT NULL,
	`id` text NOT NULL,
	`date` text NOT NULL,
	`type` text NOT NULL,
	`event_id` text,
	`data` text NOT NULL,
	PRIMARY KEY(`artist_id`, `id`),
	FOREIGN KEY (`artist_id`) REFERENCES `artists`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `artist_finance_date` ON `artist_finance` (`artist_id`,`date`);--> statement-breakpoint
CREATE INDEX `artist_finance_event` ON `artist_finance` (`artist_id`,`event_id`,`type`);