"use client";

import { AlertTriangle, CalendarClock, Plus, Pill } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { VaccinationQuickAdd } from "@/components/vaccination-quick-add";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { formatDate } from "@/lib/dates";
import {
  daysUntil,
  MOTHER_VACCINE_TYPES,
  VACCINE_TYPES,
  type MedicalSubjectType,
  type ScheduleTemplate,
} from "@/lib/schedule";

export type MedicalDueRow = {
  subjectType: MedicalSubjectType;
  subjectId: number;
  subjectName: string;
  vaccineType: string;
  label: string;
  dueDateIso: string;
  overdue: boolean;
};

function LogDialog({
  row,
  templates,
}: {
  row: MedicalDueRow;
  templates: ScheduleTemplate[];
}) {
  const [open, setOpen] = useState(false);
  const types = row.subjectType === "mother" ? MOTHER_VACCINE_TYPES : VACCINE_TYPES;
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="gap-1">
          <Plus className="size-4" aria-hidden /> Log
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>
            Log {row.label} — {row.subjectName}
          </DialogTitle>
        </DialogHeader>
        <VaccinationQuickAdd
          subjectType={row.subjectType}
          subjectId={row.subjectId}
          templates={templates}
          types={types}
          defaultType={row.vaccineType}
          onAdded={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

export function DashboardMedical({
  rows,
  kittenTemplates,
  motherTemplates,
  todayIso,
}: {
  rows: MedicalDueRow[];
  kittenTemplates: ScheduleTemplate[];
  motherTemplates: ScheduleTemplate[];
  todayIso: string;
}) {
  // Overdue first, then soonest due.
  const sorted = [...rows].sort(
    (a, b) =>
      Number(b.overdue) - Number(a.overdue) ||
      a.dueDateIso.localeCompare(b.dueDateIso) ||
      a.subjectName.localeCompare(b.subjectName),
  );

  if (sorted.length === 0) {
    return (
      <div className="text-muted-foreground flex items-center gap-2 rounded-lg border border-dashed p-4 text-sm">
        <Pill className="size-4" aria-hidden /> Nothing due in the next 7 days.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {sorted.map((row) => {
        const days = daysUntil(row.dueDateIso, todayIso);
        const href = row.subjectType === "mother" ? `/mothers/${row.subjectId}` : `/kittens/${row.subjectId}`;
        return (
          <div
            key={`${row.subjectType}-${row.subjectId}-${row.vaccineType}`}
            className={
              row.overdue
                ? "flex items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 p-3"
                : "flex items-center justify-between gap-3 rounded-lg border p-3"
            }
          >
            <div className="min-w-0">
              <span className="flex items-center gap-2">
                <Link href={href} className="font-medium hover:underline">
                  {row.subjectName}
                </Link>
                {row.subjectType === "mother" ? (
                  <span className="bg-muted text-muted-foreground rounded-full px-1.5 py-0.5 text-[10px] font-medium uppercase">
                    Mother
                  </span>
                ) : null}
              </span>
              <p
                className={
                  row.overdue
                    ? "flex items-center gap-1 text-sm font-medium text-red-900"
                    : "text-muted-foreground flex items-center gap-1 text-sm"
                }
              >
                {row.overdue ? (
                  <AlertTriangle className="size-3.5" aria-hidden />
                ) : (
                  <CalendarClock className="size-3.5" aria-hidden />
                )}
                {row.label} ·{" "}
                {row.overdue
                  ? `overdue by ${-days} day${-days === 1 ? "" : "s"}`
                  : `due ${formatDate(row.dueDateIso)}`}
              </p>
            </div>
            <LogDialog
              row={row}
              templates={row.subjectType === "mother" ? motherTemplates : kittenTemplates}
            />
          </div>
        );
      })}
    </div>
  );
}
