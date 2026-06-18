"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { alertSettings, scheduleTemplates } from "@/db/schema";
import { requireAdmin } from "@/lib/auth/guard";
import { DEFAULT_ALERT_SETTINGS } from "@/lib/alerts";
import type { FormState } from "@/lib/forms";
import { DEFAULT_SCHEDULE_TEMPLATES, type ScheduleTemplate } from "@/lib/schedule";
import { ALERT_SETTING_KEYS } from "@/lib/settings";

const alertSettingsSchema = z.object({
  minDailyGainG: z.coerce.number().positive().max(200),
  targetDailyGainG: z.coerce.number().positive().max(200),
  lossPctUrgent: z.coerce.number().positive().max(100),
  noGainHoursUrgent: z.coerce.number().int().positive().max(168),
});

function persist(values: z.infer<typeof alertSettingsSchema>) {
  db.transaction((tx) => {
    for (const [field, key] of Object.entries(ALERT_SETTING_KEYS)) {
      const value = String(values[field as keyof typeof values]);
      tx.insert(alertSettings)
        .values({ key, value })
        .onConflictDoUpdate({ target: alertSettings.key, set: { value } })
        .run();
    }
  });
  // Alerts are evaluated on read everywhere — refresh the surfaces.
  revalidatePath("/alerts");
  revalidatePath("/kittens");
  revalidatePath("/settings");
}

export async function saveAlertSettings(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const parsed = alertSettingsSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }
  if (parsed.data.minDailyGainG > parsed.data.targetDailyGainG) {
    return { error: "Warning floor can't be higher than the target gain." };
  }
  persist(parsed.data);
  return null;
}

export async function resetAlertSettings(): Promise<void> {
  await requireAdmin();
  persist(DEFAULT_ALERT_SETTINGS);
}

// --- Schedule templates ---
//
// Kitten templates are birth-date driven, so all three week values matter and
// must be positive. Adult-cat (mother) templates are record driven: only the
// booster interval is meaningful, and 0 means "one-off / not routinely
// recurring" (microchip, rabies for indoor NL cats, FeLV). Form field names are
// namespaced by subject (deworming/flea/FVRCP exist for both subjects).

const positiveWeeks = (label: string) =>
  z.coerce.number().positive(`${label} must be positive`).max(104);
const kittenTemplateSchema = z.object({
  firstWeeks: positiveWeeks("First dose age"),
  everyWeeks: positiveWeeks("Booster interval"),
  untilWeeks: positiveWeeks("Until age"),
});
// 0 allowed = one-off; first/until are unused for adults and stay at 0.
const motherEveryWeeks = z.coerce
  .number()
  .min(0, "Interval can't be negative")
  .max(104, "Interval is too large");

function revalidateMedical() {
  revalidatePath("/settings");
  revalidatePath("/"); // dashboard medical-due panel reads templates
}

function field(subjectType: string, vaccineType: string, name: string) {
  return `${subjectType}__${vaccineType}__${name}`;
}

export async function saveScheduleTemplates(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAdmin();
  const existing = db
    .select({
      subjectType: scheduleTemplates.subjectType,
      vaccineType: scheduleTemplates.vaccineType,
    })
    .from(scheduleTemplates)
    .all();

  const updates: {
    subjectType: string;
    vaccineType: string;
    values: { firstWeeks?: number; everyWeeks: number; untilWeeks?: number };
  }[] = [];
  for (const { subjectType, vaccineType } of existing) {
    const label = `${vaccineType}`;
    if (subjectType === "mother") {
      const parsed = motherEveryWeeks.safeParse(formData.get(field(subjectType, vaccineType, "everyWeeks")));
      if (!parsed.success) return { error: `${label}: ${parsed.error.issues[0].message}` };
      updates.push({ subjectType, vaccineType, values: { everyWeeks: parsed.data } });
    } else {
      const parsed = kittenTemplateSchema.safeParse({
        firstWeeks: formData.get(field(subjectType, vaccineType, "firstWeeks")),
        everyWeeks: formData.get(field(subjectType, vaccineType, "everyWeeks")),
        untilWeeks: formData.get(field(subjectType, vaccineType, "untilWeeks")),
      });
      if (!parsed.success) return { error: `${label}: ${parsed.error.issues[0].message}` };
      if (parsed.data.firstWeeks > parsed.data.untilWeeks) {
        return { error: `${label}: first dose age can't be later than the "until" age.` };
      }
      updates.push({ subjectType, vaccineType, values: parsed.data });
    }
  }

  db.transaction((tx) => {
    for (const u of updates) {
      tx.update(scheduleTemplates)
        .set(u.values)
        .where(
          and(
            eq(scheduleTemplates.subjectType, u.subjectType as "kitten" | "mother"),
            eq(scheduleTemplates.vaccineType, u.vaccineType),
          ),
        )
        .run();
    }
  });
  revalidateMedical();
  return null;
}

export async function resetScheduleTemplates(): Promise<void> {
  await requireAdmin();
  db.transaction((tx) => {
    for (const tpl of DEFAULT_SCHEDULE_TEMPLATES as ScheduleTemplate[]) {
      tx.update(scheduleTemplates)
        .set({ firstWeeks: tpl.firstWeeks, everyWeeks: tpl.everyWeeks, untilWeeks: tpl.untilWeeks })
        .where(
          and(
            eq(scheduleTemplates.subjectType, tpl.subjectType),
            eq(scheduleTemplates.vaccineType, tpl.vaccineType),
          ),
        )
        .run();
    }
  });
  revalidateMedical();
}
