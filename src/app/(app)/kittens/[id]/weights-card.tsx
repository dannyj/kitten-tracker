"use client";

import { ChevronDown, ChevronUp, Pencil, Trash2 } from "lucide-react";
import { useActionState, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  WEIGHT_EDIT_WINDOW_MS,
  WEIGHT_MAX_G,
  WEIGHT_MIN_G,
  WEIGHT_SOFT_MAX_G,
  WEIGHT_SOFT_MIN_G,
} from "@/lib/constants";
import { formatDateTime, pinDatetimeField, toDatetimeLocal } from "@/lib/dates";
import type { FormState } from "@/lib/forms";
import { useNow } from "@/lib/use-now";
import { addWeight, deleteWeight, updateWeight } from "../weight-actions";

export type WeightRow = {
  id: number;
  weighedAtMs: number;
  weightGrams: number;
  note: string | null;
  createdAtMs: number;
};

function softConfirm(grams: number): boolean {
  if (grams < WEIGHT_SOFT_MIN_G || grams > WEIGHT_SOFT_MAX_G) {
    return window.confirm(
      `${grams} g is outside the typical range (${WEIGHT_SOFT_MIN_G}–${WEIGHT_SOFT_MAX_G} g). Save it anyway?`,
    );
  }
  return true;
}

function QuickAdd({ kittenId }: { kittenId: number }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    async (prev, formData) => {
      const result = await addWeight(prev, formData);
      if (!result) {
        formRef.current?.reset();
        initTimestamp(formRef.current?.elements.namedItem("weighedAt") ?? null);
      }
      return result;
    },
    null,
  );

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const grams = Number(formData.get("weightGrams"));
    if (Number.isFinite(grams) && !softConfirm(grams)) return;
    pinDatetimeField(formData, "weighedAt");
    formAction(formData);
  }

  return (
    <form ref={formRef} onSubmit={onSubmit} className="flex flex-col gap-3 rounded-lg border p-3">
      <input type="hidden" name="kittenId" value={kittenId} />
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="flex flex-1 flex-col gap-1.5">
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
            placeholder="e.g. 215"
            defaultValue={state?.values?.weightGrams ?? ""}
          />
        </div>
        <div className="flex flex-1 flex-col gap-1.5">
          <Label htmlFor="weighedAt">When</Label>
          <Input
            id="weighedAt"
            name="weighedAt"
            type="datetime-local"
            required
            ref={(el) => initTimestamp(el)}
          />
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="weight-note">Note (optional)</Label>
        <Input
          id="weight-note"
          name="note"
          maxLength={500}
          placeholder="before feed, after feed…"
          defaultValue={state?.values?.note ?? ""}
        />
      </div>
      {state?.error ? (
        <p role="alert" className="text-destructive text-sm">
          {state.error}
        </p>
      ) : null}
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Add weight"}
        </Button>
      </div>
    </form>
  );
}

// Set an uncontrolled datetime-local to "now" once, via ref callback (no effect,
// no hydration mismatch since it only runs on the client).
function initTimestamp(el: Element | RadioNodeList | null | undefined) {
  if (el instanceof HTMLInputElement && !el.value) {
    el.value = toDatetimeLocal(new Date());
  }
}

