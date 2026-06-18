"use client";

import { AlertTriangle, CalendarClock, Pencil, Trash2 } from "lucide-react";
import { useActionState, useState } from "react";
import { VaccinationFields, VaccinationQuickAdd } from "@/components/vaccination-quick-add";
import { Button } from "@/components/ui/button";
import { VACCINATION_EDIT_WINDOW_MS } from "@/lib/constants";
import { formatDate, todayIso } from "@/lib/dates";
import type { FormState } from "@/lib/forms";
import {
  daysUntil,
  type DueItem,
  type MedicalSubjectType,
  type ScheduleTemplate,
} from "@/lib/schedule";
import { useNow } from "@/lib/use-now";
import { addVaccination, deleteVaccination, updateVaccination } from "../vaccination-actions";

export type VaccinationRow = {
  id: number;
  type: string;
  givenAtIso: string;
  batchNumber: string | null;
  administeredBy: string | null;
  nextDueDateIso: string | null;
  note: string | null;
  correctsOfDateIso: string | null;
  createdAtMs: number;
};

function EditForm({
  row,
  templates,
  types,
  onDone,
}: {
  row: VaccinationRow;
  templates: ScheduleTemplate[];
  types?: readonly string[];
  onDone: () => void;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    async (prev, formData) => {
      const result = await updateVaccination(prev, formData);
      if (!result) onDone();
      return result;
    },
    null,
  );
  return (
    <form action={formAction} className="mt-2 flex flex-col gap-2">
      <input type="hidden" name="vaccinationId" value={row.id} />
      <VaccinationFields templates={templates} types={types} defaults={row} />
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

function CorrectForm({
  row,
  subjectType,
  subjectId,
  templates,
  types,
  onDone,
}: {
  row: VaccinationRow;
  subjectType: MedicalSubjectType;
  subjectId: number;
  templates: ScheduleTemplate[];
  types?: readonly string[];
  onDone: () => void;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    async (prev, formData) => {
      const result = await addVaccination(prev, formData);
      if (!result) onDone();
      return result;
    },
    null,
  );
  return (
    <form action={formAction} className="mt-2 flex flex-col gap-2 rounded-md bg-muted/40 p-2">
      <input type="hidden" name="subjectType" value={subjectType} />
      <input type="hidden" name="subjectId" value={subjectId} />
      <input type="hidden" name="correctsId" value={row.id} />
      <p className="text-muted-foreground text-xs">
        Correcting the entry of {formatDate(row.givenAtIso)}. This creates a new record referencing
        the original — the original stays on file.
      </p>
      <VaccinationFields templates={templates} types={types} defaults={row} />
      {state?.error ? (
        <p role="alert" className="text-destructive text-sm">
          {state.error}
        </p>
      ) : null}
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Saving…" : "Save correction"}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

function DeleteButton({ vaccinationId }: { vaccinationId: number }) {
  const [, formAction, pending] = useActionState<FormState, FormData>(deleteVaccination, null);
  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (!window.confirm("Delete this medical entry?")) e.preventDefault();
      }}
    >
      <input type="hidden" name="vaccinationId" value={vaccinationId} />
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

export function MedicalCard({
  subjectType,
  subjectId,
  templates,
  types,
  rows,
  dueItems,
  manage = false,
}: {
  subjectType: MedicalSubjectType;
  subjectId: number;
  templates: ScheduleTemplate[];
  /** Selectable types for this subject; defaults to the kitten list. */
  types?: readonly string[];
  rows: VaccinationRow[];
  dueItems: DueItem[];
  /** Manage mode: entries with edit/delete/correct (no due list or quick-add). */
  manage?: boolean;
}) {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [correctingId, setCorrectingId] = useState<number | null>(null);
  const now = useNow();
  const today = todayIso();

  return (
    <div className="flex flex-col gap-4">
      {!manage && dueItems.length > 0 ? (
        <div className="flex flex-col gap-2">
          {dueItems.map((item) => {
            const days = daysUntil(item.dueDateIso, today);
            return (
              <div
                key={item.vaccineType}
                className={
                  item.overdue
                    ? "flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-2 text-sm text-red-900"
                    : "flex items-center gap-2 rounded-lg border bg-muted/40 p-2 text-sm"
                }
              >
                {item.overdue ? (
                  <AlertTriangle className="size-4 shrink-0" aria-hidden />
                ) : (
                  <CalendarClock className="size-4 shrink-0" aria-hidden />
                )}
                <span>
                  <span className="font-medium">{item.label}</span> suggested{" "}
                  {formatDate(item.dueDateIso)}{" "}
                  {item.overdue
                    ? `(overdue by ${-days} day${-days === 1 ? "" : "s"})`
                    : `(in ${days} day${days === 1 ? "" : "s"})`}
                </span>
              </div>
            );
          })}
          <p className="text-muted-foreground text-xs">
            Suggestions from editable schedule templates — general guidance only. The shelter&apos;s
            and vet&apos;s actual protocol takes precedence.
          </p>
        </div>
      ) : null}

      {manage ? null : (
        <VaccinationQuickAdd
          subjectType={subjectType}
          subjectId={subjectId}
          templates={templates}
          types={types}
        />
      )}

      {rows.length === 0 ? (
        <p className="text-muted-foreground text-sm">No medical entries yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {rows.map((row) => {
            const inWindow = now !== null && now - row.createdAtMs < VACCINATION_EDIT_WINDOW_MS;
            const editable = manage && inWindow;
            const showControls = manage;
            return (
              <li key={row.id} className="rounded-lg border p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{row.type}</span>
                  <span className="text-muted-foreground text-xs">
                    {formatDate(row.givenAtIso)}
                  </span>
                </div>
                <div className="text-muted-foreground mt-1 flex flex-col gap-0.5 text-xs">
                  {row.batchNumber ? <span>Batch {row.batchNumber}</span> : null}
                  {row.administeredBy ? <span>By {row.administeredBy}</span> : null}
                  {row.nextDueDateIso ? (
                    <span>Next due {formatDate(row.nextDueDateIso)}</span>
                  ) : null}
                  {row.correctsOfDateIso ? (
                    <span className="text-amber-700">
                      Corrects entry of {formatDate(row.correctsOfDateIso)}
                    </span>
                  ) : null}
                </div>
                {row.note ? <p className="mt-1 text-sm">{row.note}</p> : null}

                {!showControls ? null : editingId === row.id ? (
                  <EditForm
                    row={row}
                    templates={templates}
                    types={types}
                    onDone={() => setEditingId(null)}
                  />
                ) : correctingId === row.id ? (
                  <CorrectForm
                    row={row}
                    subjectType={subjectType}
                    subjectId={subjectId}
                    templates={templates}
                    types={types}
                    onDone={() => setCorrectingId(null)}
                  />
                ) : (
                  <div className="mt-1 flex gap-1">
                    {editable ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 gap-1 px-2 text-xs"
                        onClick={() => setEditingId(row.id)}
                      >
                        <Pencil className="size-3" aria-hidden /> Edit
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 gap-1 px-2 text-xs"
                        onClick={() => setCorrectingId(row.id)}
                      >
                        <Pencil className="size-3" aria-hidden /> Correct
                      </Button>
                    )}
                    {/* Delete stays available past the edit window so a record
                        added in error can always be removed. */}
                    <DeleteButton vaccinationId={row.id} />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
