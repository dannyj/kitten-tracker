-- Replace the hand_feeding boolean with a three-way feeding_method
-- (mother | hand | weaned). The kittens table has children (weight_entries,
-- feedings cascade off it), so we ALTER in place rather than recreating it —
-- recreation would cascade-delete those rows. SQLite >=3.35 (bundled with
-- better-sqlite3) supports ADD/DROP COLUMN, so no __new_ copy is needed.
--
-- Order matters: add the column (every row defaults to 'mother'), backfill the
-- hand-fed rows while hand_feeding still exists, then drop the old column.
ALTER TABLE `kittens` ADD `feeding_method` text DEFAULT 'mother' NOT NULL;--> statement-breakpoint
UPDATE `kittens` SET `feeding_method` = 'hand' WHERE `hand_feeding` = 1;--> statement-breakpoint
ALTER TABLE `kittens` DROP COLUMN `hand_feeding`;
