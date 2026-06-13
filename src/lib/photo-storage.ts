import "server-only";

import { randomUUID } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import convert from "heic-convert";
import sharp from "sharp";

// The re-encode step is the security keystone: the bytes we serve are always
// bytes we generated, never the original upload. That neutralises embedded
// payloads / polyglots, and dropping metadata strips EXIF + GPS.

export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024; // 15 MB
const MAX_DIMENSION = 2000;
const THUMB_DIMENSION = 400;

export type ImageKind = "jpeg" | "png" | "webp" | "heic";
export type PhotoSubject = "kitten" | "mother";

const HEIC_BRANDS = [
  "heic",
  "heix",
  "hevc",
  "hevx",
  "heim",
  "heis",
  "hevm",
  "hevs",
  "mif1",
  "msf1",
  "heif",
];

/** Identify an image by magic bytes — never trust extension or client MIME. */
export function sniffImage(b: Buffer): ImageKind | null {
  if (b.length < 12) return null;
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "jpeg";
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "png";
  if (b.toString("ascii", 0, 4) === "RIFF" && b.toString("ascii", 8, 12) === "WEBP") return "webp";
  if (b.toString("ascii", 4, 8) === "ftyp") {
    const head = b.toString("ascii", 8, 32).toLowerCase();
    if (HEIC_BRANDS.some((brand) => head.includes(brand))) return "heic";
  }
  return null;
}

function photosRoot(): string {
  return path.resolve(process.env.PHOTOS_PATH ?? "./data/photos");
}

/** Resolve a stored relative path to an absolute one, guarding against traversal. */
export function resolveWithinPhotos(relPath: string): string | null {
  const root = photosRoot();
  const abs = path.resolve(root, relPath);
  if (abs !== root && !abs.startsWith(root + path.sep)) return null;
  return abs;
}

export function thumbPathFor(relPath: string): string {
  return relPath.replace(/\.webp$/, ".thumb.webp");
}

async function readExifDate(buf: Buffer): Promise<Date | null> {
  try {
    const exifr = (await import("exifr")).default;
    const data = await exifr.parse(buf, {
      pick: ["DateTimeOriginal", "CreateDate", "DateTimeDigitized"],
    });
    const d = data?.DateTimeOriginal ?? data?.CreateDate ?? data?.DateTimeDigitized;
    return d instanceof Date && !Number.isNaN(d.getTime()) ? d : null;
  } catch {
    return null;
  }
}

export type StoredPhoto = { filePath: string; exifDate: Date | null };

/**
 * Validate, read EXIF, re-encode to WebP (full + thumbnail) and write under the
 * photos volume with a UUID name. Throws on an unsupported/oversized file.
 */
export async function processAndStore(
  buf: Buffer,
  subjectType: PhotoSubject,
  subjectId: number,
): Promise<StoredPhoto> {
  if (buf.length > MAX_UPLOAD_BYTES) throw new Error("File is too large (max 15 MB).");
  const kind = sniffImage(buf);
  if (!kind) throw new Error("Unsupported file type. Use JPEG, PNG, WebP or HEIC.");

  // EXIF (incl. date) is read from the ORIGINAL bytes, before re-encoding.
  const exifDate = await readExifDate(buf);

  // HEIC won't display in browsers and the prebuilt sharp may lack a HEIC
  // decoder, so decode it with the pure-JS converter first.
  let working: Buffer = buf;
  if (kind === "heic") {
    working = Buffer.from(await convert({ buffer: buf, format: "JPEG", quality: 0.92 }));
  }

  // .rotate() bakes in EXIF orientation before metadata is dropped.
  const pipeline = sharp(working, { failOn: "none" }).rotate();
  const full = await pipeline
    .clone()
    .resize(MAX_DIMENSION, MAX_DIMENSION, { fit: "inside", withoutEnlargement: true })
    .webp({ quality: 82 })
    .toBuffer();
  const thumb = await pipeline
    .clone()
    .resize(THUMB_DIMENSION, THUMB_DIMENSION, { fit: "inside", withoutEnlargement: true })
    .webp({ quality: 72 })
    .toBuffer();

  const uuid = randomUUID();
  const relDir = path.join(subjectType, String(subjectId));
  const relPath = path.join(relDir, `${uuid}.webp`);
  const absDir = path.join(photosRoot(), relDir);
  await mkdir(absDir, { recursive: true });
  await writeFile(path.join(photosRoot(), relPath), full);
  await writeFile(path.join(photosRoot(), thumbPathFor(relPath)), thumb);

  return { filePath: relPath, exifDate };
}

/** Read a stored image (full or thumbnail) for the authenticated serving route. */
export async function readPhotoFile(
  relPath: string,
  variant: "full" | "thumb",
): Promise<Buffer | null> {
  const target = variant === "thumb" ? thumbPathFor(relPath) : relPath;
  const abs = resolveWithinPhotos(target);
  if (!abs) return null;
  try {
    return await readFile(abs);
  } catch {
    // Thumbnails are best-effort; fall back to the full image if missing.
    if (variant === "thumb") return readPhotoFile(relPath, "full");
    return null;
  }
}

/** Remove the full image and its thumbnail (ignores already-missing files). */
export async function deletePhotoFiles(relPath: string): Promise<void> {
  for (const rel of [relPath, thumbPathFor(relPath)]) {
    const abs = resolveWithinPhotos(rel);
    if (!abs) continue;
    try {
      await unlink(abs);
    } catch {
      // already gone — fine
    }
  }
}
