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

// Brand status palette (style guide §06). Light tint backgrounds with darker
// matching text; deceased is high-contrast red and is never animated.
export const STATUS_BADGE_CLASSES: Record<KittenStatus, string> = {
  intake: "bg-[#E8F5F4] text-[#166A66] border-[#1D7874]/15",
  in_care: "bg-[#E0F0EF] text-[#156A66] border-[#1D7874]/15",
  ready: "bg-[#FBE9C6] text-[#B07010] border-[#F2A63D]/30",
  adopted: "bg-[#E8F4E8] text-[#2E7D32] border-[#2E7D32]/15",
  returned: "bg-[#EEE8F4] text-[#5C3A8A] border-[#5C3A8A]/15",
  deceased: "bg-[#FDECEA] text-[#C0392B] border-[#C0392B]/20",
};
