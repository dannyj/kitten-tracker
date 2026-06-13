"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { kittens, photos } from "@/db/schema";
import { requireUser } from "@/lib/auth/guard";
import { type FormState } from "@/lib/forms";
import { deletePhotoFiles } from "@/lib/photo-storage";

function revalidateSubject(subjectType: string, subjectId: number) {
  if (subjectType === "kitten") {
    revalidatePath(`/kittens/${subjectId}`);
    revalidatePath("/kittens");
    revalidatePath("/");
  } else {
    revalidatePath(`/mothers/${subjectId}`);
  }
}

const updateSchema = z.object({
  photoId: z.coerce.number().int().positive(),
  caption: z.string().trim().max(300).optional().or(z.literal("")),
  // Manual date override (optional). Day granularity is enough for age-at-photo.
  takenAt: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date")
    .optional()
    .or(z.literal("")),
});

export async function updatePhoto(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireUser();
  const parsed = updateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const photo = db.select().from(photos).where(eq(photos.id, parsed.data.photoId)).get();
  if (!photo) return { error: "Photo not found" };

  const set: { caption: string | null; takenAt?: Date; takenAtSource?: "manual" } = {
    caption: parsed.data.caption || null,
  };
  if (parsed.data.takenAt) {
    // Store at local noon so day arithmetic is stable across time zones.
    set.takenAt = new Date(`${parsed.data.takenAt}T12:00:00`);
    set.takenAtSource = "manual";
  }

  db.update(photos).set(set).where(eq(photos.id, photo.id)).run();
  revalidateSubject(photo.subjectType, photo.subjectId);
  return null;
}

export async function deletePhoto(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireUser();
  const id = z.coerce.number().int().positive().safeParse(formData.get("photoId"));
  if (!id.success) return { error: "Invalid photo" };
  const photo = db.select().from(photos).where(eq(photos.id, id.data)).get();
  if (!photo) return { error: "Photo not found" };

  // Clear any cover pointer first (the ALTER-added FK has no cascade action).
  if (photo.subjectType === "kitten") {
    db.update(kittens)
      .set({ coverPhotoId: null })
      .where(and(eq(kittens.id, photo.subjectId), eq(kittens.coverPhotoId, photo.id)))
      .run();
  }
  db.delete(photos).where(eq(photos.id, photo.id)).run();
  await deletePhotoFiles(photo.filePath);

  revalidateSubject(photo.subjectType, photo.subjectId);
  return null;
}

export async function setCoverPhoto(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireUser();
  const parsed = z
    .object({
      kittenId: z.coerce.number().int().positive(),
      photoId: z.coerce.number().int().positive(),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Invalid request" };

  const photo = db.select().from(photos).where(eq(photos.id, parsed.data.photoId)).get();
  if (!photo || photo.subjectType !== "kitten" || photo.subjectId !== parsed.data.kittenId) {
    return { error: "Photo not found for this kitten" };
  }
  db.update(kittens)
    .set({ coverPhotoId: photo.id })
    .where(eq(kittens.id, parsed.data.kittenId))
    .run();
  revalidateSubject("kitten", parsed.data.kittenId);
  return null;
}
