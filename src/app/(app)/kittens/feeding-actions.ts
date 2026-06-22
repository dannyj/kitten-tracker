"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { feedings, FEEDING_QUALITIES, kittens } from "@/db/schema";
import { requireUser } from "@/lib/auth/guard";
import { FEEDING_EDIT_WINDOW_MS, FEEDING_MAX_ML, FEEDING_MIN_ML } from "@/lib/constants";
import { formValues, type FormState } from "@/lib/forms";

const fedAtSchema = z
  .string()
  .min(1, "Feeding time is required")
  .transform((s) => new Date(s))
  .refine((d) => !Number.isNaN(d.getTime()), "Invalid feeding time")
  .refine((d) => d.getTime() <= Date.now() + 5 * 60 * 1000, "Feeding time can't be in the future")
  .refine((d) => d.getFullYear() >= 2000, "Feeding time looks wrong");

const amountSchema = z.coerce
  .number()
  .min(FEEDING_MIN_ML, `Amount must be at least ${FEEDING_MIN_ML} ml`)
  .max(FEEDING_MAX_ML, `Amount must be at most ${FEEDING_MAX_ML} ml`);

// Radix Select can't carry an empty value, so the UI sends "none" for "no
// quality recorded"; treat that (and "") as absent.
const qualitySchema = z.preprocess(
  (v) => (v === "none" || v === "" ? undefined : v),
  z.enum(FEEDING_QUALITIES).optional(),
);
const formulaSchema = z.string().trim().max(100).optional().or(z.literal(""));
const noteSchema = z.string().trim().max(500).optional().or(z.literal(""));

function revalidateFeeding(kittenId: number) {
  revalidatePath(`/kittens/${kittenId}`);
  revalidatePath("/"); // dashboard feeding-due panel
}

const addFeedingSchema = z.object({
  kittenId: z.coerce.number().int().positive(),
  fedAt: fedAtSchema,
  amountMl: amountSchema,
  formula: formulaSchema,
  quality: qualitySchema,
  note: noteSchema,
});

export async function addFeeding(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireUser();
  const parsed = addFeedingSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message, values: formValues(formData) };
  }
  const kitten = db.select().from(kittens).where(eq(kittens.id, parsed.data.kittenId)).get();
  if (!kitten) return { error: "Kitten not found" };
  // Feeds are only logged for hand-fed kittens (the UI is hidden otherwise).
  if (kitten.feedingMethod !== "hand") return { error: "This kitten isn't marked as hand-fed." };

  db.insert(feedings)
    .values({
      kittenId: parsed.data.kittenId,
      fedAt: parsed.data.fedAt,
      amountMl: parsed.data.amountMl,
      formula: parsed.data.formula || null,
      quality: parsed.data.quality ?? null,
      note: parsed.data.note || null,
    })
    .run();
  revalidateFeeding(kitten.id);
  return null;
}

const updateFeedingSchema = z.object({
  feedingId: z.coerce.number().int().positive(),
  fedAt: fedAtSchema,
  amountMl: amountSchema,
  formula: formulaSchema,
  quality: qualitySchema,
  note: noteSchema,
});

export async function updateFeeding(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireUser();
  const parsed = updateFeedingSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message, values: formValues(formData) };
  }
  const entry = db.select().from(feedings).where(eq(feedings.id, parsed.data.feedingId)).get();
  if (!entry) return { error: "Feed entry not found" };
  if (Date.now() - entry.createdAt.getTime() > FEEDING_EDIT_WINDOW_MS) {
    return { error: "This entry is locked (older than 15 minutes). Add a new entry instead." };
  }

  db.update(feedings)
    .set({
      fedAt: parsed.data.fedAt,
      amountMl: parsed.data.amountMl,
      formula: parsed.data.formula || null,
      quality: parsed.data.quality ?? null,
      note: parsed.data.note || null,
    })
    .where(eq(feedings.id, parsed.data.feedingId))
    .run();
  revalidateFeeding(entry.kittenId);
  return null;
}

export async function deleteFeeding(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireUser();
  const id = z.coerce.number().int().positive().safeParse(formData.get("feedingId"));
  if (!id.success) return { error: "Invalid entry" };
  const entry = db.select().from(feedings).where(eq(feedings.id, id.data)).get();
  if (!entry) return { error: "Feed entry not found" };
  if (Date.now() - entry.createdAt.getTime() > FEEDING_EDIT_WINDOW_MS) {
    return { error: "This entry is locked (older than 15 minutes)." };
  }

  db.delete(feedings).where(eq(feedings.id, id.data)).run();
  revalidateFeeding(entry.kittenId);
  return null;
}

const intervalSchema = z.object({
  kittenId: z.coerce.number().int().positive(),
  feedingIntervalMinutes: z.coerce
    .number()
    .int()
    .min(30, "Interval must be at least 30 minutes")
    .max(720, "Interval must be at most 12 hours"),
});

export async function updateFeedingInterval(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireUser();
  const parsed = intervalSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }
  const kitten = db.select().from(kittens).where(eq(kittens.id, parsed.data.kittenId)).get();
  if (!kitten) return { error: "Kitten not found" };

  db.update(kittens)
    .set({ feedingIntervalMinutes: parsed.data.feedingIntervalMinutes })
    .where(eq(kittens.id, parsed.data.kittenId))
    .run();
  revalidateFeeding(kitten.id);
  return null;
}
