"use server";

import { eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { kittens, weightEntries } from "@/db/schema";
import { requireUser } from "@/lib/auth/guard";
import type { WeighFeedback } from "@/lib/alerts";
import { WEIGHT_EDIT_WINDOW_MS, WEIGHT_MAX_G, WEIGHT_MIN_G } from "@/lib/constants";
import { formValues, type FormState } from "@/lib/forms";
import { getAlertSettings } from "@/lib/settings";
import { weighFeedback } from "@/lib/weight-data";

// The client pins the datetime-local value to an absolute ISO instant (with
// timezone) before submitting, so new Date() parses it the same regardless of
// the server's timezone. Reject the unparseable, far-future, and absurd-past.
const weighedAtSchema = z
  .string()
  .min(1, "Weighing time is required")
  .transform((s) => new Date(s))
  .refine((d) => !Number.isNaN(d.getTime()), "Invalid weighing time")
  .refine((d) => d.getTime() <= Date.now() + 5 * 60 * 1000, "Weighing time can't be in the future")
  .refine((d) => d.getFullYear() >= 2000, "Weighing time looks wrong");

const weightGramsSchema = z.coerce
  .number()
  .int("Weight must be a whole number of grams")
  .min(WEIGHT_MIN_G, `Weight must be at least ${WEIGHT_MIN_G} g`)
  .max(WEIGHT_MAX_G, `Weight must be at most ${WEIGHT_MAX_G} g`);

const noteSchema = z.string().trim().max(500).optional().or(z.literal(""));

const addWeightSchema = z.object({
  kittenId: z.coerce.number().int().positive(),
  weighedAt: weighedAtSchema,
  weightGrams: weightGramsSchema,
  note: noteSchema,
});

function revalidateKitten(kittenId: number, litterId?: number) {
  revalidatePath(`/kittens/${kittenId}`);
  revalidatePath("/kittens");
  revalidatePath("/alerts");
  if (litterId) revalidatePath(`/litters/${litterId}`);
}

/** Success carries the instant feedback; failure mirrors {@link FormState}. */
export type AddWeightState =
  | { error: string; values?: Record<string, string> }
  | { feedback: WeighFeedback }
  | null;

export async function addWeight(
  _prev: AddWeightState,
  formData: FormData,
): Promise<AddWeightState> {
  await requireUser();
  const parsed = addWeightSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message, values: formValues(formData) };
  }
  const kitten = db.select().from(kittens).where(eq(kittens.id, parsed.data.kittenId)).get();
  if (!kitten) return { error: "Kitten not found" };

  const inserted = db
    .insert(weightEntries)
    .values({
      kittenId: parsed.data.kittenId,
      weighedAt: parsed.data.weighedAt,
      weightGrams: parsed.data.weightGrams,
      note: parsed.data.note || null,
    })
    .run();
  revalidateKitten(kitten.id, kitten.litterId);
  const feedback = weighFeedback(kitten.id, Number(inserted.lastInsertRowid), getAlertSettings());
  return feedback ? { feedback } : null;
}

export type BulkWeighState = {
  error?: string;
  /** Number of entries saved on the last successful submit. */
  saved?: number;
  /** Kitten ids that were saved — the form clears these inputs. */
  savedKittenIds?: number[];
  /** Per-kitten validation failures, keyed so the form can flag the right row. */
  failures?: { kittenId: number; message: string }[];
  /** Instant gain/loss + verdict per saved kitten, for the summary screen. */
  feedback?: ({ kittenId: number } & WeighFeedback)[];
} | null;

/**
 * Record weights for several kittens at once (a litter weigh-in). Every kitten
 * shares one weighing time; blank inputs are skipped. Valid rows are saved even
 * if other rows fail validation, so a single bad number doesn't lose the rest.
 */
