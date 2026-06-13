"use client";

import { Clock, Plus, UtensilsCrossed } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { FeedingQuickAdd } from "@/components/feeding-quick-add";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { formatDateTime } from "@/lib/dates";
import { formatCountdown, nextFeedDue } from "@/lib/feeding";
import { useNow } from "@/lib/use-now";

export type FeedingDueRow = {
  id: number;
  name: string;
  lastFedMs: number | null;
  intervalMinutes: number;
};

function LogFeedDialog({ id, name }: { id: number; name: string }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="gap-1">
          <Plus className="size-4" aria-hidden /> Log feed
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Log feed — {name}</DialogTitle>
        </DialogHeader>
        <FeedingQuickAdd kittenId={id} onAdded={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}

export function DashboardFeeding({ rows }: { rows: FeedingDueRow[] }) {
  const now = useNow();

  // Soonest-due first (overdue naturally sort to the top); kittens with no feeds
  // go last. The sort key needs no clock, so order is stable pre-hydration.
  const sorted = [...rows].sort((a, b) => {
    const aKey = a.lastFedMs === null ? Infinity : a.lastFedMs + a.intervalMinutes * 60000;
    const bKey = b.lastFedMs === null ? Infinity : b.lastFedMs + b.intervalMinutes * 60000;
    return aKey - bKey || a.name.localeCompare(b.name);
  });

  return (
    <div className="flex flex-col gap-2">
      {sorted.map((row) => {
        const due = now !== null ? nextFeedDue(row.lastFedMs, row.intervalMinutes, now) : null;
        const overdue = due !== null && due.overdue;
        return (
          <div
            key={row.id}
            className={
              overdue
                ? "flex items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 p-3"
                : "flex items-center justify-between gap-3 rounded-lg border p-3"
            }
          >
            <div className="min-w-0">
              <Link href={`/kittens/${row.id}`} className="font-medium hover:underline">
                {row.name}
              </Link>
              <p
                className={
                  overdue
                    ? "flex items-center gap-1 text-sm font-medium text-red-900"
                    : "text-muted-foreground flex items-center gap-1 text-sm"
                }
              >
                <Clock className="size-3.5" aria-hidden />
                {row.lastFedMs === null
                  ? "No feeds yet"
                  : now === null || due === null
                    ? `last fed ${formatDateTime(new Date(row.lastFedMs))}`
                    : `Next feed ${formatCountdown(due.minutesUntil)}`}
              </p>
            </div>
            <LogFeedDialog id={row.id} name={row.name} />
          </div>
        );
      })}
      {sorted.length === 0 ? (
        <div className="text-muted-foreground flex items-center gap-2 rounded-lg border border-dashed p-4 text-sm">
          <UtensilsCrossed className="size-4" aria-hidden /> No hand-fed kittens right now.
        </div>
      ) : null}
    </div>
  );
}
