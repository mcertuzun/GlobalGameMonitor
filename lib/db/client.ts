import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import * as schema from "./schema";
import path from "path";
import fs from "fs";

const dataDir = path.join(process.cwd(), "data");
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, "ggm.db");
const sqlite = new Database(dbPath);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

export const db = drizzle(sqlite, { schema });
export { sqlite };

// Auto-run migrations on first import
try {
  migrate(db, { migrationsFolder: path.join(process.cwd(), "lib/db/migrations") });
} catch (e) {
  // Migrations already applied or migration folder issue — safe to ignore
}

// Auto-start scheduler if previously enabled (check persisted state)
import("@/lib/scheduler").then((mod) => mod.initScheduler()).catch(() => {});
