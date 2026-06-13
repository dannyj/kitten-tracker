import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { type NextRequest } from "next/server";
import { db } from "@/db";
import { kittens, mothers, photos } from "@/db/schema";
import { getCurrentSession } from "@/lib/auth/session";
import { MAX_UPLOAD_BYTES, processAndStore, type PhotoSubject } from "@/lib/photo-storage";

export const dynamic = "force-dynamic";
// Re-encoding large images can take a moment; allow generous body size.
export const maxDuration = 60;

function subjectExists(subjectType: PhotoSubject, subjectId: number): boolean {
  if (subjectType === "kitten") {
    return !!db.select({ id: kittens.id }).from(kittens).where(eq(kittens.id, subjectId)).get();
  }
  return !!db.select({ id: mothers.id }).from(mothers).where(eq(mothers.id, subjectId)).get();
}

export async function POST(request: NextRequest) {
  const { user } = await getCurrentSession();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return Response.json({ error: "Invalid upload" }, { status: 400 });
  }

  const subjectType = form.get("subjectType");
  const subjectId = Number(form.get("subjectId"));
  const file = form.get("file");

  if (subjectType !== "kitten" && subjectType !== "mother") {
    return Response.json({ error: "Invalid subject" }, { status: 400 });
  }
  if (!Number.isInteger(subjectId) || subjectId <= 0 || !subjectExists(subjectType, subjectId)) {
    return Response.json({ error: "Subject not found" }, { status: 404 });
  }
  if (!(file instanceof File)) {
    return Response.json({ error: "No file" }, { status: 400 });
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return Response.json({ error: "File is too large (max 15 MB)." }, { status: 413 });
  }

  const buf = Buffer.from(await file.arrayBuffer());

  let stored;
  try {
    stored = await processAndStore(buf, subjectType, subjectId);
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Could not process image" },
      { status: 400 },
    );
  }

  // EXIF date when present, otherwise fall back to upload time.
  const takenAt = stored.exifDate ?? new Date();
  const takenAtSource = stored.exifDate ? "exif" : "upload";

  const inserted = db
    .insert(photos)
    .values({
      subjectType,
      subjectId,
      filePath: stored.filePath,
      takenAt,
      takenAtSource,
    })
    .returning({ id: photos.id })
    .get();

  if (subjectType === "kitten") revalidatePath(`/kittens/${subjectId}`);
  else revalidatePath(`/mothers/${subjectId}`);

  return Response.json({
    id: inserted.id,
    takenAtSource,
    takenAtMs: takenAt.getTime(),
  });
}
