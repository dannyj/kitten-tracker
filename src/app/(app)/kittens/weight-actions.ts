"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { kittens, weightEntries } from "@/db/schema";
import { requireUser } from "@/lib/auth/guard";
import { WEIGHT_EDIT_WINDOW_MS, WEIGHT_MAX_G, WEIGHT_MIN_G } from "@/lib/constants";
import { formValues, type FormState } from "@/lib/forms";

// datetime-local strings ("YYYY-MM-DDTHH:mm") are local time; new Date() parses
// them as such. Reject the unparseable, the far-future, and the absurd-past.
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

export async function addWeight(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireUser();
  const parsed = addWeightSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message, values: formValues(formData) };
  }
  const kitten = db.select().from(kittens).where(eq(kittens.id, parsed.data.kittenId)).get();
  if (!kitten) return { error: "Kitten not found" };

  db.insert(weightEntries)
    .values({
      kittenId: parsed.data.kittenId,
      weighedAt: parsed.data.weighedAt,
      weightGrams: parsed.data.weightGrams,
      note: parsed.data.note || null,
    })
    .run();
  revalidateKitten(kitten.id, kitten.litterId);
  return null;
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
