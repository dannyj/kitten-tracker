import { eq } from "drizzle-orm";
import { type NextRequest } from "next/server";
import { db } from "@/db";
import { photos } from "@/db/schema";
import { getCurrentSession } from "@/lib/auth/session";
import { readPhotoFile } from "@/lib/photo-storage";

export const dynamic = "force-dynamic";

// Authenticated image serving: a session is required to view ANY image, and the
// resolved path is confined to the photos volume (traversal guard lives in
// readPhotoFile → resolveWithinPhotos).
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user } = await getCurrentSession();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) return new Response("Not found", { status: 404 });

  const photo = db.select().from(photos).where(eq(photos.id, id)).get();
  if (!photo) return new Response("Not found", { status: 404 });

  const variant = request.nextUrl.searchParams.get("thumb") === "1" ? "thumb" : "full";
  const bytes = await readPhotoFile(photo.filePath, variant);
  if (!bytes) return new Response("Not found", { status: 404 });

  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": "image/webp",
      // Re-encoded immutable bytes; private since the route is authenticated.
      "Cache-Control": "private, max-age=86400",
    },
  });
}
