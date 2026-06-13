"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { alertSettings, scheduleTemplates } from "@/db/schema";
import { requireUser } from "@/lib/auth/guard";
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
  await requireUser();
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
  await requireUser();
  persist(DEFAULT_ALERT_SETTINGS);
}

// --- Schedule templates ---

const weeks = (label: string) => z.coerce.number().positive(`${label} must be positive`).max(104);
const templateSchema = z.object({
  firstWeeks: weeks("First dose age"),
  everyWeeks: weeks("Booster interval"),
  untilWeeks: weeks("Until age"),
});

function revalidateMedical() {
  revalidatePath("/settings");
  revalidatePath("/"); // dashboard medical-due panel reads templates
}

export async function saveScheduleTemplates(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireUser();
  const existing = db
    .select({ vaccineType: scheduleTemplates.vaccineType })
    .from(scheduleTemplates)
    .all();

  const updates: { vaccineType: string; values: z.infer<typeof templateSchema> }[] = [];
  for (const { vaccineType } of existing) {
    const parsed = templateSchema.safeParse({
      firstWeeks: formData.get(`${vaccineType}__firstWeeks`),
      everyWeeks: formData.get(`${vaccineType}__everyWeeks`),
      untilWeeks: formData.get(`${vaccineType}__untilWeeks`),
    });
    if (!parsed.success) return { error: `${vaccineType}: ${parsed.error.issues[0].message}` };
    if (parsed.data.firstWeeks > parsed.data.untilWeeks) {
      return { error: `${vaccineType}: first dose age can't be later than the "until" age.` };
    }
    updates.push({ vaccineType, values: parsed.data });
  }

  db.transaction((tx) => {
    for (const u of updates) {
      tx.update(scheduleTemplates)
        .set(u.values)
        .where(eq(scheduleTemplates.vaccineType, u.vaccineType))
        .run();
    }
  });
  revalidateMedical();
  return null;
}

export async function resetScheduleTemplates(): Promise<void> {
  await requireUser();
  db.transaction((tx) => {
    for (const tpl of DEFAULT_SCHEDULE_TEMPLATES as ScheduleTemplate[]) {
      tx.update(scheduleTemplates)
        .set({ firstWeeks: tpl.firstWeeks, everyWeeks: tpl.everyWeeks, untilWeeks: tpl.untilWeeks })
        .where(eq(scheduleTemplates.vaccineType, tpl.vaccineType))
        .run();
    }
  });
  revalidateMedical();
}
