"use client";

import { Check, SkipForward } from "lucide-react";
import Link from "next/link";
import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { WEIGHT_MAX_G, WEIGHT_MIN_G, WEIGHT_SOFT_MAX_G, WEIGHT_SOFT_MIN_G } from "@/lib/constants";
import { toDatetimeLocal } from "@/lib/dates";
import type { FormState } from "@/lib/forms";
import { addWeight } from "../../../kittens/weight-actions";

export type WeighTarget = { id: number; name: string; lastWeightGrams: number | null };

function initTimestamp(el: Element | RadioNodeList | null) {
  if (el instanceof HTMLInputElement && !el.value) {
    el.value = toDatetimeLocal(new Date());
  }
}

export function WeighFlow({ litterId, kittens }: { litterId: number; kittens: WeighTarget[] }) {
  const [index, setIndex] = useState(0);
  const [recorded, setRecorded] = useState(0);

  const [state, formAction, pending] = useActionState<FormState, FormData>(
    async (prev, formData) => {
      const grams = Number(formData.get("weightGrams"));
      if (
        Number.isFinite(grams) &&
        (grams < WEIGHT_SOFT_MIN_G || grams > WEIGHT_SOFT_MAX_G) &&
        !window.confirm(
          `${grams} g is outside the typical range (${WEIGHT_SOFT_MIN_G}–${WEIGHT_SOFT_MAX_G} g). Save it anyway?`,
        )
      ) {
        return prev;
      }
      const result = await addWeight(prev, formData);
      if (!result) {
        setRecorded((n) => n + 1);
        setIndex((i) => i + 1);
      }
      return result;
    },
    null,
  );

  if (index >= kittens.length) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-lg border border-dashed py-16 text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-emerald-100">
          <Check className="size-6 text-emerald-700" aria-hidden />
        </div>
        <div>
          <p className="font-medium">Weigh-in complete</p>
          <p className="text-muted-foreground text-sm">
            Recorded {recorded} of {kittens.length} kittens.
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href={`/litters/${litterId}`}>View litter chart</Link>
          </Button>
          <Button asChild>
            <Link href="/kittens">Done</Link>
          </Button>
        </div>
      </div>
    );
  }

  const current = kittens[index];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground text-sm">
          Kitten {index + 1} of {kittens.length}
        </p>
        <div className="bg-muted h-1.5 w-32 overflow-hidden rounded-full">
          <div
            className="bg-primary h-full transition-all"
            style={{ width: `${(index / kittens.length) * 100}%` }}
          />
        </div>
      </div>

      <form
        key={current.id}
        action={formAction}
        className="flex flex-col gap-3 rounded-lg border p-4"
      >
        <input type="hidden" name="kittenId" value={current.id} />
        <div>
          <h2 className="text-xl font-semibold">{current.name}</h2>
          {current.lastWeightGrams !== null ? (
            <p className="text-muted-foreground text-sm">
              Last weight: {current.lastWeightGrams} g
            </p>
          ) : (
            <p className="text-muted-foreground text-sm">No previous weight</p>
          )}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="weightGrams">Weight (g)</Label>
          <Input
            id="weightGrams"
            name="weightGrams"
            type="number"
            inputMode="numeric"
            min={WEIGHT_MIN_G}
            max={WEIGHT_MAX_G}
            required
            autoFocus
            placeholder="grams"
            className="text-lg"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="weighedAt">When</Label>
          <Input
            id="weighedAt"
            name="weighedAt"
            type="datetime-local"
            required
            ref={(el) => initTimestamp(el)}
          />
        </div>
        <Input name="note" maxLength={500} placeholder="Note (optional)" />
        {state?.error ? (
          <p role="alert" className="text-destructive text-sm">
            {state.error}
          </p>
        ) : null}
        <div className="flex gap-2">
          <Button type="submit" disabled={pending} className="flex-1">
            {pending ? "Saving…" : index + 1 === kittens.length ? "Save & finish" : "Save & next"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => setIndex((i) => i + 1)}
            disabled={pending}
          >
            <SkipForward className="size-4" aria-hidden /> Skip
          </Button>
        </div>
      </form>
    </div>
  );
}
