import { and, asc, eq, inArray, max, type SQL } from "drizzle-orm";
import { Cat, Plus } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { db } from "@/db";
import { kittens, KITTEN_STATUSES, statusHistory, type KittenStatus } from "@/db/schema";
import { requireUser } from "@/lib/auth/guard";
import { formatAge } from "@/lib/dates";
import { coverPhotoIdByKitten } from "@/lib/photo-data";
import { getAlertSettings } from "@/lib/settings";
import { ACTIVE_STATUSES } from "@/lib/status";
import { alertsByKitten } from "@/lib/weight-data";
import { FilterBar } from "./filter-bar";
import { KittensTable, type KittenRowView } from "./kittens-table";
import { litterOptionList } from "./litter-options";
import { WeighLitterButton } from "./weigh-litter-button";

export const metadata = { title: "Kittens — Kitten Tracker" };

const SEX_LABELS = { male: "♂", female: "♀", unknown: "?" } as const;

export default async function KittensPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; litter?: string }>;
}) {
  await requireUser();
  const { status, litter } = await searchParams;

  const conditions: SQL[] = [];
  if (!status || status === "default") {
    conditions.push(inArray(kittens.status, ACTIVE_STATUSES));
  } else if (status !== "all" && (KITTEN_STATUSES as readonly string[]).includes(status)) {
    conditions.push(eq(kittens.status, status as KittenStatus));
  }
  const litterId = Number(litter);
  if (Number.isInteger(litterId) && litterId > 0) {
    conditions.push(eq(kittens.litterId, litterId));
  }

  const rows = db
    .select()
    .from(kittens)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(asc(kittens.name))
    .all();

  // Deceased kittens show their age frozen at the date of death.
  const deceasedIds = rows.filter((k) => k.status === "deceased").map((k) => k.id);
  const deathDates = new Map<number, Date>();
  if (deceasedIds.length > 0) {
    const deaths = db
      .select({ kittenId: statusHistory.kittenId, at: max(statusHistory.changedAt) })
      .from(statusHistory)
      .where(
        and(inArray(statusHistory.kittenId, deceasedIds), eq(statusHistory.status, "deceased")),
      )
      .groupBy(statusHistory.kittenId)
      .all();
    for (const d of deaths) {
      if (d.at) deathDates.set(d.kittenId, d.at);
    }
  }

  // Alerts only apply to active kittens; evaluate just those rows.
  const activeIds = rows
    .filter((k) => (ACTIVE_STATUSES as string[]).includes(k.status))
    .map((k) => k.id);
  const alerts = alertsByKitten(activeIds, getAlertSettings());

  const covers = coverPhotoIdByKitten(
    rows.map((k) => ({ id: k.id, coverPhotoId: k.coverPhotoId })),
  );

  const rowViews: KittenRowView[] = rows.map((kitten) => ({
    id: kitten.id,
    name: kitten.name,
    handFeeding: kitten.handFeeding,
    coverPhotoId: covers.get(kitten.id) ?? null,
    shelterNumber: kitten.shelterNumber,
    sexLabel: SEX_LABELS[kitten.sex],
    ageText:
      formatAge(kitten.birthDate, {
        estimated: kitten.birthDateEstimated,
        until: deathDates.get(kitten.id),
      }) ?? "—",
    status: kitten.status,
    alert: alerts.get(kitten.id) ?? null,
  }));

  const litterOptions = litterOptionList();

  // Litters with at least one active kitten — the only ones worth weighing.
  const activeLitterIds = new Set(
    db
      .selectDistinct({ litterId: kittens.litterId })
      .from(kittens)
      .where(inArray(kittens.status, ACTIVE_STATUSES))
      .all()
      .map((r) => r.litterId)
      .filter((id): id is number => id !== null),
  );
  const weighableLitters = litterOptions.filter((l) => activeLitterIds.has(l.id));

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-2xl font-semibold">Kittens</h1>
          {/* Create actions, kept visually quiet (outline) and apart from the
              primary "Weigh litter" action below to avoid mis-taps. */}
          <div className="flex gap-2">
            <Button asChild variant="outline">
              <Link href="/litters/new">
                <Plus className="size-4" aria-hidden /> Litter
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/kittens/new">
                <Plus className="size-4" aria-hidden /> Kitten
              </Link>
            </Button>
          </div>
        </div>
        <WeighLitterButton litters={weighableLitters.map(({ id, label }) => ({ id, label }))} />
      </div>

      <FilterBar litterOptions={litterOptions.map(({ id, label }) => ({ id, label }))} />

      {rows.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed py-16 text-center">
          <Cat className="text-muted-foreground size-7" aria-hidden />
          <p className="font-medium">No kittens match</p>
          <p className="text-muted-foreground text-sm">
            Adjust the filters, or add a litter and its kittens.
          </p>
        </div>
      ) : (
        <KittensTable rows={rowViews} />
      )}
    </div>
  );
}
