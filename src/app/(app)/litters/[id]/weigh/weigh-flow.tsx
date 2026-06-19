"use client";

import { Cat, Check } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { WeighResult } from "@/components/weigh-result";
import { WEIGHT_MAX_G, WEIGHT_MIN_G, WEIGHT_SOFT_MAX_G, WEIGHT_SOFT_MIN_G } from "@/lib/constants";
import { datetimeLocalToIso, toDatetimeLocal } from "@/lib/dates";
import { addWeights, type BulkWeighState } from "../../../kittens/weight-actions";

export type WeighTarget = {
  id: number;
  name: string;
  lastWeightGrams: number | null;
  coverPhotoId: number | null;
};

export function WeighFlow({ litterId, kittens }: { litterId: number; kittens: WeighTarget[] }) {
  // Controlled inputs so we can clear rows that saved and keep ones that failed.
  const [weights, setWeights] = useState<Record<number, string>>({});
  const [when, setWhen] = useState(() => toDatetimeLocal(new Date()));
  const [localError, setLocalError] = useState<string | null>(null);
  const [done, setDone] = useState<number | null>(null);
  const [summary, setSummary] = useState<NonNullable<BulkWeighState>["feedback"]>([]);

  const [state, formAction, pending] = useActionState<BulkWeighState, FormData>(
    async (prev, formData) => {
      const result = await addWeights(prev, formData);
      const savedIds = result?.savedKittenIds ?? [];
      if (savedIds.length > 0) {
        setWeights((w) => {
          const next = { ...w };
          for (const id of savedIds) delete next[id];
          return next;
        });
      }
      // Everything entered saved cleanly → show the summary screen.
      if (savedIds.length > 0 && (result?.failures?.length ?? 0) === 0) {
        setDone(result?.saved ?? savedIds.length);
        setSummary(result?.feedback ?? []);
      }
      return result;
    },
    null,
  );

  const nameById = new Map(kittens.map((k) => [k.id, k.name]));

  const failureById = new Map((state?.failures ?? []).map((f) => [f.kittenId, f.message]));

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLocalError(null);
    const filled = kittens
      .map((k) => ({ k, value: (weights[k.id] ?? "").trim() }))
      .filter(({ value }) => value !== "");

    if (filled.length === 0) {
      setLocalError("Enter at least one weight.");
      return;
    }

    // One confirm for every out-of-range value, rather than one prompt per kitten.
    const outliers = filled
      .map(({ k, value }) => ({ k, grams: Number(value) }))
      .filter(
        ({ grams }) =>
          Number.isFinite(grams) && (grams < WEIGHT_SOFT_MIN_G || grams > WEIGHT_SOFT_MAX_G),
      );
    if (outliers.length > 0) {
      const list = outliers.map(({ k, grams }) => `• ${k.name}: ${grams} g`).join("\n");
      if (
        !window.confirm(
          `These are outside the typical range (${WEIGHT_SOFT_MIN_G}–${WEIGHT_SOFT_MAX_G} g):\n\n${list}\n\nSave anyway?`,
        )
      ) {
        return;
      }
    }

    const fd = new FormData();
    fd.set("weighedAt", datetimeLocalToIso(when));
    fd.set("litterId", String(litterId));
    for (const { k, value } of filled) fd.set(`weight_${k.id}`, value);
    formAction(fd);
  }

  if (done !== null) {
    const remaining = kittens.length - done;
    return (
      <div className="flex flex-col items-center gap-4 rounded-lg border border-dashed py-16 text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-emerald-100">
          <Check className="size-6 text-emerald-700" aria-hidden />
        </div>
        <div>
          <p className="font-medium">Weigh-in saved</p>
          <p className="text-muted-foreground text-sm">
            Recorded {done} {done === 1 ? "weight" : "weights"}
            {remaining > 0 ? ` · ${remaining} not weighed` : ""}.
          </p>
        </div>
        {summary && summary.length > 0 ? (
          <ul className="flex w-full max-w-md flex-col gap-2 text-left">
            {summary.map((fb) => (
              <li key={fb.kittenId} className="flex flex-col gap-1">
                <span className="text-sm font-medium">{nameById.get(fb.kittenId) ?? "Kitten"}</span>
                <WeighResult feedback={fb} />
              </li>
            ))}
          </ul>
        ) : null}
        <div className="flex flex-wrap justify-center gap-2">
          <Button asChild variant="outline">
            <Link href={`/litters/${litterId}`}>View litter chart</Link>
          </Button>
          {remaining > 0 ? (
            <Button type="button" variant="outline" onClick={() => setDone(null)}>
              Weigh the rest
            </Button>
          ) : null}
          <Button asChild>
            <Link href="/kittens">Done</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5 rounded-lg border p-4">
        <Label htmlFor="weighedAt">When (applies to all)</Label>
        <Input
          id="weighedAt"
          name="weighedAt"
          type="datetime-local"
          required
          value={when}
          onChange={(e) => setWhen(e.target.value)}
        />
      </div>

      <ul className="flex flex-col gap-2">
        {kittens.map((k) => {
          const error = failureById.get(k.id);
          return (
            <li key={k.id} className="flex items-center gap-3 rounded-lg border p-3">
              {k.coverPhotoId ? (
                <Image
                  src={`/api/photos/${k.coverPhotoId}?thumb=1`}
                  alt=""
                  width={56}
                  height={56}
                  unoptimized
                  className="size-14 shrink-0 rounded-full object-cover"
                />
              ) : (
                <span className="bg-muted flex size-14 shrink-0 items-center justify-center rounded-full">
                  <Cat className="text-muted-foreground size-7" aria-hidden />
                </span>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{k.name}</p>
                <p className="text-muted-foreground text-xs">
                  {k.lastWeightGrams !== null ? `Last: ${k.lastWeightGrams} g` : "No previous weight"}
                </p>
                {error ? (
                  <p role="alert" className="text-destructive text-xs">
                    {error}
                  </p>
                ) : null}
              </div>
              <Input
                type="number"
                inputMode="numeric"
                min={WEIGHT_MIN_G}
                max={WEIGHT_MAX_G}
                placeholder="grams"
                aria-label={`Weight for ${k.name} in grams`}
                aria-invalid={error ? true : undefined}
                value={weights[k.id] ?? ""}
                onChange={(e) => setWeights((w) => ({ ...w, [k.id]: e.target.value }))}
                className="w-24 shrink-0 text-lg"
              />
            </li>
          );
        })}
      </ul>

      {localError ?? state?.error ? (
        <p role="alert" className="text-destructive text-sm">
          {localError ?? state?.error}
        </p>
      ) : null}

      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save all weights"}
      </Button>
    </form>
  );
}
