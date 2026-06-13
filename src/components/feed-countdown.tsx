"use client";

import { Clock } from "lucide-react";
import { formatCountdown, nextFeedDue } from "@/lib/feeding";
import { useNow } from "@/lib/use-now";

/** Live "next feed in 47 min" / "overdue by 22 min" label for a hand-fed kitten. */
export function FeedCountdown({
  lastFedMs,
  intervalMinutes,
}: {
  lastFedMs: number | null;
  intervalMinutes: number;
}) {
  const now = useNow();
  if (lastFedMs === null) {
    return (
      <span className="text-muted-foreground flex items-center gap-1 text-xs">
        <Clock className="size-3" aria-hidden /> No feeds yet
      </span>
    );
  }
  const due = now !== null ? nextFeedDue(lastFedMs, intervalMinutes, now) : null;
  const overdue = due?.overdue ?? false;
  return (
    <span
      className={
        overdue
          ? "flex items-center gap-1 text-xs font-medium text-red-700"
          : "text-muted-foreground flex items-center gap-1 text-xs"
      }
    >
      <Clock className="size-3" aria-hidden />
      {due ? `Feed ${formatCountdown(due.minutesUntil)}` : "Feed scheduled"}
    </span>
  );
}
