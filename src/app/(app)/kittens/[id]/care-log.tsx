"use client";

import { Pencil } from "lucide-react";
import { useActionState, useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { HEALTH_LOG_EDIT_WINDOW_MS } from "@/lib/constants";
import { formatDateTime } from "@/lib/dates";
import type { FormState } from "@/lib/forms";
import { addCareLog, updateCareLog } from "../care-log-actions";

export type CareLogEntry = {
  id: number;
  category: "milestone" | "behaviour" | "socialisation" | "husbandry" | "other";
  entry: string;
  loggedAtMs: number;
};

function subscribeClock(onTick: () => void): () => void {
  const timer = setInterval(onTick, 30_000);
  return () => clearInterval(timer);
}

const CATEGORY_LABELS = {
  milestone: "Milestone",
  behaviour: "Behaviour",
  socialisation: "Socialisation",
  husbandry: "Husbandry",
  other: "Other",
} as const;

function CategorySelect({ name, defaultValue }: { name: string; defaultValue: string }) {
  return (
    <Select name={name} defaultValue={defaultValue}>
      <SelectTrigger className="w-full sm:w-40">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
          <SelectItem key={value} value={value}>
            {label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function EditForm({ log, onDone }: { log: CareLogEntry; onDone: () => void }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    async (prev, formData) => {
      const result = await updateCareLog(prev, formData);
      if (!result) onDone();
      return result;
    },
    null,
  );

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="logId" value={log.id} />
      <CategorySelect name="category" defaultValue={log.category} />
      <Textarea name="entry" rows={3} maxLength={5000} required defaultValue={log.entry} />
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

export function CareLog({ kittenId, logs }: { kittenId: number; logs: CareLogEntry[] }) {
  const [addState, addAction, addPending] = useActionState<FormState, FormData>(addCareLog, null);
  const [editingId, setEditingId] = useState<number | null>(null);
  // Clock in 30s buckets via useSyncExternalStore (render must stay pure).
  // 0 on the server/first paint = no edit buttons until hydration; the
  // 15-minute window is enforced server-side regardless.
  const tick = useSyncExternalStore(
    subscribeClock,
    () => Math.floor(Date.now() / 30_000),
    () => 0,
  );
  const now = tick === 0 ? null : tick * 30_000;

  return (
    <div className="flex flex-col gap-4">
      <form action={addAction} className="flex flex-col gap-2 rounded-lg border p-3">
        <input type="hidden" name="kittenId" value={kittenId} />
        <Label htmlFor="new-care-entry" className="text-sm font-medium">
          New entry
        </Label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <CategorySelect name="category" defaultValue="milestone" />
          <Textarea
            id="new-care-entry"
            name="entry"
            rows={2}
            maxLength={5000}
            required
            placeholder="First time using the litter box…"
            className="flex-1"
            defaultValue={addState?.values?.entry ?? ""}
          />
        </div>
        {addState?.error ? (
          <p role="alert" className="text-destructive text-sm">
            {addState.error}
          </p>
        ) : null}
        <div>
          <Button type="submit" size="sm" disabled={addPending}>
            {addPending ? "Adding…" : "Add entry"}
          </Button>
        </div>
      </form>

      {logs.length === 0 ? (
        <p className="text-muted-foreground text-sm">No care log entries yet.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {logs.map((log) => {
            const editable = now !== null && now - log.loggedAtMs < HEALTH_LOG_EDIT_WINDOW_MS;
            return (
              <li key={log.id} className="rounded-lg border p-3">
                <div className="text-muted-foreground flex items-center justify-between gap-2 text-xs">
                  <span>
                    {formatDateTime(new Date(log.loggedAtMs))} · {CATEGORY_LABELS[log.category]}
                  </span>
                  {editable && editingId !== log.id ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 gap-1 px-2 text-xs"
                      onClick={() => setEditingId(log.id)}
                    >
                      <Pencil className="size-3" aria-hidden /> Edit
                    </Button>
                  ) : null}
                </div>
                {editingId === log.id ? (
                  <div className="mt-2">
                    <EditForm log={log} onDone={() => setEditingId(null)} />
                  </div>
                ) : (
                  <p className="mt-1 text-sm whitespace-pre-wrap">{log.entry}</p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
