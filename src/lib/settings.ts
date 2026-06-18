import "server-only";

import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { alertSettings, scheduleTemplates } from "@/db/schema";
import { DEFAULT_ALERT_SETTINGS, type AlertSettings } from "@/lib/alerts";
import type { MedicalSubjectType, ScheduleTemplate } from "@/lib/schedule";

/** Maps alert_settings DB keys to the typed AlertSettings fields. */
export const ALERT_SETTING_KEYS = {
  minDailyGainG: "min_daily_gain_g",
  targetDailyGainG: "target_daily_gain_g",
  lossPctUrgent: "loss_pct_urgent",
  noGainHoursUrgent: "no_gain_hours_urgent",
} as const satisfies Record<keyof AlertSettings, string>;

/**
 * Reads alert thresholds live from the DB so edits re-evaluate on next load.
 * Missing or unparseable values fall back to the seeded defaults.
 */
export function getAlertSettings(): AlertSettings {
  const rows = db.select().from(alertSettings).all();
  const byKey = new Map(rows.map((r) => [r.key, r.value]));

  const read = (field: keyof AlertSettings): number => {
    const raw = byKey.get(ALERT_SETTING_KEYS[field]);
    const parsed = raw === undefined ? NaN : Number(raw);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_ALERT_SETTINGS[field];
  };

  return {
    minDailyGainG: read("minDailyGainG"),
    targetDailyGainG: read("targetDailyGainG"),
    lossPctUrgent: read("lossPctUrgent"),
    noGainHoursUrgent: read("noGainHoursUrgent"),
  };
}

/**
 * Schedule templates live from the DB (seeded defaults in migrate.ts). Pass a
 * subject to get just that subject's templates (kitten vs adult-cat differ).
 */
export function getScheduleTemplates(subjectType?: MedicalSubjectType): ScheduleTemplate[] {
  const base = db
    .select({
      subjectType: scheduleTemplates.subjectType,
      vaccineType: scheduleTemplates.vaccineType,
      label: scheduleTemplates.label,
      firstWeeks: scheduleTemplates.firstWeeks,
      everyWeeks: scheduleTemplates.everyWeeks,
      untilWeeks: scheduleTemplates.untilWeeks,
    })
    .from(scheduleTemplates);
  return (subjectType ? base.where(eq(scheduleTemplates.subjectType, subjectType)) : base)
    .orderBy(asc(scheduleTemplates.id))
    .all();
}
