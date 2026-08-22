import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import Database from "better-sqlite3";
import * as schema from "./schema";
import path from "path";
import fs from "fs";

const dbPath =
  process.env.DATABASE_PATH ?? path.join(process.cwd(), "data", "cinebridge.db");

// Upewnij się, że folder docelowy istnieje (ważne w Electronie - userData)
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const sqlite = new Database(dbPath);

sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

export const db = drizzle(sqlite, { schema });

// ─── Automatyczne migracje przy starcie ──────────────────────────────────────
const migrationsFolder =
  process.env.MIGRATIONS_PATH ?? path.join(process.cwd(), "drizzle");

try {
  if (fs.existsSync(/*turbopackIgnore: true*/ migrationsFolder)) {
    migrate(db, { migrationsFolder });
    console.log("[DB] Migracje zastosowane pomyślnie.");
  } else {
    console.warn("[DB] Folder migracji nie istnieje:", migrationsFolder);
  }
} catch (err: any) {
  // Ignoruj błąd "already exists" - tabele już istnieją
  if (err?.cause?.code === "SQLITE_ERROR" && err?.cause?.message?.includes("already exists")) {
    console.log("[DB] Tabele już istnieją, pomijam migracje.");
  } else {
    console.error("[DB] Błąd migracji:", err);
  }
}