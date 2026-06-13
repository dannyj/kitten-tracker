/**
 * Pure helpers for the hand-feeding module: next-feed countdown and the rough
 * intake guidance. No runtime imports so it stays portable and testable.
 *
 * The intake numbers are a guide only — feeding amounts vary with age and
 * weight, and shelter/vet guidance takes precedence. Nothing here is dosing
 * advice.
 */

const MINUTE_MS = 60 * 1000;

export const FEEDING_QUALITY_LABELS = {
  good: "Good latch",
  slow: "Slow",
  refused: "Refused",
} as const;

export type FeedingDue = {
  dueAtMs: number;
  /** Whole minutes until due (negative when overdue). */
  minutesUntil: number;
  overdue: boolean;
};

/**
 * When the next feed is due, given the last feed time and the interval.
 * Returns null when there is no last feed yet (caller shows an empty state
 * rather than a broken/negative countdown).
 */
export function nextFeedDue(
  lastFedMs: number | null,
  intervalMinutes: number,
  nowMs: number = Date.now(),
): FeedingDue | null {
  if (lastFedMs === null) return null;
  const dueAtMs = lastFedMs + intervalMinutes * MINUTE_MS;
  const minutesUntil = Math.round((dueAtMs - nowMs) / MINUTE_MS);
  return { dueAtMs, minutesUntil, overdue: nowMs >= dueAtMs };
}

/** Human "in 47 min" / "overdue by 22 min" / "1h 5m" style label. */
export function formatCountdown(minutesUntil: number): string {
  const abs = Math.abs(minutesUntil);
  const text = abs >= 60 ? `${Math.floor(abs / 60)}h ${abs % 60}m` : `${abs} min`;
  if (minutesUntil < 0) return `overdue by ${text}`;
  if (minutesUntil === 0) return "due now";
  return `in ${text}`;
}

const ML_PER_30G = 8;

/** Rough per-feed target (ml) from the latest weight: ~8 ml per 30 g. */
export function perFeedTargetMl(latestWeightG: number): number {
  return Math.round((latestWeightG / 30) * ML_PER_30G * 10) / 10;
}

/** Rough expected daily intake (ml) = per-feed target × feeds per day. */
export function expectedDailyMl(latestWeightG: number, intervalMinutes: number): number {
  const feedsPerDay = (24 * 60) / intervalMinutes;
  return Math.round(perFeedTargetMl(latestWeightG) * feedsPerDay);
}

/** Sum of feed amounts (ml) on the local calendar day containing nowMs. */
export function intakeTodayMl(
  feeds: { fedAtMs: number; amountMl: number | null }[],
  nowMs: number = Date.now(),
): { totalMl: number; count: number } {
  const start = new Date(nowMs);
  start.setHours(0, 0, 0, 0);
  const startMs = start.getTime();
  let totalMl = 0;
  let count = 0;
  for (const f of feeds) {
    if (f.fedAtMs >= startMs && f.fedAtMs <= nowMs + 60_000) {
      totalMl += f.amountMl ?? 0;
      count += 1;
    }
  }
  return { totalMl: Math.round(totalMl * 10) / 10, count };
}
