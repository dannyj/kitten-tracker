PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_vaccinations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`subject_type` text NOT NULL,
	`subject_id` integer NOT NULL,
	`type` text NOT NULL,
	`given_at` text NOT NULL,
	`batch_number` text,
	`administered_by` text,
	`next_due_date` text,
	`note` text,
	`corrects_id` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_vaccinations`(`id`, `subject_type`, `subject_id`, `type`, `given_at`, `batch_number`, `administered_by`, `next_due_date`, `note`, `corrects_id`, `created_at`) SELECT `id`, 'kitten', `kitten_id`, `type`, `given_at`, `batch_number`, `administered_by`, `next_due_date`, `note`, `corrects_id`, `created_at` FROM `vaccinations`;--> statement-breakpoint
DROP TABLE `vaccinations`;--> statement-breakpoint
ALTER TABLE `__new_vaccinations` RENAME TO `vaccinations`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
ALTER TABLE `schedule_templates` ADD `subject_type` text DEFAULT 'kitten' NOT NULL;--> statement-breakpoint
DROP INDEX `schedule_templates_type_unique`;--> statement-breakpoint
CREATE UNIQUE INDEX `schedule_templates_subject_type_unique` ON `schedule_templates` (`subject_type`,`vaccine_type`);
