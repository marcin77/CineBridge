import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import Database from "better-sqlite3";
import * as schema from "./schema";
import path from "path";
import fs from "fs";

const dbPath =
  process.env.DATABASE_PATH ?? path.join(process.cwd(), "data", "cinebridge.db");

const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const sqlite = new Database(dbPath);

const isBuildPhase = process.env.SKIP_DB_MIGRATIONS === "1";

if (!isBuildPhase) {
  sqlite.pragma("journal_mode = WAL");
}

sqlite.pragma("foreign_keys = ON");

export const db = drizzle(sqlite, { schema });

const migrationsFolder =
  process.env.MIGRATIONS_PATH ?? path.join(process.cwd(), "drizzle");

if (!isBuildPhase) {
  try {
    if (fs.existsSync(/*turbopackIgnore: true*/ migrationsFolder)) {
      migrate(db, { migrationsFolder });
      console.log("[DB] Migracje zastosowane pomyślnie.");
    } else {
      console.warn("[DB] Folder migracji nie istnieje:", migrationsFolder);
    }
  } catch (err: any) {
    if (err?.cause?.code === "SQLITE_ERROR" && err?.cause?.message?.includes("already exists")) {
      console.log("[DB] Tabele już istnieją, pomijam migracje.");
    } else {
      console.error("[DB] Błąd migracji:", err);
    }
  }
} else {
  console.log("[DB] SKIP_DB_MIGRATIONS=1 — pomijam WAL i migracje (faza build).");
}