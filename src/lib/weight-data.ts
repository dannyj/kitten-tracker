import "server-only";

import { asc, inArray } from "drizzle-orm";
import { db } from "@/db";
import { weightEntries } from "@/db/schema";
import {
  evaluateAlert,
  type AlertResult,
  type AlertSettings,
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
