import "server-only";

import { asc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { weightEntries } from "@/db/schema";
import {
  evaluateAlert,
  type AlertResult,
  type AlertSettings,
  type WeighFeedback,
  type WeightPoint,
} from "@/lib/alerts";

/** Weight points (ascending) for a set of kittens, grouped by kitten id. */
export function weightPointsByKitten(kittenIds: number[]): Map<number, WeightPoint[]> {
  const byKitten = new Map<number, WeightPoint[]>();
  if (kittenIds.length === 0) return byKitten;

  const rows = db
    .select({
      kittenId: weightEntries.kittenId,
      weighedAt: weightEntries.weighedAt,
      weightGrams: weightEntries.weightGrams,
    })
    .from(weightEntries)
    .where(inArray(weightEntries.kittenId, kittenIds))
    .orderBy(asc(weightEntries.weighedAt))
    .all();

  for (const id of kittenIds) byKitten.set(id, []);
  for (const row of rows) {
    byKitten.get(row.kittenId)?.push({
      weighedAtMs: row.weighedAt.getTime(),
      weightGrams: row.weightGrams,
    });
  }
  return byKitten;
}

/**
 * Instant feedback for a just-saved weighing, identified by its row id: how much
 * it changed versus the chronologically-previous weighing, plus the engine's
 * verdict over the full history. Keyed by id (not "latest") because a quick-add's
 * datetime-local is minute-precise and can tie or sort just behind an existing
 * entry — the feedback must describe the entry the user actually entered.
 * Returns null if the entry isn't found.
 */
export function weighFeedback(
  kittenId: number,
  entryId: number,
  settings: AlertSettings,
  nowMs: number = Date.now(),
): WeighFeedback | null {
  const rows = db
    .select({
      id: weightEntries.id,
      weighedAt: weightEntries.weighedAt,
      weightGrams: weightEntries.weightGrams,
    })
    .from(weightEntries)
    .where(eq(weightEntries.kittenId, kittenId))
    .orderBy(asc(weightEntries.weighedAt), asc(weightEntries.id))
    .all();

  const idx = rows.findIndex((r) => r.id === entryId);
  if (idx === -1) return null;
  const entry = rows[idx];
  const prev = idx > 0 ? rows[idx - 1] : null;
  const points: WeightPoint[] = rows.map((r) => ({
    weighedAtMs: r.weighedAt.getTime(),
    weightGrams: r.weightGrams,
  }));

  return {
    weightGrams: entry.weightGrams,
    deltaGrams: prev ? entry.weightGrams - prev.weightGrams : null,
    alert: evaluateAlert(points, settings, nowMs),
  };
}

/** Evaluate alerts for many kittens at once using the given live settings. */
export function alertsByKitten(
  kittenIds: number[],
  settings: AlertSettings,
  nowMs: number = Date.now(),
): Map<number, AlertResult> {
  const points = weightPointsByKitten(kittenIds);
  const result = new Map<number, AlertResult>();
  for (const id of kittenIds) {
    result.set(id, evaluateAlert(points.get(id) ?? [], settings, nowMs));
  }
  return result;
}
