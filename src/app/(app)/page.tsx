import { and, eq, inArray } from "drizzle-orm";
import { Cat, Pill, UtensilsCrossed } from "lucide-react";
import { db } from "@/db";
import { feedings, kittens } from "@/db/schema";
import { requireUser } from "@/lib/auth/guard";
import { todayIso } from "@/lib/dates";
import { medicalDueByKitten } from "@/lib/medical-data";
import { getScheduleTemplates } from "@/lib/settings";
import { ACTIVE_STATUSES } from "@/lib/status";
import { DashboardFeeding, type FeedingDueRow } from "./dashboard-feeding";
import { DashboardMedical, type MedicalDueRow } from "./dashboard-medical";

export const metadata = { title: "Dashboard — Kitten Tracker" };

export default async function DashboardPage() {
  await requireUser();

  const totalKittens = db.select({ id: kittens.id }).from(kittens).all().length;

  const handFed = db
    .select({ id: kittens.id, name: kittens.name, intervalMinutes: kittens.feedingIntervalMinutes })
    .from(kittens)
    .where(and(eq(kittens.handFeeding, true), inArray(kittens.status, ACTIVE_STATUSES)))
    .all();

  // Last feed per hand-fed kitten (one query, grouped client-side).
  const lastFedByKitten = new Map<number, number>();
  if (handFed.length > 0) {
    const rows = db
      .select({ kittenId: feedings.kittenId, fedAt: feedings.fedAt })
      .from(feedings)
      .where(
        inArray(
          feedings.kittenId,
          handFed.map((k) => k.id),
        ),
      )
      .all();
    for (const r of rows) {
      const ms = r.fedAt.getTime();
      const prev = lastFedByKitten.get(r.kittenId);
      if (prev === undefined || ms > prev) lastFedByKitten.set(r.kittenId, ms);
    }
  }

  const feedingRows: FeedingDueRow[] = handFed.map((k) => ({
    id: k.id,
    name: k.name,
    intervalMinutes: k.intervalMinutes,
    lastFedMs: lastFedByKitten.get(k.id) ?? null,
  }));

  // Medical-due panel: active kittens with vaccinations overdue or due ≤7 days.
  const activeKittens = db
    .select({ id: kittens.id, name: kittens.name, birthDate: kittens.birthDate })
    .from(kittens)
    .where(inArray(kittens.status, ACTIVE_STATUSES))
    .all();
  const templates = getScheduleTemplates();
  const today = todayIso();
  const dueByKitten = medicalDueByKitten(activeKittens, templates, today);
  const medicalRows: MedicalDueRow[] = activeKittens.flatMap((k) =>
    (dueByKitten.get(k.id) ?? []).map((item) => ({
      kittenId: k.id,
      kittenName: k.name,
      vaccineType: item.vaccineType,
      label: item.label,
      dueDateIso: item.dueDateIso,
      overdue: item.overdue,
    })),
  );

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <h1 className="text-2xl font-semibold">Dashboard</h1>

      {totalKittens === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed py-20 text-center">
          <div className="bg-muted flex size-14 items-center justify-center rounded-full">
            <Cat className="text-muted-foreground size-7" aria-hidden />
          </div>
          <p className="font-medium">No kittens yet</p>
          <p className="text-muted-foreground max-w-xs text-sm">
            Once kittens are added, their weights, feeding countdowns and alerts will show up here.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          <section className="flex flex-col gap-3">
            <h2 className="flex items-center gap-2 text-lg font-medium">
              <UtensilsCrossed className="size-5" aria-hidden /> Feeding due
            </h2>
            <DashboardFeeding rows={feedingRows} />
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="flex items-center gap-2 text-lg font-medium">
              <Pill className="size-5" aria-hidden /> Medical due
            </h2>
            <DashboardMedical rows={medicalRows} templates={templates} todayIso={today} />
          </section>
        </div>
      )}
    </div>
  );
}
