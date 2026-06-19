CREATE TABLE `interested_parties` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`partner_name` text,
	`phone` text,
	`email` text,
	`address` text,
	`source` text,
	`status` text DEFAULT 'enquired' NOT NULL,
	`notes` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
ALTER TABLE `viewings` ADD `interested_party_id` integer REFERENCES interested_parties(id);--> statement-breakpoint
ALTER TABLE `viewings` ADD `location` text;--> statement-breakpoint
INSERT INTO `interested_parties` (`name`, `phone`, `email`, `status`, `created_at`)
	SELECT `visitor_name`, `phone`, `email`, 'enquired', (unixepoch())
	FROM (SELECT DISTINCT `visitor_name`, `phone`, `email` FROM `viewings`);--> statement-breakpoint
UPDATE `viewings` SET `interested_party_id` = (
	SELECT `ip`.`id` FROM `interested_parties` `ip`
	WHERE `ip`.`name` = `viewings`.`visitor_name`
		AND `ip`.`phone` IS `viewings`.`phone`
		AND `ip`.`email` IS `viewings`.`email`
);--> statement-breakpoint
ALTER TABLE `viewings` DROP COLUMN `visitor_name`;--> statement-breakpoint
ALTER TABLE `viewings` DROP COLUMN `phone`;--> statement-breakpoint
ALTER TABLE `viewings` DROP COLUMN `email`;
