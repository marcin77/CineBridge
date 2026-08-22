CREATE TABLE `import_batches` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`source` text DEFAULT 'filmweb' NOT NULL,
	`filename` text NOT NULL,
	`category` text DEFAULT 'watched' NOT NULL,
	`status` text DEFAULT 'uploaded' NOT NULL,
	`total_items` integer DEFAULT 0 NOT NULL,
	`matched_items` integer DEFAULT 0 NOT NULL,
	`unmatched_items` integer DEFAULT 0 NOT NULL,
	`synced_items` integer DEFAULT 0 NOT NULL,
	`error_items` integer DEFAULT 0 NOT NULL,
	`error_message` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `media_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`import_batch_id` integer NOT NULL,
	`source` text DEFAULT 'filmweb' NOT NULL,
	`source_id` text,
	`category` text DEFAULT 'watched' NOT NULL,
	`type` text DEFAULT 'movie' NOT NULL,
	`title` text NOT NULL,
	`original_title` text,
	`year` integer,
	`user_rating` integer,
	`rated_at` text,
	`watched_at` text,
	`comment` text,
	`list_name` text,
	`imdb_id` text,
	`tmdb_id` text,
	`matched_title` text,
	`matched_year` integer,
	`match_confidence` integer,
	`match_status` text DEFAULT 'ready' NOT NULL,
	`trakt_id` integer,
	`trakt_type` text,
	`synced_to_trakt` integer DEFAULT false NOT NULL,
	`sync_error` text,
	`synced_at` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`import_batch_id`) REFERENCES `import_batches`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `media_items_batch_idx` ON `media_items` (`import_batch_id`);--> statement-breakpoint
CREATE INDEX `media_items_match_status_idx` ON `media_items` (`match_status`);--> statement-breakpoint
CREATE TABLE `sync_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`import_batch_id` integer,
	`media_item_id` integer,
	`action` text NOT NULL,
	`status` text NOT NULL,
	`message` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`import_batch_id`) REFERENCES `import_batches`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`media_item_id`) REFERENCES `media_items`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `sync_logs_batch_idx` ON `sync_logs` (`import_batch_id`);--> statement-breakpoint
CREATE TABLE `trakt_accounts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`trakt_username` text,
	`access_token` text NOT NULL,
	`refresh_token` text NOT NULL,
	`scope` text,
	`expires_at` text NOT NULL,
	`connected_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `trakt_match_cache` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`cache_key` text NOT NULL,
	`type` text NOT NULL,
	`imdb_id` text,
	`tmdb_id` text,
	`trakt_id` integer,
	`matched_title` text,
	`matched_year` integer,
	`confidence` integer NOT NULL,
	`score` real,
	`created_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `trakt_match_cache_cache_key_unique` ON `trakt_match_cache` (`cache_key`);