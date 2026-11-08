"use client";

import { Camera, ImageOff, Star, Trash2, X } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef, useState } from "react";
import { deletePhoto, setCoverPhoto, updatePhoto } from "@/app/(app)/photo-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatAge, formatDate, toDatetimeLocal } from "@/lib/dates";
import type { FormState } from "@/lib/forms";
import type { GalleryPhoto } from "@/lib/photo-data";

type Props = {
  subjectType: "kitten" | "mother";
  subjectId: number;
  birthDateIso?: string | null;
  coverPhotoId?: number | null;
  photos: GalleryPhoto[];
};

const thumbUrl = (id: number) => `/api/photos/${id}?thumb=1`;
const fullUrl = (id: number) => `/api/photos/${id}`;

function ageInfo(birthDateIso: string | null | undefined, takenAtMs: number | null) {
  if (!birthDateIso || takenAtMs === null) return { ageText: null, beforeBirth: false };
  const ageText = formatAge(birthDateIso, { until: new Date(takenAtMs) });
  return { ageText, beforeBirth: ageText === null };
}

const SOURCE_LABEL = { exif: "from photo", manual: "set manually", upload: "upload date" } as const;

type UploadStatus = { name: string; state: "uploading" | "done" | "error"; message?: string };

function Uploader({ subjectType, subjectId }: { subjectType: string; subjectId: number }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [statuses, setStatuses] = useState<UploadStatus[]>([]);
  const [busy, setBusy] = useState(false);

  async function onFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setBusy(true);
    const list = Array.from(files);
    setStatuses(list.map((f) => ({ name: f.name, state: "uploading" })));

    // Upload each independently so one failure doesn't sink the batch.
    await Promise.all(
      list.map(async (file, i) => {
        const body = new FormData();
        body.set("subjectType", subjectType);
        body.set("subjectId", String(subjectId));
        body.set("file", file);
        try {
          const res = await fetch("/api/photos", { method: "POST", body });
          if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            throw new Error(data.error ?? `Upload failed (${res.status})`);
          }
          setStatuses((s) => s.map((st, j) => (j === i ? { ...st, state: "done" } : st)));
        } catch (err) {
          setStatuses((s) =>
            s.map((st, j) =>
              j === i ? { ...st, state: "error", message: (err as Error).message } : st,
            ),
          );
        }
      }),
    );

    setBusy(false);
    if (inputRef.current) inputRef.current.value = "";
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-2">
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif"
        multiple
        className="hidden"
        onChange={(e) => onFiles(e.target.files)}
      />
      <Button
        type="button"
        variant="outline"
        className="self-start gap-2"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
      >
        <Camera className="size-4" aria-hidden /> {busy ? "Uploading…" : "Add photos"}
      </Button>
      {statuses.length > 0 ? (
        <ul className="flex flex-col gap-1 text-xs">
          {statuses.map((s, i) => (
            <li
              key={i}
              className={
                s.state === "error"
                  ? "text-destructive"
                  : s.state === "done"
                    ? "text-emerald-600"
                    : "text-muted-foreground"
              }
            >
              {s.state === "uploading" ? "Uploading" : s.state === "done" ? "Added" : "Failed"}:{" "}
              {s.name}
              {s.message ? ` — ${s.message}` : ""}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function Lightbox({
  photo,
  subjectType,
  subjectId,
  birthDateIso,
  isCover,
  onClose,
}: {
  photo: GalleryPhoto;
  subjectType: "kitten" | "mother";
  subjectId: number;
  birthDateIso?: string | null;
  isCover: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const { ageText, beforeBirth } = ageInfo(birthDateIso, photo.takenAtMs);

  // Close on Escape (the lightbox is a plain overlay, not a Radix Dialog).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const [editState, editAction, editPending] = useActionState<FormState, FormData>(
    async (prev, fd) => {
      const r = await updatePhoto(prev, fd);
      if (!r) router.refresh();
      return r;
    },
    null,
  );
  const [, deleteAction, deletePending] = useActionState<FormState, FormData>(async (prev, fd) => {
    const r = await deletePhoto(prev, fd);
    if (!r) {
      onClose();
      router.refresh();
    }
    return r;
  }, null);
  const [, coverAction] = useActionState<FormState, FormData>(async (prev, fd) => {
    const r = await setCoverPhoto(prev, fd);
    if (!r) router.refresh();
    return r;
  }, null);

  const dateValue = photo.takenAtMs ? toDatetimeLocal(new Date(photo.takenAtMs)).slice(0, 10) : "";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="bg-background flex max-h-[92svh] w-full max-w-lg flex-col gap-3 overflow-y-auto rounded-lg p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">
            {photo.takenAtMs
              ? formatDate(new Date(photo.takenAtMs).toISOString().slice(0, 10))
              : "—"}
            {ageText ? ` · ${ageText}` : ""}
          </span>
          <Button type="button" variant="ghost" size="icon" onClick={onClose} aria-label="Close">
            <X className="size-4" aria-hidden />
          </Button>
        </div>

        {/* eslint-disable-next-line @next/next/no-img-element -- authenticated dynamic route, not statically optimizable */}
        <img
          src={fullUrl(photo.id)}
          alt={photo.caption ?? "Kitten photo"}
          className="max-h-[55svh] w-full rounded-md object-contain"
        />

        <p className="text-muted-foreground text-xs">
          Date {SOURCE_LABEL[photo.takenAtSource]}
          {beforeBirth ? " · ⚠ photo dated before birth — check the date" : ""}
        </p>
        {photo.takenAtSource === "upload" ? (
          <p className="text-xs text-amber-700">
            Couldn&apos;t read the photo&apos;s date — set it manually below?
          </p>
        ) : null}

        <form action={editAction} className="flex flex-col gap-2">
          <input type="hidden" name="photoId" value={photo.id} />
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`caption-${photo.id}`}>Caption</Label>
            <Input
              id={`caption-${photo.id}`}
              name="caption"
              maxLength={300}
              defaultValue={photo.caption ?? ""}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`date-${photo.id}`}>Date taken (manual override)</Label>
            <Input id={`date-${photo.id}`} name="takenAt" type="date" defaultValue={dateValue} />
          </div>
          {editState?.error ? (
            <p role="alert" className="text-destructive text-sm">
              {editState.error}
            </p>
          ) : null}
          <Button type="submit" size="sm" disabled={editPending} className="self-start">
            {editPending ? "Saving…" : "Save"}
          </Button>
        </form>

        <div className="flex flex-wrap gap-2 border-t pt-3">
          {subjectType === "kitten" ? (
            <form action={coverAction}>
              <input type="hidden" name="kittenId" value={subjectId} />
              <input type="hidden" name="photoId" value={photo.id} />
              <Button
                type="submit"
                size="sm"
                variant="outline"
                disabled={isCover}
                className="gap-1"
              >
                <Star className={isCover ? "size-4 fill-current" : "size-4"} aria-hidden />
                {isCover ? "Cover photo" : "Set as cover"}
              </Button>
            </form>
          ) : null}
          <form
            action={deleteAction}
            onSubmit={(e) => {
              if (!window.confirm("Delete this photo? This can't be undone.")) e.preventDefault();
            }}
          >
            <input type="hidden" name="photoId" value={photo.id} />
            <Button
              type="submit"
              size="sm"
              variant="ghost"
              disabled={deletePending}
              className="text-destructive gap-1"
            >
              <Trash2 className="size-4" aria-hidden /> Delete
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}

export function PhotoGallery({
  subjectType,
  subjectId,
  birthDateIso,
  coverPhotoId,
  photos,
}: Props) {
  const [openId, setOpenId] = useState<number | null>(null);
  const openPhoto = photos.find((p) => p.id === openId) ?? null;

  return (
    <div className="flex flex-col gap-4">
      <Uploader subjectType={subjectType} subjectId={subjectId} />

      {photos.length === 0 ? (
        <div className="text-muted-foreground flex items-center gap-2 rounded-lg border border-dashed p-4 text-sm">
          <ImageOff className="size-4" aria-hidden /> No photos yet.
        </div>
      ) : (
        <ul data-testid="photo-grid" className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {photos.map((p) => {
            const { ageText, beforeBirth } = ageInfo(birthDateIso, p.takenAtMs);
            return (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => setOpenId(p.id)}
                  className="group relative block w-full overflow-hidden rounded-md border"
                >
                  <Image
                    src={thumbUrl(p.id)}
                    alt={p.caption ?? "thumbnail"}
                    width={200}
                    height={200}
                    unoptimized
                    className="aspect-square w-full object-cover"
                  />
                  {p.id === coverPhotoId ? (
                    <Star
                      className="absolute top-1 right-1 size-4 fill-yellow-400 text-yellow-500"
                      aria-label="Cover photo"
                    />
                  ) : null}
                  <span className="absolute inset-x-0 bottom-0 bg-black/55 px-1 py-0.5 text-center text-[10px] text-white">
                    {subjectType === "mother"
                      ? p.takenAtMs
                        ? formatDate(new Date(p.takenAtMs).toISOString().slice(0, 10))
                        : "—"
                      : beforeBirth
                        ? "check date"
                        : (ageText ?? "—")}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {openPhoto ? (
        <Lightbox
          photo={openPhoto}
          subjectType={subjectType}
          subjectId={subjectId}
          birthDateIso={birthDateIso}
          isCover={openPhoto.id === coverPhotoId}
          onClose={() => setOpenId(null)}
        />
      ) : null}
    </div>
  );
}
