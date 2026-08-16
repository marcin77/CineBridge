CREATE TABLE "import_batches" (
	"id" serial PRIMARY KEY NOT NULL,
	"source" varchar(32) DEFAULT 'filmweb' NOT NULL,
	"filename" varchar(255) NOT NULL,
	"category" varchar(32) DEFAULT 'watched' NOT NULL,
	"status" varchar(32) DEFAULT 'uploaded' NOT NULL,
	"total_items" integer DEFAULT 0 NOT NULL,
	"matched_items" integer DEFAULT 0 NOT NULL,
	"unmatched_items" integer DEFAULT 0 NOT NULL,
	"synced_items" integer DEFAULT 0 NOT NULL,
	"error_items" integer DEFAULT 0 NOT NULL,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "media_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"import_batch_id" integer NOT NULL,
	"source" varchar(32) DEFAULT 'filmweb' NOT NULL,
	"source_id" varchar(64),
	"category" varchar(32) DEFAULT 'watched' NOT NULL,
	"type" varchar(16) DEFAULT 'movie' NOT NULL,
	"title" text NOT NULL,
	"original_title" text,
	"year" integer,
	"user_rating" integer,
	"rated_at" timestamp with time zone,
	"watched_at" timestamp with time zone,
	"comment" text,
	"list_name" varchar(255),
	"imdb_id" varchar(32),
	"tmdb_id" varchar(32),
	"matched_title" text,
	"matched_year" integer,
	"match_confidence" integer,
	"match_status" varchar(24) DEFAULT 'ready' NOT NULL,
	"trakt_id" integer,
	"trakt_type" varchar(16),
	"synced_to_trakt" boolean DEFAULT false NOT NULL,
	"sync_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sync_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"import_batch_id" integer,
	"media_item_id" integer,
	"action" varchar(32) NOT NULL,
	"status" varchar(16) NOT NULL,
	"message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trakt_accounts" (
	"id" serial PRIMARY KEY NOT NULL,
	"trakt_username" varchar(255),
	"access_token" text NOT NULL,
	"refresh_token" text NOT NULL,
	"scope" varchar(64),
	"expires_at" timestamp with time zone NOT NULL,
	"connected_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trakt_match_cache" (
	"id" serial PRIMARY KEY NOT NULL,
	"cache_key" varchar(512) NOT NULL,
	"type" varchar(16) NOT NULL,
	"imdb_id" varchar(32),
	"tmdb_id" varchar(32),
	"trakt_id" integer,
	"matched_title" text,
	"matched_year" integer,
	"confidence" integer NOT NULL,
	"score" real,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "trakt_match_cache_cache_key_unique" UNIQUE("cache_key")
);
--> statement-breakpoint
ALTER TABLE "media_items" ADD CONSTRAINT "media_items_import_batch_id_import_batches_id_fk" FOREIGN KEY ("import_batch_id") REFERENCES "public"."import_batches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sync_logs" ADD CONSTRAINT "sync_logs_import_batch_id_import_batches_id_fk" FOREIGN KEY ("import_batch_id") REFERENCES "public"."import_batches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sync_logs" ADD CONSTRAINT "sync_logs_media_item_id_media_items_id_fk" FOREIGN KEY ("media_item_id") REFERENCES "public"."media_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "media_items_batch_idx" ON "media_items" USING btree ("import_batch_id");--> statement-breakpoint
CREATE INDEX "media_items_match_status_idx" ON "media_items" USING btree ("match_status");--> statement-breakpoint
CREATE INDEX "sync_logs_batch_idx" ON "sync_logs" USING btree ("import_batch_id");