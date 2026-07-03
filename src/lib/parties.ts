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

// Brand-aligned pipeline palette (style guide §03/§06): teal → amber → coral →
// green through the funnel, deep teal for the adopted end state, warm neutral
// for the off-ramps.
export const PARTY_STATUS_BADGE_CLASSES: Record<PartyStatus, string> = {
  enquired: "bg-[#E8F5F4] text-[#166A66] border-[#1D7874]/15",
  viewing_booked: "bg-[#FBE9C6] text-[#B07010] border-[#F2A63D]/30",
  viewed: "bg-[#FAE0DA] text-[#9E4A38] border-[#E87E6A]/30",
  approved: "bg-[#E8F4E8] text-[#2E7D32] border-[#2E7D32]/15",
  adopted: "bg-[#E0F0EF] text-[#156A66] border-[#1D7874]/15",
  withdrew: "bg-[#ECE7DF] text-[#6B6258] border-[#6B6258]/20",
  not_suitable: "bg-[#ECE7DF] text-[#6B6258] border-[#6B6258]/20",
};
