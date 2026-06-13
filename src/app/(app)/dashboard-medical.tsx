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
import { daysUntil, type ScheduleTemplate } from "@/lib/schedule";

export type MedicalDueRow = {
  kittenId: number;
  kittenName: string;
  vaccineType: string;
  label: string;
  dueDateIso: string;
  overdue: boolean;
};

function LogDialog({ row, templates }: { row: MedicalDueRow; templates: ScheduleTemplate[] }) {
  const [open, setOpen] = useState(false);
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
            Log {row.label} — {row.kittenName}
          </DialogTitle>
        </DialogHeader>
        <VaccinationQuickAdd
          kittenId={row.kittenId}
          templates={templates}
          defaultType={row.vaccineType}
          onAdded={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

export function DashboardMedical({
  rows,
  templates,
  todayIso,
}: {
  rows: MedicalDueRow[];
  templates: ScheduleTemplate[];
  todayIso: string;
}) {
  // Overdue first, then soonest due.
  const sorted = [...rows].sort(
    (a, b) =>
      Number(b.overdue) - Number(a.overdue) ||
      a.dueDateIso.localeCompare(b.dueDateIso) ||
      a.kittenName.localeCompare(b.kittenName),
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
        return (
          <div
            key={`${row.kittenId}-${row.vaccineType}`}
            className={
              row.overdue
                ? "flex items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 p-3"
                : "flex items-center justify-between gap-3 rounded-lg border p-3"
            }
          >
            <div className="min-w-0">
              <Link href={`/kittens/${row.kittenId}`} className="font-medium hover:underline">
                {row.kittenName}
              </Link>
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
            <LogDialog row={row} templates={templates} />
          </div>
        );
      })}
    </div>
  );
}
