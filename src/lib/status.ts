import type { KittenStatus } from "@/db/schema";

export const STATUS_LABELS: Record<KittenStatus, string> = {
  intake: "Intake",
  in_care: "In care",
  ready: "Ready for adoption",
  adopted: "Adopted",
  returned: "Returned to shelter",
  deceased: "Deceased",
};

// Transitions that need no justification. Everything else between two
// distinct statuses is a "backwards" move: allowed, but a note is required.
const FORWARD: Record<KittenStatus, KittenStatus[]> = {
  intake: ["in_care", "deceased"],
  in_care: ["ready", "returned", "deceased"],
  ready: ["adopted", "returned", "deceased"],
  adopted: ["deceased"],
  returned: ["deceased"],
  deceased: [],
};

export function isForwardTransition(from: KittenStatus, to: KittenStatus): boolean {
  return FORWARD[from].includes(to);
}

/** All statuses reachable from `from` (forward first, then backwards moves). */
export function availableTransitions(
  from: KittenStatus,
): { to: KittenStatus; requiresNote: boolean }[] {
  const forward = FORWARD[from].map((to) => ({ to, requiresNote: false }));
  const backwards = (Object.keys(FORWARD) as KittenStatus[])
    .filter((s) => s !== from && !FORWARD[from].includes(s))
    .map((to) => ({ to, requiresNote: true }));
  return [...forward, ...backwards];
}

export const ACTIVE_STATUSES: KittenStatus[] = ["intake", "in_care", "ready"];

export const STATUS_BADGE_CLASSES: Record<KittenStatus, string> = {
  intake: "bg-sky-100 text-sky-900 border-sky-200",
  in_care: "bg-emerald-100 text-emerald-900 border-emerald-200",
  ready: "bg-violet-100 text-violet-900 border-violet-200",
  adopted: "bg-amber-100 text-amber-900 border-amber-200",
  returned: "bg-zinc-200 text-zinc-800 border-zinc-300",
  deceased: "bg-zinc-700 text-zinc-100 border-zinc-700",
};
