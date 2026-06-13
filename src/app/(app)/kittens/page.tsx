import { and, asc, eq, inArray, max, type SQL } from "drizzle-orm";
import { Cat, Milk, Plus } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { AlertBadge } from "@/components/alert-badge";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { db } from "@/db";
import { kittens, KITTEN_STATUSES, statusHistory, type KittenStatus } from "@/db/schema";
import { requireUser } from "@/lib/auth/guard";
import { formatAge } from "@/lib/dates";
import { coverPhotoIdByKitten } from "@/lib/photo-data";
import { getAlertSettings } from "@/lib/settings";
import { ACTIVE_STATUSES } from "@/lib/status";
import { alertsByKitten } from "@/lib/weight-data";
import { FilterBar } from "./filter-bar";
import { litterOptionList } from "./litter-options";

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

  const litterOptions = litterOptionList();

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Kittens</h1>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href="/litters/new">
              <Plus className="size-4" aria-hidden /> Litter
            </Link>
          </Button>
          <Button asChild>
            <Link href="/kittens/new">
              <Plus className="size-4" aria-hidden /> Kitten
            </Link>
          </Button>
        </div>
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
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead className="hidden sm:table-cell">Shelter #</TableHead>
                <TableHead className="hidden sm:table-cell">Sex</TableHead>
                <TableHead>Age</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((kitten) => (
                <TableRow key={kitten.id}>
                  <TableCell>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {covers.get(kitten.id) ? (
                        <Image
                          src={`/api/photos/${covers.get(kitten.id)}?thumb=1`}
                          alt=""
                          width={28}
                          height={28}
                          unoptimized
                          className="size-7 shrink-0 rounded-full object-cover"
                        />
                      ) : (
                        <span className="bg-muted flex size-7 shrink-0 items-center justify-center rounded-full">
                          <Cat className="text-muted-foreground size-3.5" aria-hidden />
                        </span>
                      )}
                      <Link
                        href={`/kittens/${kitten.id}`}
                        className="flex items-center gap-1.5 font-medium hover:underline"
                      >
                        {kitten.name}
                        {kitten.handFeeding ? (
                          <Milk
                            className="size-3.5 shrink-0 text-sky-600"
                            aria-label="Hand-feeding"
                          />
                        ) : null}
                      </Link>
                      {alerts.has(kitten.id) ? (
                        <AlertBadge result={alerts.get(kitten.id)!} />
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground hidden sm:table-cell">
                    {kitten.shelterNumber ?? "—"}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">{SEX_LABELS[kitten.sex]}</TableCell>
                  <TableCell>
                    {formatAge(kitten.birthDate, {
                      estimated: kitten.birthDateEstimated,
                      until: deathDates.get(kitten.id),
                    }) ?? "—"}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={kitten.status} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
