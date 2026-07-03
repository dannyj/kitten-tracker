CREATE TABLE `kitten_care_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`kitten_id` integer NOT NULL,
	`logged_at` integer DEFAULT (unixepoch()) NOT NULL,
	`category` text DEFAULT 'other' NOT NULL,
	`entry` text NOT NULL,
	FOREIGN KEY (`kitten_id`) REFERENCES `kittens`(`id`) ON UPDATE no action ON DELETE cascade
);
