"use client";

import { Clock, Pencil, Trash2 } from "lucide-react";
import { useActionState, useState } from "react";
import { FeedingQuickAdd } from "@/components/feeding-quick-add";
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
import { FEEDING_EDIT_WINDOW_MS, FEEDING_MAX_ML, FEEDING_MIN_ML } from "@/lib/constants";
import { formatDateTime, pinDatetimeField, toDatetimeLocal } from "@/lib/dates";
import {
  expectedDailyMl,
  FEEDING_QUALITY_LABELS,
  formatCountdown,
  intakeTodayMl,
  nextFeedDue,
  perFeedTargetMl,
} from "@/lib/feeding";
import type { FormState } from "@/lib/forms";
import { useNow } from "@/lib/use-now";
import { deleteFeeding, updateFeeding, updateFeedingInterval } from "../feeding-actions";

export type FeedingRow = {
  id: number;
  fedAtMs: number;
  amountMl: number | null;
  formula: string | null;
  quality: "good" | "slow" | "refused" | null;
  note: string | null;
  createdAtMs: number;
};

function timeSince(ms: number): string {
  const min = Math.round(ms / 60000);
  if (min < 60) return `${min} min after previous`;
  return `${Math.floor(min / 60)}h ${min % 60}m after previous`;
}

function Countdown({
  lastFedMs,
  intervalMinutes,
}: {
  lastFedMs: number | null;
  intervalMinutes: number;
}) {
  const now = useNow();

  if (lastFedMs === null) {
    return (
      <div className="text-muted-foreground flex items-center gap-2 rounded-lg border border-dashed p-3 text-sm">
        <Clock className="size-4" aria-hidden /> No feeds yet — start the log below.
      </div>
    );
  }

  const due = nextFeedDue(lastFedMs, intervalMinutes, now ?? lastFedMs);
  const dueAtClock = formatDateTime(new Date(lastFedMs + intervalMinutes * 60000)).split(" ")[1];
  const overdue = now !== null && due !== null && due.overdue;

  return (
    <div
      className={
        overdue
          ? "flex items-center justify-between gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-900"
          : "flex items-center justify-between gap-2 rounded-lg border bg-muted/40 p-3 text-sm"
      }
    >
      <span className="flex items-center gap-2">
        <Clock className="size-4" aria-hidden />
        {now === null || due === null
          ? `Next feed at ${dueAtClock}`
          : `Next feed ${formatCountdown(due.minutesUntil)}`}
      </span>
      <span className="text-muted-foreground text-xs">due {dueAtClock}</span>
    </div>
  );
}

