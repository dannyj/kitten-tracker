import type { FeedingMethod } from "@/db/schema";

/**
 * Presentation + small helpers for a kitten's feeding method. Mirrors the
 * status.ts / parties.ts pattern: labels and derived predicates live here, not
 * inline in components, so the form, list, detail page and advice stay in sync.
 */

export const FEEDING_METHOD_LABELS: Record<FeedingMethod, string> = {
  mother: "Mother-fed",
  hand: "Hand-fed",
  weaned: "Weaned",
};

/** Short label for the select option (the form already says "Feeding method"). */
export const FEEDING_METHOD_OPTION_LABELS: Record<FeedingMethod, string> = {
  mother: "Mother is feeding",
  hand: "Hand-feeding (bottle)",
  weaned: "Weaned (eating solids)",
};

/** Only hand-fed kittens get the bottle-feeding tracking module + countdown. */
export function isHandFed(method: FeedingMethod): boolean {
  return method === "hand";
}