function EditForm({ row, onDone }: { row: WeightRow; onDone: () => void }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    async (prev, formData) => {
      const grams = Number(formData.get("weightGrams"));
      if (Number.isFinite(grams) && !softConfirm(grams)) return prev;
      pinDatetimeField(formData, "weighedAt");
      const result = await updateWeight(prev, formData);
      if (!result) onDone();
      return result;
    },
    null,
  );

  return (
    <form action={formAction} className="mt-2 flex flex-col gap-2">
      <input type="hidden" name="weightId" value={row.id} />
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          name="weightGrams"
          type="number"
          inputMode="numeric"
          min={WEIGHT_MIN_G}
          max={WEIGHT_MAX_G}
          required
          defaultValue={row.weightGrams}
          className="sm:w-28"
          aria-label="Weight in grams"
        />
        <Input
          name="weighedAt"
          type="datetime-local"
          required
          defaultValue={toDatetimeLocal(new Date(row.weighedAtMs))}
          aria-label="Weighing time"
        />
      </div>
      <Input name="note" maxLength={500} defaultValue={row.note ?? ""} placeholder="Note" />
      {state?.error ? (
        <p role="alert" className="text-destructive text-sm">
          {state.error}
        </p>
      ) : null}
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

function DeleteButton({ weightId }: { weightId: number }) {
  const [, formAction, pending] = useActionState<FormState, FormData>(deleteWeight, null);
  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (!window.confirm("Delete this weight entry?")) e.preventDefault();
      }}
    >
      <input type="hidden" name="weightId" value={weightId} />
      <Button
        type="submit"
        variant="ghost"
        size="sm"
        disabled={pending}
        className="text-destructive h-7 gap-1 px-2 text-xs"
      >
        <Trash2 className="size-3" aria-hidden /> Delete
      </Button>
    </form>
  );
}

export function WeightsCard({
  kittenId,
  rows,
  manage = false,
}: {
  kittenId: number;
  rows: WeightRow[];
  /** Manage mode: hide quick-add, show per-entry edit/delete (correction view). */
  manage?: boolean;
}) {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [expanded, setExpanded] = useState(false);
  const now = useNow();

  // On the kitten overview, keep the history short (most recent few) so it
  // doesn't push the photos and other cards far down the page. The Manage
  // entries view always shows everything.
  const COLLAPSED_COUNT = 5;
  const collapsible = !manage && rows.length > COLLAPSED_COUNT;
  const visibleRows = collapsible && !expanded ? rows.slice(0, COLLAPSED_COUNT) : rows;

  return (
    <div className="flex flex-col gap-4">
      {manage ? null : <QuickAdd kittenId={kittenId} />}

      {rows.length === 0 ? (
        <p className="text-muted-foreground text-sm">No weights recorded yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {visibleRows.map((row, i) => {
            const older = rows[i + 1]; // rows are newest-first
            const delta = older ? row.weightGrams - older.weightGrams : null;
            const editable =
              manage && now !== null && now - row.createdAtMs < WEIGHT_EDIT_WINDOW_MS;
            return (
              <li key={row.id} className="rounded-lg border p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-baseline gap-2">
                    <span className="font-medium">{row.weightGrams} g</span>
                    {delta !== null ? (
                      <span
                        className={
                          delta > 0
                            ? "text-emerald-600 text-xs"
                            : delta < 0
                              ? "text-red-600 text-xs"
                              : "text-muted-foreground text-xs"
                        }
                      >
                        {delta > 0 ? "+" : ""}
                        {delta} g
                      </span>
                    ) : null}
                  </div>
                  <span className="text-muted-foreground text-xs">
                    {formatDateTime(new Date(row.weighedAtMs))}
                  </span>
                </div>
                {row.note ? <p className="text-muted-foreground mt-1 text-sm">{row.note}</p> : null}
                {editingId === row.id ? (
                  <EditForm row={row} onDone={() => setEditingId(null)} />
                ) : editable ? (
                  <div className="mt-1 flex gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 gap-1 px-2 text-xs"
                      onClick={() => setEditingId(row.id)}
                    >
                      <Pencil className="size-3" aria-hidden /> Edit
                    </Button>
                    <DeleteButton weightId={row.id} />
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      {collapsible ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="self-start gap-1 px-2 text-xs"
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? (
            <>
              <ChevronUp className="size-3" aria-hidden /> Show less
            </>
          ) : (
            <>
              <ChevronDown className="size-3" aria-hidden /> See more ({rows.length - COLLAPSED_COUNT}{" "}
              older)
            </>
          )}
        </Button>
      ) : null}
    </div>
  );
}
