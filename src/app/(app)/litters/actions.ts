"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { litters, mothers } from "@/db/schema";
import { requireUser } from "@/lib/auth/guard";
import { formValues, type FormState } from "@/lib/forms";

const litterSchema = z.object({
  motherId: z
    .string()
    .optional()
    .transform((v) => (v && v !== "none" ? Number(v) : null))
    .pipe(z.number().int().positive().nullable()),
  birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Birth date is required"),
  birthDateEstimated: z
    .string()
    .optional()
    .transform((v) => v === "on" || v === "true"),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
});

export async function createLitter(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireUser();
  const parsed = litterSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message, values: formValues(formData) };
  }
  const { motherId, birthDate, birthDateEstimated, notes } = parsed.data;

  if (motherId !== null) {
    const mother = db.select().from(mothers).where(eq(mothers.id, motherId)).get();
    if (!mother) return { error: "Mother not found", values: formValues(formData) };
  }

  const inserted = db
    .insert(litters)
    .values({ motherId, birthDate, birthDateEstimated, notes: notes || null })
    .returning({ id: litters.id })
    .get();

  if (motherId !== null) {
    revalidatePath(`/mothers/${motherId}`);
    redirect(`/mothers/${motherId}`);
  }
  redirect(`/kittens/new?litter=${inserted.id}`);
}
