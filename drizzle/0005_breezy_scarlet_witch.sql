CREATE TABLE `audit_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`at` integer DEFAULT (unixepoch()) NOT NULL,
	`action` text NOT NULL,
	`username` text,
	`ip` text,
	`detail` text
);
