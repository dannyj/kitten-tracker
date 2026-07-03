"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { kittenCareLogs, kittens, KITTEN_CARE_CATEGORIES } from "@/db/schema";
import { requireUser } from "@/lib/auth/guard";
import { HEALTH_LOG_EDIT_WINDOW_MS } from "@/lib/constants";
import { formValues, type FormState } from "@/lib/forms";

const addCareLogSchema = z.object({
  kittenId: z.coerce.number().int().positive(),
  category: z.enum(KITTEN_CARE_CATEGORIES),
  entry: z.string().trim().min(1, "Entry text is required").max(5000),
});

export async function addCareLog(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireUser();
  const parsed = addCareLogSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message, values: formValues(formData) };
  }
  const kitten = db.select().from(kittens).where(eq(kittens.id, parsed.data.kittenId)).get();
  if (!kitten) return { error: "Kitten not found" };

  db.insert(kittenCareLogs)
    .values({
      kittenId: parsed.data.kittenId,
      category: parsed.data.category,
      entry: parsed.data.entry,
    })
    .run();
  revalidatePath(`/kittens/${parsed.data.kittenId}`);
  return null;
}

const updateCareLogSchema = z.object({
  logId: z.coerce.number().int().positive(),
  category: z.enum(KITTEN_CARE_CATEGORIES),
  entry: z.string().trim().min(1, "Entry text is required").max(5000),
});

export async function updateCareLog(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireUser();
  const parsed = updateCareLogSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }
  const log = db
    .select()
    .from(kittenCareLogs)
    .where(eq(kittenCareLogs.id, parsed.data.logId))
    .get();
  if (!log) return { error: "Entry not found" };

  // Append-only after the typo window: corrections become new entries.
  if (Date.now() - log.loggedAt.getTime() > HEALTH_LOG_EDIT_WINDOW_MS) {
    return { error: "This entry is locked (older than 15 minutes). Add a new entry instead." };
  }

  db.update(kittenCareLogs)
    .set({ category: parsed.data.category, entry: parsed.data.entry })
    .where(eq(kittenCareLogs.id, parsed.data.logId))
    .run();
  revalidatePath(`/kittens/${log.kittenId}`);
  return null;
}
