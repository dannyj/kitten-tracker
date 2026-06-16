"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { kittens, vaccinations } from "@/db/schema";
import { requireUser } from "@/lib/auth/guard";
import { VACCINATION_EDIT_WINDOW_MS } from "@/lib/constants";
import { todayIso } from "@/lib/dates";
import { formValues, type FormState } from "@/lib/forms";

const dateIso = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date");

const baseFields = z.object({
  type: z.string().trim().min(1, "Type is required").max(50),
  givenAt: dateIso.refine((d) => d <= todayIso(), "Given date can't be in the future"),
  batchNumber: z.string().trim().max(100).optional().or(z.literal("")),
  administeredBy: z.string().trim().max(100).optional().or(z.literal("")),
  nextDueDate: dateIso.optional().or(z.literal("")),
  note: z.string().trim().max(1000).optional().or(z.literal("")),
});

type ValidationResult =
  | { ok: true; data: z.infer<typeof baseFields> }
  | { ok: false; error: string };

function validate(formData: FormData): ValidationResult {
  const parsed = baseFields.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  if (parsed.data.nextDueDate && parsed.data.nextDueDate <= parsed.data.givenAt) {
    return { ok: false, error: "Next due date must be after the given date." };
  }
  return { ok: true, data: parsed.data };
}

function payload(data: z.infer<typeof baseFields>) {
  return {
    type: data.type,
    givenAt: data.givenAt,
    batchNumber: data.batchNumber || null,
    administeredBy: data.administeredBy || null,
    nextDueDate: data.nextDueDate || null,
    note: data.note || null,
  };
}

function revalidateVaccination(kittenId: number) {
  revalidatePath(`/kittens/${kittenId}`);
  revalidatePath("/"); // dashboard medical-due panel
}

const addSchema = z.object({
  kittenId: z.coerce.number().int().positive(),
  // Set when this entry corrects a locked one (append-only correction).
  correctsId: z.coerce.number().int().positive().optional(),
});

export async function addVaccination(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireUser();
  const meta = addSchema.safeParse(Object.fromEntries(formData));
  if (!meta.success) return { error: "Invalid request" };
  const result = validate(formData);
  if (!result.ok) return { error: result.error, values: formValues(formData) };

  const kitten = db.select().from(kittens).where(eq(kittens.id, meta.data.kittenId)).get();
  if (!kitten) return { error: "Kitten not found" };

  let correctsId: number | null = null;
  if (meta.data.correctsId) {
    const original = db
      .select()
      .from(vaccinations)
      .where(eq(vaccinations.id, meta.data.correctsId))
      .get();
    if (!original || original.kittenId !== kitten.id) {
      return { error: "Entry being corrected not found" };
    }
    correctsId = original.id;
  }

  db.insert(vaccinations)
    .values({ kittenId: kitten.id, correctsId, ...payload(result.data) })
    .run();
  revalidateVaccination(kitten.id);
  return null;
}

export async function updateVaccination(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireUser();
  const id = z.coerce.number().int().positive().safeParse(formData.get("vaccinationId"));
  if (!id.success) return { error: "Invalid entry" };
  const entry = db.select().from(vaccinations).where(eq(vaccinations.id, id.data)).get();
  if (!entry) return { error: "Entry not found" };
  if (Date.now() - entry.createdAt.getTime() > VACCINATION_EDIT_WINDOW_MS) {
    return { error: "This medical record is locked. Add a correction instead." };
  }
  const result = validate(formData);
  if (!result.ok) return { error: result.error, values: formValues(formData) };

  db.update(vaccinations).set(payload(result.data)).where(eq(vaccinations.id, id.data)).run();
  revalidateVaccination(entry.kittenId);
  return null;
}

export async function deleteVaccination(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireUser();
  const id = z.coerce.number().int().positive().safeParse(formData.get("vaccinationId"));
  if (!id.success) return { error: "Invalid entry" };
  const entry = db.select().from(vaccinations).where(eq(vaccinations.id, id.data)).get();
  if (!entry) return { error: "Entry not found" };
  // A record added in error stays removable past the edit window: the
  // append-only correction flow keeps legitimate history on file, but an
  // outright mistake should be deletable. Detach any corrections that point at
  // this row first so we never leave a dangling correctsId reference.
  db.update(vaccinations)
    .set({ correctsId: null })
    .where(eq(vaccinations.correctsId, id.data))
    .run();
  db.delete(vaccinations).where(eq(vaccinations.id, id.data)).run();
  revalidateVaccination(entry.kittenId);
  return null;
}
