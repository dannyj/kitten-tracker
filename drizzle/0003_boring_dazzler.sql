CREATE TABLE `schedule_templates` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`vaccine_type` text NOT NULL,
	`label` text NOT NULL,
	`first_weeks` real NOT NULL,
	`every_weeks` real NOT NULL,
	`until_weeks` real NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `schedule_templates_type_unique` ON `schedule_templates` (`vaccine_type`);--> statement-breakpoint
ALTER TABLE `vaccinations` ADD `corrects_id` integer REFERENCES vaccinations(id);--> statement-breakpoint
ALTER TABLE `vaccinations` ADD `created_at` integer DEFAULT (unixepoch()) NOT NULL;