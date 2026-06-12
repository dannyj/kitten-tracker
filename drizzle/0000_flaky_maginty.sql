CREATE TABLE `adopters` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`kitten_id` integer NOT NULL,
	`name` text NOT NULL,
	`phone` text,
	`email` text,
	`address` text,
	`adoption_date` text,
	`shelter_reference` text,
	`note` text,
	FOREIGN KEY (`kitten_id`) REFERENCES `kittens`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `alert_settings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`key` text NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `alert_settings_key_unique` ON `alert_settings` (`key`);--> statement-breakpoint
CREATE TABLE `feedings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`kitten_id` integer NOT NULL,
	`fed_at` integer DEFAULT (unixepoch()) NOT NULL,
	`amount_ml` real,
	`formula` text,
	`quality` text,
	`note` text,
	FOREIGN KEY (`kitten_id`) REFERENCES `kittens`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `kittens` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`litter_id` integer NOT NULL,
	`shelter_number` text,
	`name` text NOT NULL,
	`sex` text DEFAULT 'unknown' NOT NULL,
	`color` text,
	`birth_date` text,
	`birth_date_estimated` integer DEFAULT false NOT NULL,
	`hand_feeding` integer DEFAULT false NOT NULL,
	`feeding_interval_minutes` integer DEFAULT 120 NOT NULL,
	`status` text DEFAULT 'intake' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`litter_id`) REFERENCES `litters`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `kittens_shelter_number_unique` ON `kittens` (`shelter_number`);--> statement-breakpoint
CREATE TABLE `litters` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`mother_id` integer,
	`birth_date` text,
	`birth_date_estimated` integer DEFAULT false NOT NULL,
	`notes` text,
	FOREIGN KEY (`mother_id`) REFERENCES `mothers`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `mother_health_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`mother_id` integer NOT NULL,
	`logged_at` integer DEFAULT (unixepoch()) NOT NULL,
	`category` text DEFAULT 'other' NOT NULL,
	`entry` text NOT NULL,
	FOREIGN KEY (`mother_id`) REFERENCES `mothers`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `mothers` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`shelter_number` text,
	`intake_date` text,
	`notes_behaviour` text,
	`status` text DEFAULT 'in_care' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `photos` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`subject_type` text NOT NULL,
	`subject_id` integer NOT NULL,
	`file_path` text NOT NULL,
	`taken_at` integer,
	`taken_at_source` text DEFAULT 'upload' NOT NULL,
	`caption` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` integer NOT NULL,
	`expires_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `status_history` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`kitten_id` integer NOT NULL,
	`status` text NOT NULL,
	`changed_at` integer DEFAULT (unixepoch()) NOT NULL,
	`note` text,
	FOREIGN KEY (`kitten_id`) REFERENCES `kittens`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`username` text NOT NULL,
	`password_hash` text NOT NULL,
	`role` text DEFAULT 'viewer' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_username_unique` ON `users` (`username`);--> statement-breakpoint
CREATE TABLE `vaccinations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`kitten_id` integer NOT NULL,
	`type` text NOT NULL,
	`given_at` text NOT NULL,
	`batch_number` text,
	`administered_by` text,
	`next_due_date` text,
	`note` text,
	FOREIGN KEY (`kitten_id`) REFERENCES `kittens`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `viewing_kittens` (
	`viewing_id` integer NOT NULL,
	`kitten_id` integer NOT NULL,
	PRIMARY KEY(`viewing_id`, `kitten_id`),
	FOREIGN KEY (`viewing_id`) REFERENCES `viewings`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`kitten_id`) REFERENCES `kittens`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `viewings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`visited_at` integer DEFAULT (unixepoch()) NOT NULL,
	`visitor_name` text NOT NULL,
	`phone` text,
	`email` text,
	`notes` text
);
--> statement-breakpoint
CREATE TABLE `weight_entries` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`kitten_id` integer NOT NULL,
	`weighed_at` integer DEFAULT (unixepoch()) NOT NULL,
	`weight_grams` integer NOT NULL,
	`note` text,
	FOREIGN KEY (`kitten_id`) REFERENCES `kittens`(`id`) ON UPDATE no action ON DELETE cascade
);
