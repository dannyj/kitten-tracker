import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import * as schema from "./schema";

const databasePath = process.env.DATABASE_PATH ?? "./data/kittens.db";

// Reuse one connection across hot reloads in dev and across route handlers in prod.
const globalForDb = globalThis as unknown as { __kittenDb?: ReturnType<typeof createDb> };

function createDb() {
  fs.mkdirSync(path.dirname(databasePath), { recursive: true });
  const sqlite = new Database(databasePath);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  return drizzle(sqlite, { schema });
}

export const db = globalForDb.__kittenDb ?? (globalForDb.__kittenDb = createDb());
