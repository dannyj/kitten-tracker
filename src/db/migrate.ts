import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import path from "node:path";
import { DEFAULT_SCHEDULE_TEMPLATES } from "@/lib/schedule";
import { db } from "./index";
import { alertSettings, scheduleTemplates } from "./schema";

const ALERT_SETTING_DEFAULTS: Record<string, string> = {
  min_daily_gain_g: "7",
  target_daily_gain_g: "10",
  loss_pct_urgent: "5",
  no_gain_hours_urgent: "24",
};

/**
 * Applies pending migrations and seeds default settings. Idempotent — safe to
 * run on every server start (instrumentation.ts) and from CLI scripts.
 */
export function migrateAndSeed() {
  const migrationsFolder = path.join(process.cwd(), "drizzle");
  migrate(db, { migrationsFolder });

  for (const [key, value] of Object.entries(ALERT_SETTING_DEFAULTS)) {
    db.insert(alertSettings).values({ key, value }).onConflictDoNothing().run();
  }

  for (const tpl of DEFAULT_SCHEDULE_TEMPLATES) {
    db.insert(scheduleTemplates).values(tpl).onConflictDoNothing().run();
  }
}
