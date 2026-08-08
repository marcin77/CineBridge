import {
  pgTable,
  serial,
  text,
  varchar,
  integer,
  real,
  boolean,
  timestamp,
  index,
} from "drizzle-orm/pg-core";

// ---------------------------------------------------------------------------
// Import batches – one row per uploaded Filmweb (or future source) export.
// ---------------------------------------------------------------------------
export const importBatches = pgTable("import_batches", {
  id: serial("id").primaryKey(),
  source: varchar("source", { length: 32 }).notNull().default("filmweb"),
  filename: varchar("filename", { length: 255 }).notNull(),
  category: varchar("category", { length: 32 }).notNull().default("watched"), // watched | watchlist | favorite | list
  status: varchar("status", { length: 32 }).notNull().default("uploaded"), // uploaded|ready|completed
  totalItems: integer("total_items").notNull().default(0),
  matchedItems: integer("matched_items").notNull().default(0),
  unmatchedItems: integer("unmatched_items").notNull().default(0),
  syncedItems: integer("synced_items").notNull().default(0),
  errorItems: integer("error_items").notNull().default(0),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// Individual media items belonging to an import batch.
// ---------------------------------------------------------------------------
export const mediaItems = pgTable(
  "media_items",
  {
    id: serial("id").primaryKey(),
    importBatchId: integer("import_batch_id")
      .notNull()
      .references(() => importBatches.id, { onDelete: "cascade" }),
    source: varchar("source", { length: 32 }).notNull().default("filmweb"),
    sourceId: varchar("source_id", { length: 64 }),
    category: varchar("category", { length: 32 }).notNull().default("watched"),
    type: varchar("type", { length: 16 }).notNull().default("movie"), // movie | show
    title: text("title").notNull(),
    originalTitle: text("original_title"),
    year: integer("year"),
    userRating: integer("user_rating"),
    ratedAt: timestamp("rated_at", { withTimezone: true }),
    watchedAt: timestamp("watched_at", { withTimezone: true }),
    comment: text("comment"),
    listName: varchar("list_name", { length: 255 }),

    imdbId: varchar("imdb_id", { length: 32 }),
    tmdbId: varchar("tmdb_id", { length: 32 }),
    matchedTitle: text("matched_title"),
    matchedYear: integer("matched_year"),

    matchStatus: varchar("match_status", { length: 24 }).notNull().default("ready"), // ready|skipped

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("media_items_batch_idx").on(table.importBatchId),
    index("media_items_match_status_idx").on(table.matchStatus),
  ],
);

// ---------------------------------------------------------------------------
// Trakt accounts (optional, single-user self-hosted)
// ---------------------------------------------------------------------------
export const traktAccounts = pgTable("trakt_accounts", {
  id: serial("id").primaryKey(),
  traktUsername: varchar("trakt_username", { length: 255 }),
  accessToken: text("access_token").notNull(),
  refreshToken: text("refresh_token").notNull(),
  scope: varchar("scope", { length: 64 }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  connectedAt: timestamp("connected_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// Sync log – optional audit trail
// ---------------------------------------------------------------------------
export const syncLogs = pgTable(
  "sync_logs",
  {
    id: serial("id").primaryKey(),
    importBatchId: integer("import_batch_id").references(() => importBatches.id, {
      onDelete: "cascade",
    }),
    mediaItemId: integer("media_item_id").references(() => mediaItems.id, {
      onDelete: "cascade",
    }),
    action: varchar("action", { length: 32 }).notNull(),
    status: varchar("status", { length: 16 }).notNull(),
    message: text("message"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("sync_logs_batch_idx").on(table.importBatchId)],
);

// ---------------------------------------------------------------------------
// Trakt id resolution cache
// ---------------------------------------------------------------------------
export const traktMatchCache = pgTable("trakt_match_cache", {
  id: serial("id").primaryKey(),
  cacheKey: varchar("cache_key", { length: 512 }).notNull().unique(),
  type: varchar("type", { length: 16 }).notNull(),
  imdbId: varchar("imdb_id", { length: 32 }),
  tmdbId: varchar("tmdb_id", { length: 32 }),
  traktId: integer("trakt_id"),
  matchedTitle: text("matched_title"),
  matchedYear: integer("matched_year"),
  confidence: integer("confidence").notNull(),
  score: real("score"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
