import "server-only";

import { asc, eq, inArray } from "drizzle-orm";
import type { ViewingItem } from "@/app/(app)/viewings/viewing-list";
import { db } from "@/db";
import { interestedParties, type KittenStatus, kittens, viewingKittens, viewings } from "@/db/schema";

/**
 * Assemble the calendar/party view-model for viewings — optionally scoped to one
 * party — joining each viewing to its party (id/name/status) and its kittens, in
 * a fixed number of queries (no N+1).
 */
export function getViewingItems(opts: { partyId?: number } = {}): ViewingItem[] {
  const rows = db
    .select()
    .from(viewings)
    .where(opts.partyId ? eq(viewings.interestedPartyId, opts.partyId) : undefined)
    .orderBy(asc(viewings.visitedAt), asc(viewings.id))
    .all();
  if (rows.length === 0) return [];

  const partyIds = [...new Set(rows.map((r) => r.interestedPartyId))];
  const parties = db
    .select({
      id: interestedParties.id,
      name: interestedParties.name,
      status: interestedParties.status,
    })
    .from(interestedParties)
    .where(inArray(interestedParties.id, partyIds))
    .all();
  const partyMap = new Map(parties.map((p) => [p.id, p]));

  const viewingIds = rows.map((r) => r.id);
  const vk = db
    .select({ viewingId: viewingKittens.viewingId, id: kittens.id, name: kittens.name })
    .from(viewingKittens)
    .innerJoin(kittens, eq(viewingKittens.kittenId, kittens.id))
    .where(inArray(viewingKittens.viewingId, viewingIds))
    .all();
  const kittensByViewing = new Map<number, { id: number; name: string }[]>();
  for (const r of vk) {
    const list = kittensByViewing.get(r.viewingId) ?? [];
    list.push({ id: r.id, name: r.name });
    kittensByViewing.set(r.viewingId, list);
  }

  return rows.flatMap((r) => {
    const party = partyMap.get(r.interestedPartyId);
    if (!party) return []; // party FK is restrict, so this is defensive only
    return [
      {
        id: r.id,
        visitedAtMs: r.visitedAt.getTime(),
        location: r.location,
        notes: r.notes,
        party,
        kittens: kittensByViewing.get(r.id) ?? [],
      },
    ];
  });
}

/**
 * Split chronological viewing items into upcoming vs past (most-recent-first).
 * Lives here (not in the component) so server components stay render-pure — no
 * Date.now() in a component body. visitedAtMs is an absolute instant, so the
 * comparison is timezone-independent.
 */
export function groupViewingsByTime(items: ViewingItem[]): {
  upcoming: ViewingItem[];
  past: ViewingItem[];
} {
  const now = Date.now();
  return {
    upcoming: items.filter((i) => i.visitedAtMs >= now),
    past: items.filter((i) => i.visitedAtMs < now).reverse(),
  };
}

/** Distinct kittens a party is linked to via their viewings, with current status. */
export function getPartyLinkedKittens(
  partyId: number,
): { id: number; name: string; status: KittenStatus }[] {
  const rows = db
    .selectDistinct({ id: kittens.id, name: kittens.name, status: kittens.status })
    .from(viewingKittens)
    .innerJoin(viewings, eq(viewingKittens.viewingId, viewings.id))
    .innerJoin(kittens, eq(viewingKittens.kittenId, kittens.id))
    .where(eq(viewings.interestedPartyId, partyId))
    .orderBy(asc(kittens.name))
    .all();
  return rows;
}