function IntervalEditor({
  kittenId,
  intervalMinutes,
}: {
  kittenId: number;
  intervalMinutes: number;
}) {
  const [editing, setEditing] = useState(false);
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    async (prev, formData) => {
      const result = await updateFeedingInterval(prev, formData);
      if (!result) setEditing(false);
      return result;
    },
    null,
  );

  if (!editing) {
    return (
      <div className="text-muted-foreground flex items-center gap-2 text-xs">
        <span>Feed every {intervalMinutes} min</span>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="underline underline-offset-2"
        >
          change
        </button>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="kittenId" value={kittenId} />
      <div className="flex flex-col gap-1">
        <Label htmlFor="feedingIntervalMinutes" className="text-xs">
          Feed every (min)
        </Label>
        <Input
          id="feedingIntervalMinutes"
          name="feedingIntervalMinutes"
          type="number"
          min={30}
          max={720}
          step={15}
          defaultValue={intervalMinutes}
          className="w-28"
        />
      </div>
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "Saving…" : "Save"}
      </Button>
      <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(false)}>
        Cancel
      </Button>
      {state?.error ? (
        <p role="alert" className="text-destructive w-full text-xs">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}

function EditForm({ row, onDone }: { row: FeedingRow; onDone: () => void }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    async (prev, formData) => {
      pinDatetimeField(formData, "fedAt");
      const result = await updateFeeding(prev, formData);
      if (!result) onDone();
      return result;
    },
    null,
  );

  return (
    <form action={formAction} className="mt-2 flex flex-col gap-2">
      <input type="hidden" name="feedingId" value={row.id} />
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          name="amountMl"
          type="number"
          step="0.1"
          min={FEEDING_MIN_ML}
          max={FEEDING_MAX_ML}
          required
          defaultValue={row.amountMl ?? ""}
          className="sm:w-28"
          aria-label="Amount in ml"
        />
        <Input
          name="fedAt"
          type="datetime-local"
          required
          defaultValue={toDatetimeLocal(new Date(row.fedAtMs))}
          aria-label="Feeding time"
        />
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          name="formula"
          maxLength={100}
          placeholder="Formula"
          defaultValue={row.formula ?? ""}
          className="flex-1"
        />
        <Select name="quality" defaultValue={row.quality ?? "none"}>
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
      <Input name="note" maxLength={500} placeholder="Note" defaultValue={row.note ?? ""} />
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

function DeleteButton({ feedingId }: { feedingId: number }) {
  const [, formAction, pending] = useActionState<FormState, FormData>(deleteFeeding, null);
  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (!window.confirm("Delete this feed entry?")) e.preventDefault();
      }}
    >
      <input type="hidden" name="feedingId" value={feedingId} />
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

function IntakeSummary({
  rows,
  latestWeightG,
  intervalMinutes,
}: {
  rows: FeedingRow[];
  latestWeightG: number | null;
  intervalMinutes: number;
}) {
  const now = useNow();
  // Compute "today" on the client so it follows the foster's local day.
  const { totalMl, count } = intakeTodayMl(
    rows.map((r) => ({ fedAtMs: r.fedAtMs, amountMl: r.amountMl })),
    now ?? undefined,
  );

  return (
    <div className="flex flex-col gap-1 rounded-lg border p-3 text-sm">
      <p className="font-medium">
        Today: {count} {count === 1 ? "feed" : "feeds"} · {totalMl} ml
      </p>
      {latestWeightG !== null ? (
        <>
          <p className="text-muted-foreground">
            Guide: ~{perFeedTargetMl(latestWeightG)} ml/feed · ~
            {expectedDailyMl(latestWeightG, intervalMinutes)} ml/day
          </p>
          <p className="text-muted-foreground text-xs">
            Rough guide only — amounts vary with age and weight; shelter/vet guidance takes
            precedence.
          </p>
        </>
      ) : (
        <p className="text-muted-foreground text-xs">Add a weight to see intake targets.</p>
      )}
    </div>
  );
}

export function FeedingCard({
  kittenId,
  intervalMinutes,
  latestWeightG,
  rows,
  manage = false,
}: {
  kittenId: number;
  intervalMinutes: number;
  latestWeightG: number | null;
  rows: FeedingRow[];
  /** Manage mode: just the entries with edit/delete (no countdown/quick-add/intake). */
  manage?: boolean;
}) {
  const [editingId, setEditingId] = useState<number | null>(null);
  const now = useNow();
  const lastFedMs = rows[0]?.fedAtMs ?? null;

  return (
    <div className="flex flex-col gap-4">
      {manage ? null : (
        <>
          <Countdown lastFedMs={lastFedMs} intervalMinutes={intervalMinutes} />
          <IntervalEditor kittenId={kittenId} intervalMinutes={intervalMinutes} />
          <FeedingQuickAdd kittenId={kittenId} />
          <IntakeSummary
            rows={rows}
            latestWeightG={latestWeightG}
            intervalMinutes={intervalMinutes}
          />
        </>
      )}

      {rows.length === 0 ? (
        <p className="text-muted-foreground text-sm">No feeds recorded yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {rows.map((row, i) => {
            const older = rows[i + 1]; // newest-first
            const gap = older ? timeSince(row.fedAtMs - older.fedAtMs) : null;
            const editable =
              manage && now !== null && now - row.createdAtMs < FEEDING_EDIT_WINDOW_MS;
            return (
              <li key={row.id} className="rounded-lg border p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-baseline gap-2">
                    <span className="font-medium">{row.amountMl ?? "—"} ml</span>
                    {row.quality ? (
                      <span className="text-muted-foreground text-xs">
                        {FEEDING_QUALITY_LABELS[row.quality]}
                      </span>
                    ) : null}
                  </div>
                  <span className="text-muted-foreground text-xs">
                    {formatDateTime(new Date(row.fedAtMs))}
                  </span>
                </div>
                {row.formula || gap ? (
                  <p className="text-muted-foreground mt-1 text-xs">
                    {[row.formula, gap].filter(Boolean).join(" · ")}
                  </p>
                ) : null}
                {row.note ? <p className="mt-1 text-sm">{row.note}</p> : null}
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
                    <DeleteButton feedingId={row.id} />
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
