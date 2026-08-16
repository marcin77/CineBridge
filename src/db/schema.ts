import {
  sqliteTable,
  integer,
  text,
  real,
  index,
} from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

// ---------------------------------------------------------------------------
// Import batches
// ---------------------------------------------------------------------------
export const importBatches = sqliteTable("import_batches", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  source: text("source").notNull().default("filmweb"),
  filename: text("filename").notNull(),
  category: text("category").notNull().default("watched"),
  status: text("status").notNull().default("uploaded"),
  totalItems: integer("total_items").notNull().default(0),
  matchedItems: integer("matched_items").notNull().default(0),
  unmatchedItems: integer("unmatched_items").notNull().default(0),
  syncedItems: integer("synced_items").notNull().default(0),
  errorItems: integer("error_items").notNull().default(0),
  errorMessage: text("error_message"),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
});

// ---------------------------------------------------------------------------
// Media items
// ---------------------------------------------------------------------------
export const mediaItems = sqliteTable(
  "media_items",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    importBatchId: integer("import_batch_id")
      .notNull()
      .references(() => importBatches.id, { onDelete: "cascade" }),
    source: text("source").notNull().default("filmweb"),
    sourceId: text("source_id"),
    category: text("category").notNull().default("watched"),
    type: text("type").notNull().default("movie"),
    title: text("title").notNull(),
    originalTitle: text("original_title"),
    year: integer("year"),
    userRating: integer("user_rating"),
    ratedAt: text("rated_at"),
    watchedAt: text("watched_at"),
    comment: text("comment"),
    listName: text("list_name"),

    imdbId: text("imdb_id"),
    tmdbId: text("tmdb_id"),
    matchedTitle: text("matched_title"),
    matchedYear: integer("matched_year"),
    matchConfidence: integer("match_confidence"),
    matchStatus: text("match_status").notNull().default("ready"),

    traktId: integer("trakt_id"),
    traktType: text("trakt_type"),
    syncedToTrakt: integer("synced_to_trakt", { mode: "boolean" }).notNull().default(false),
    syncError: text("sync_error"),
    syncedAt: text("synced_at"),

    createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
    updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
  },
  (table) => [
    index("media_items_batch_idx").on(table.importBatchId),
    index("media_items_match_status_idx").on(table.matchStatus),
  ],
);

// ---------------------------------------------------------------------------
// Trakt accounts
// ---------------------------------------------------------------------------
export const traktAccounts = sqliteTable("trakt_accounts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  traktUsername: text("trakt_username"),
  accessToken: text("access_token").notNull(),
  refreshToken: text("refresh_token").notNull(),
  scope: text("scope"),
  expiresAt: text("expires_at").notNull(),
  connectedAt: text("connected_at").notNull().default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
});

// ---------------------------------------------------------------------------
// Sync logs
// ---------------------------------------------------------------------------
export const syncLogs = sqliteTable(
  "sync_logs",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    importBatchId: integer("import_batch_id").references(() => importBatches.id, {
      onDelete: "cascade",
    }),
    mediaItemId: integer("media_item_id").references(() => mediaItems.id, {
      onDelete: "cascade",
    }),
    action: text("action").notNull(),
    status: text("status").notNull(),
    message: text("message"),
    createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  },
  (table) => [index("sync_logs_batch_idx").on(table.importBatchId)],
);

// ---------------------------------------------------------------------------
// Trakt match cache
// ---------------------------------------------------------------------------
export const traktMatchCache = sqliteTable("trakt_match_cache", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  cacheKey: text("cache_key").notNull().unique(),
  type: text("type").notNull(),
  imdbId: text("imdb_id"),
  tmdbId: text("tmdb_id"),
  traktId: integer("trakt_id"),
  matchedTitle: text("matched_title"),
  matchedYear: integer("matched_year"),
  confidence: integer("confidence").notNull(),
  score: real("score"),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
});