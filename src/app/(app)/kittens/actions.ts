"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { FEEDING_METHODS, kittens, KITTEN_STATUSES, litters, statusHistory } from "@/db/schema";
import { adopterSchema, markKittenAdopted } from "@/lib/adoption";
import { requireAdmin, requireUser } from "@/lib/auth/guard";
import { formValues, type FormState } from "@/lib/forms";
import { isForwardTransition } from "@/lib/status";

const kittenSchema = z.object({
  litterId: z.coerce.number().int().positive("A litter is required"),
  name: z.string().trim().min(1, "Name is required").max(100),
  shelterNumber: z.string().trim().max(50).optional().or(z.literal("")),
  sex: z.enum(["male", "female", "unknown"]),
  color: z.string().trim().max(200).optional().or(z.literal("")),
  birthDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date")
    .optional()
    .or(z.literal("")),
  birthDateEstimated: z
    .string()
    .optional()
    .transform((v) => v === "on" || v === "true"),
  feedingMethod: z.enum(FEEDING_METHODS).default("mother"),
  feedingIntervalMinutes: z.coerce
    .number()
    .int()
    .min(30, "Feeding interval must be at least 30 minutes")
    .max(720, "Feeding interval must be at most 12 hours")
    .optional(),
});

function kittenPayload(parsed: z.infer<typeof kittenSchema>) {
  return {
    litterId: parsed.litterId,
    name: parsed.name,
    shelterNumber: parsed.shelterNumber || null,
    sex: parsed.sex,
    color: parsed.color || null,
    birthDate: parsed.birthDate || null,
    birthDateEstimated: parsed.birthDateEstimated,
    feedingMethod: parsed.feedingMethod,
    feedingIntervalMinutes:
      parsed.feedingMethod === "hand" ? (parsed.feedingIntervalMinutes ?? 120) : 120,
  };
}

function isUniqueShelterNumberError(err: unknown): boolean {
  // better-sqlite3: "UNIQUE constraint failed: kittens.shelter_number"
  return err instanceof Error && err.message.includes("kittens.shelter_number");
}

export async function createKitten(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireUser();
  const parsed = kittenSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message, values: formValues(formData) };
  }
  const litter = db.select().from(litters).where(eq(litters.id, parsed.data.litterId)).get();
  if (!litter) return { error: "Litter not found", values: formValues(formData) };

  let kittenId: number;
  try {
    kittenId = db.transaction((tx) => {
      const inserted = tx
        .insert(kittens)
        .values(kittenPayload(parsed.data))
        .returning({ id: kittens.id })
        .get();
      tx.insert(statusHistory)
        .values({ kittenId: inserted.id, status: "intake", note: "Registered" })
        .run();
      return inserted.id;
    });
  } catch (err) {
    if (isUniqueShelterNumberError(err)) {
      return {
        error: `Shelter number "${parsed.data.shelterNumber}" is already in use.`,
        values: formValues(formData),
      };
    }
    throw err;
  }
  revalidatePath("/kittens");
  redirect(`/kittens/${kittenId}`);
}

export async function updateKitten(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireUser();
  const id = z.coerce.number().int().positive().safeParse(formData.get("id"));
  if (!id.success) return { error: "Invalid kitten" };
  const existing = db.select().from(kittens).where(eq(kittens.id, id.data)).get();
  if (!existing) return { error: "Kitten not found" };

  const parsed = kittenSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message, values: formValues(formData) };
  }
  try {
    db.update(kittens).set(kittenPayload(parsed.data)).where(eq(kittens.id, id.data)).run();
  } catch (err) {
    if (isUniqueShelterNumberError(err)) {
      return {
        error: `Shelter number "${parsed.data.shelterNumber}" is already in use.`,
        values: formValues(formData),
      };
    }
    throw err;
  }
  revalidatePath("/kittens");
  revalidatePath(`/kittens/${id.data}`);
  redirect(`/kittens/${id.data}`);
}

const baseStatusChange = z.object({
  kittenId: z.coerce.number().int().positive(),
  toStatus: z.enum(KITTEN_STATUSES),
  note: z.string().trim().max(2000).optional().or(z.literal("")),
});

export async function changeKittenStatus(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireUser();
  const parsed = baseStatusChange.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message, values: formValues(formData) };
  }
  const { kittenId, toStatus, note } = parsed.data;

  const kitten = db.select().from(kittens).where(eq(kittens.id, kittenId)).get();
  if (!kitten) return { error: "Kitten not found" };
  if (kitten.status === toStatus) return { error: "Kitten already has this status" };

  const forward = isForwardTransition(kitten.status, toStatus);
  if (!forward && !note) {
    return {
      error: "Moving backwards in the pipeline requires a note explaining why.",
      values: formValues(formData),
    };
  }

  let adopterData: z.infer<typeof adopterSchema> | null = null;
  if (toStatus === "adopted") {
    // Capturing adopter PII — admin only, matching the visibility rule.
    await requireAdmin();
    const adopterParsed = adopterSchema.safeParse(Object.fromEntries(formData));
    if (!adopterParsed.success) {
      return { error: adopterParsed.error.issues[0].message, values: formValues(formData) };
    }
    adopterData = adopterParsed.data;
  }

  db.transaction((tx) => {
    if (adopterData) {
      // markKittenAdopted writes the status move, status_history and adopter row.
      markKittenAdopted(tx, kittenId, adopterData, note);
    } else {
      tx.update(kittens).set({ status: toStatus }).where(eq(kittens.id, kittenId)).run();
      tx.insert(statusHistory)
        .values({ kittenId, status: toStatus, note: note || null })
        .run();
    }
  });

  revalidatePath("/kittens");
  revalidatePath(`/kittens/${kittenId}`);
  return null;
}
