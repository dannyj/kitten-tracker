import "server-only";

import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { photos } from "@/db/schema";
import type { PhotoSubject } from "@/lib/photo-storage";

export type GalleryPhoto = {
  id: number;
  takenAtMs: number | null;
  takenAtSource: "exif" | "manual" | "upload";
  caption: string | null;
};

/** Photos for a subject, chronological by taken_at (the growth timeline order). */
export function getSubjectPhotos(subjectType: PhotoSubject, subjectId: number): GalleryPhoto[] {
  return db
    .select({
      id: photos.id,
      takenAt: photos.takenAt,
      takenAtSource: photos.takenAtSource,
      caption: photos.caption,
    })
    .from(photos)
    .where(and(eq(photos.subjectType, subjectType), eq(photos.subjectId, subjectId)))
    .orderBy(asc(photos.takenAt), asc(photos.id))
    .all()
    .map((p) => ({
      id: p.id,
      takenAtMs: p.takenAt ? p.takenAt.getTime() : null,
      takenAtSource: p.takenAtSource,
      caption: p.caption,
    }));
}

/**
 * Resolve each kitten's cover photo id (explicit cover, else most recent), for
 * thumbnails in list/dashboard views.
 */
export function coverPhotoIdByKitten(
  kittenList: { id: number; coverPhotoId: number | null }[],
): Map<number, number | null> {
  const ids = kittenList.map((k) => k.id);
  const mostRecent = new Map<number, number>();
  if (ids.length > 0) {
    const rows = db
      .select({ id: photos.id, subjectId: photos.subjectId, takenAt: photos.takenAt })
      .from(photos)
      .where(and(eq(photos.subjectType, "kitten"), inArray(photos.subjectId, ids)))
      .orderBy(desc(photos.takenAt), desc(photos.id))
      .all();
    for (const r of rows) {
      if (!mostRecent.has(r.subjectId)) mostRecent.set(r.subjectId, r.id);
    }
  }
  const out = new Map<number, number | null>();
  for (const k of kittenList) {
    out.set(k.id, k.coverPhotoId ?? mostRecent.get(k.id) ?? null);
  }
  return out;
}
