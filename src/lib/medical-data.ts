import "server-only";

import { inArray } from "drizzle-orm";
import { db } from "@/db";
import { vaccinations } from "@/db/schema";
import { daysUntil, nextDueAll, type DueItem, type ScheduleTemplate } from "@/lib/schedule";

/**
 * Per-kitten medical items that are overdue or due within `withinDays`, derived
 * from the schedule templates vs administered history (corrections don't count
 * as new doses).
 */
export function medicalDueByKitten(
  kittens: { id: number; birthDate: string | null }[],
  templates: ScheduleTemplate[],
  todayIso: string,
  withinDays = 7,
): Map<number, DueItem[]> {
  const ids = kittens.map((k) => k.id);
  const countsByKitten = new Map<number, Record<string, number>>();

  if (ids.length > 0) {
    const rows = db
      .select({
        kittenId: vaccinations.kittenId,
        type: vaccinations.type,
        correctsId: vaccinations.correctsId,
      })
      .from(vaccinations)
      .where(inArray(vaccinations.kittenId, ids))
      .all();
    for (const r of rows) {
      if (r.correctsId !== null) continue; // corrections aren't separate doses
      const m = countsByKitten.get(r.kittenId) ?? {};
      m[r.type] = (m[r.type] ?? 0) + 1;
      countsByKitten.set(r.kittenId, m);
    }
  }

  const out = new Map<number, DueItem[]>();
  for (const k of kittens) {
    if (!k.birthDate) {
      out.set(k.id, []);
      continue;
    }
    const due = nextDueAll(k.birthDate, templates, countsByKitten.get(k.id) ?? {}, todayIso).filter(
      (item) => item.overdue || daysUntil(item.dueDateIso, todayIso) <= withinDays,
    );
    out.set(k.id, due);
  }
  return out;
}
