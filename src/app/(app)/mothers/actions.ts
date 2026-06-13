"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { motherHealthLogs, mothers, MOTHER_HEALTH_CATEGORIES } from "@/db/schema";
import { requireUser } from "@/lib/auth/guard";
import { HEALTH_LOG_EDIT_WINDOW_MS } from "@/lib/constants";
import { formValues, type FormState } from "@/lib/forms";

const motherSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  shelterNumber: z.string().trim().max(50).optional().or(z.literal("")),
  intakeDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date")
    .optional()
    .or(z.literal("")),
  notesBehaviour: z.string().trim().max(5000).optional().or(z.literal("")),
  status: z.enum(["in_care", "returned", "deceased"]),
});

function motherPayload(parsed: z.infer<typeof motherSchema>) {
  return {
    name: parsed.name,
    shelterNumber: parsed.shelterNumber || null,
    intakeDate: parsed.intakeDate || null,
    notesBehaviour: parsed.notesBehaviour || null,
    status: parsed.status,
  };
}

export async function createMother(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireUser();
  const parsed = motherSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message, values: formValues(formData) };
  }
  const inserted = db
    .insert(mothers)
    .values(motherPayload(parsed.data))
    .returning({ id: mothers.id })
    .get();
  revalidatePath("/mothers");
  redirect(`/mothers/${inserted.id}`);
}

export async function updateMother(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireUser();
  const id = z.coerce.number().int().positive().safeParse(formData.get("id"));
  if (!id.success) return { error: "Invalid mother" };
  const existing = db.select().from(mothers).where(eq(mothers.id, id.data)).get();
  if (!existing) return { error: "Mother not found" };

  const parsed = motherSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message, values: formValues(formData) };
  }
  db.update(mothers).set(motherPayload(parsed.data)).where(eq(mothers.id, id.data)).run();
  revalidatePath("/mothers");
  revalidatePath(`/mothers/${id.data}`);
  redirect(`/mothers/${id.data}`);
}

const healthLogSchema = z.object({
  motherId: z.coerce.number().int().positive(),
  category: z.enum(MOTHER_HEALTH_CATEGORIES),
  entry: z.string().trim().min(1, "Entry text is required").max(5000),
});

export async function addHealthLog(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireUser();
  const parsed = healthLogSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message, values: formValues(formData) };
  }
  const mother = db.select().from(mothers).where(eq(mothers.id, parsed.data.motherId)).get();
  if (!mother) return { error: "Mother not found" };

  db.insert(motherHealthLogs)
    .values({
      motherId: parsed.data.motherId,
      category: parsed.data.category,
      entry: parsed.data.entry,
    })
    .run();
  revalidatePath(`/mothers/${parsed.data.motherId}`);
  return null;
}

const healthLogEditSchema = z.object({
  logId: z.coerce.number().int().positive(),
  category: z.enum(MOTHER_HEALTH_CATEGORIES),
  entry: z.string().trim().min(1, "Entry text is required").max(5000),
});

export async function updateHealthLog(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireUser();
  const parsed = healthLogEditSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }
  const log = db
    .select()
    .from(motherHealthLogs)
    .where(eq(motherHealthLogs.id, parsed.data.logId))
    .get();
  if (!log) return { error: "Entry not found" };

  // Append-only after the typo window: corrections become new entries.
  if (Date.now() - log.loggedAt.getTime() > HEALTH_LOG_EDIT_WINDOW_MS) {
    return { error: "This entry is locked (older than 15 minutes). Add a new entry instead." };
  }

  db.update(motherHealthLogs)
    .set({ category: parsed.data.category, entry: parsed.data.entry })
    .where(eq(motherHealthLogs.id, parsed.data.logId))
    .run();
  revalidatePath(`/mothers/${log.motherId}`);
  return null;
}
