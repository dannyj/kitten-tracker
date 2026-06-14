"use client";

import { useActionState, useRef, useState } from "react";
import { addFeeding } from "@/app/(app)/kittens/feeding-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FEEDING_MAX_ML,
  FEEDING_MIN_ML,
  FEEDING_SOFT_MAX_ML,
  FEEDING_SOFT_MIN_ML,
} from "@/lib/constants";
import { pinDatetimeField, toDatetimeLocal } from "@/lib/dates";
import { FEEDING_QUALITY_LABELS } from "@/lib/feeding";
import type { FormState } from "@/lib/forms";

// Set an uncontrolled datetime-local to "now" once, via ref callback (client-only).
function initTimestamp(el: Element | RadioNodeList | null) {
  if (el instanceof HTMLInputElement && !el.value) {
    el.value = toDatetimeLocal(new Date());
  }
}

function softConfirm(ml: number): boolean {
  if (ml < FEEDING_SOFT_MIN_ML || ml > FEEDING_SOFT_MAX_ML) {
    return window.confirm(
      `${ml} ml is outside the typical range (${FEEDING_SOFT_MIN_ML}–${FEEDING_SOFT_MAX_ML} ml). Save it anyway?`,
    );
  }
  return true;
}

/**
 * Amount-first quick-add for a feed. Reused on the kitten detail page and in the
 * dashboard "log feed" dialog. Calls onAdded after a successful insert.
 */
export function FeedingQuickAdd({
  kittenId,
  onAdded,
  autoFocus = true,
}: {
  kittenId: number;
  onAdded?: () => void;
  autoFocus?: boolean;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    async (prev, formData) => {
      const ml = Number(formData.get("amountMl"));
      if (Number.isFinite(ml) && !softConfirm(ml)) return prev;
      pinDatetimeField(formData, "fedAt");
      const result = await addFeeding(prev, formData);
      if (!result) {
        formRef.current?.reset();
        initTimestamp(formRef.current?.elements.namedItem("fedAt") ?? null);
        setShowDetails(false);
        onAdded?.();
      }
      return result;
    },
    null,
  );

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-3 rounded-lg border p-3">
      <input type="hidden" name="kittenId" value={kittenId} />
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="flex flex-1 flex-col gap-1.5">
          <Label htmlFor="amountMl">Amount (ml)</Label>
          <Input
            id="amountMl"
            name="amountMl"
            type="number"
            inputMode="decimal"
            step="0.1"
            min={FEEDING_MIN_ML}
            max={FEEDING_MAX_ML}
            required
            autoFocus={autoFocus}
            placeholder="e.g. 8"
            className="text-lg"
            defaultValue={state?.values?.amountMl ?? ""}
          />
        </div>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Log feed"}
        </Button>
      </div>

      <button
        type="button"
        onClick={() => setShowDetails((v) => !v)}
        className="text-muted-foreground self-start text-xs underline-offset-2 hover:underline"
      >
        {showDetails ? "Hide details" : "Add time, formula, quality…"}
      </button>

      {showDetails ? (
        <div className="flex flex-col gap-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="fedAt">When</Label>
            <Input id="fedAt" name="fedAt" type="datetime-local" ref={(el) => initTimestamp(el)} />
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              name="formula"
              maxLength={100}
              placeholder="Formula (e.g. KMR)"
              className="flex-1"
              defaultValue={state?.values?.formula ?? ""}
            />
            <Select name="quality" defaultValue={state?.values?.quality ?? "none"}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Quality…</SelectItem>
                {Object.entries(FEEDING_QUALITY_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Input
            name="note"
            maxLength={500}
            placeholder="Note (optional)"
            defaultValue={state?.values?.note ?? ""}
          />
        </div>
      ) : (
        // Keep the timestamp present even when details are collapsed.
        <input type="hidden" name="fedAt" ref={(el) => initTimestamp(el)} />
      )}

      {state?.error ? (
        <p role="alert" className="text-destructive text-sm">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