export async function addWeights(
  _prev: BulkWeighState,
  formData: FormData,
): Promise<BulkWeighState> {
  await requireUser();

  const when = weighedAtSchema.safeParse(formData.get("weighedAt"));
  if (!when.success) return { error: when.error.issues[0].message };
  const litterId = z.coerce.number().int().positive().safeParse(formData.get("litterId"));

  const failures: { kittenId: number; message: string }[] = [];
  const toInsert: { kittenId: number; weightGrams: number }[] = [];

  for (const [key, value] of formData.entries()) {
    if (!key.startsWith("weight_")) continue;
    if (typeof value !== "string" || value.trim() === "") continue;
    const kittenId = Number(key.slice("weight_".length));
    if (!Number.isInteger(kittenId) || kittenId <= 0) continue;

    const grams = weightGramsSchema.safeParse(value);
    if (!grams.success) {
      failures.push({ kittenId, message: grams.error.issues[0].message });
      continue;
    }
    toInsert.push({ kittenId, weightGrams: grams.data });
  }

  if (toInsert.length === 0) {
    return failures.length > 0
      ? { failures, saved: 0, savedKittenIds: [] }
      : { error: "Enter at least one weight." };
  }

  const ids = toInsert.map((r) => r.kittenId);
  const found = new Set(
    db
      .select({ id: kittens.id })
      .from(kittens)
      .where(inArray(kittens.id, ids))
      .all()
      .map((k) => k.id),
  );

  const savedKittenIds: number[] = [];
  const savedEntries: { kittenId: number; entryId: number }[] = [];
  for (const row of toInsert) {
    if (!found.has(row.kittenId)) {
      failures.push({ kittenId: row.kittenId, message: "Kitten not found" });
      continue;
    }
    const inserted = db
      .insert(weightEntries)
      .values({
        kittenId: row.kittenId,
        weighedAt: when.data,
        weightGrams: row.weightGrams,
        note: null,
      })
      .run();
    revalidatePath(`/kittens/${row.kittenId}`);
    savedKittenIds.push(row.kittenId);
    savedEntries.push({ kittenId: row.kittenId, entryId: Number(inserted.lastInsertRowid) });
  }

  revalidatePath("/kittens");
  revalidatePath("/alerts");
  if (litterId.success) revalidatePath(`/litters/${litterId.data}`);

  const settings = getAlertSettings();
  const feedback = savedEntries.flatMap(({ kittenId, entryId }) => {
    const fb = weighFeedback(kittenId, entryId, settings);
    return fb ? [{ kittenId, ...fb }] : [];
  });

  return { saved: savedKittenIds.length, savedKittenIds, failures, feedback };
}

const updateWeightSchema = z.object({
  weightId: z.coerce.number().int().positive(),
  weighedAt: weighedAtSchema,
  weightGrams: weightGramsSchema,
  note: noteSchema,
});

export async function updateWeight(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireUser();
  const parsed = updateWeightSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message, values: formValues(formData) };
  }
  const entry = db
    .select()
    .from(weightEntries)
    .where(eq(weightEntries.id, parsed.data.weightId))
    .get();
  if (!entry) return { error: "Weight entry not found" };
  if (Date.now() - entry.createdAt.getTime() > WEIGHT_EDIT_WINDOW_MS) {
    return { error: "This entry is locked (older than 15 minutes). Add a new entry instead." };
  }

  db.update(weightEntries)
    .set({
      weighedAt: parsed.data.weighedAt,
      weightGrams: parsed.data.weightGrams,
      note: parsed.data.note || null,
    })
    .where(eq(weightEntries.id, parsed.data.weightId))
    .run();
  revalidateKitten(entry.kittenId);
  return null;
}

export async function deleteWeight(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireUser();
  const id = z.coerce.number().int().positive().safeParse(formData.get("weightId"));
  if (!id.success) return { error: "Invalid entry" };
  const entry = db.select().from(weightEntries).where(eq(weightEntries.id, id.data)).get();
  if (!entry) return { error: "Weight entry not found" };
  if (Date.now() - entry.createdAt.getTime() > WEIGHT_EDIT_WINDOW_MS) {
    return { error: "This entry is locked (older than 15 minutes)." };
  }

  db.delete(weightEntries).where(eq(weightEntries.id, id.data)).run();
  revalidateKitten(entry.kittenId);
  return null;
}
