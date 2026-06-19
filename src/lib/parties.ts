import type { PartyStatus } from "@/db/schema";

export const PARTY_STATUS_LABELS: Record<PartyStatus, string> = {
  enquired: "Enquired",
  viewing_booked: "Viewing booked",
  viewed: "Viewed",
  approved: "Approved",
  adopted: "Adopted",
  withdrew: "Withdrew",
  not_suitable: "Not suitable",
};

// Allowed next statuses, foster-driven. The pipeline runs
// enquired → viewing_booked → viewed → approved → adopted, with withdrew /
// not_suitable off-ramps available from any active stage, and a way back to
// enquired if someone re-engages. `adopted` is reached only through the
// link-to-kitten adoption flow, never as a plain status change.
const NEXT: Record<PartyStatus, PartyStatus[]> = {
  enquired: ["viewing_booked", "viewed", "withdrew", "not_suitable"],
  viewing_booked: ["viewed", "withdrew", "not_suitable"],
  viewed: ["approved", "withdrew", "not_suitable"],
  approved: ["adopted", "withdrew", "not_suitable"],
  adopted: [],
  withdrew: ["enquired"],
  not_suitable: ["enquired"],
};

export function partyTransitions(from: PartyStatus): PartyStatus[] {
  return NEXT[from];
}

export function isPartyTransitionAllowed(from: PartyStatus, to: PartyStatus): boolean {
  return NEXT[from].includes(to);
}

// Active = still in play. Off-ramps and adopted are hidden by the default list
// filter.
export const ACTIVE_PARTY_STATUSES: PartyStatus[] = [
  "enquired",
  "viewing_booked",
  "viewed",
  "approved",
];

export const PARTY_STATUS_BADGE_CLASSES: Record<PartyStatus, string> = {
  enquired: "bg-sky-100 text-sky-900 border-sky-200",
  viewing_booked: "bg-violet-100 text-violet-900 border-violet-200",
  viewed: "bg-indigo-100 text-indigo-900 border-indigo-200",
  approved: "bg-emerald-100 text-emerald-900 border-emerald-200",
  adopted: "bg-amber-100 text-amber-900 border-amber-200",
  withdrew: "bg-zinc-200 text-zinc-800 border-zinc-300",
  not_suitable: "bg-zinc-200 text-zinc-800 border-zinc-300",
};
