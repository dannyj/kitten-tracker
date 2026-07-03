import { eq, inArray } from "drizzle-orm";
import { Cat, Pill, TriangleAlert, UtensilsCrossed } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { AlertBadge } from "@/components/alert-badge";
import { FeedCountdown } from "@/components/feed-countdown";
import { StatusBadge } from "@/components/status-badge";
import { Card, CardContent } from "@/components/ui/card";
import { db } from "@/db";
import { feedings, kittens, mothers } from "@/db/schema";
import { TREND_ARROW } from "@/lib/alerts";
import { requireUser } from "@/lib/auth/guard";
import { formatAge, todayIso } from "@/lib/dates";
import { medicalDueByKitten, motherDueBySubject } from "@/lib/medical-data";
import { daysUntil } from "@/lib/schedule";
import { coverPhotoIdByKitten } from "@/lib/photo-data";
import { getAlertSettings, getScheduleTemplates } from "@/lib/settings";
import { ACTIVE_STATUSES } from "@/lib/status";
import { alertsByKitten, weightPointsByKitten } from "@/lib/weight-data";
import { DashboardFeeding, type FeedingDueRow } from "./dashboard-feeding";
import { DashboardMedical, type MedicalDueRow } from "./dashboard-medical";

export const metadata = { title: "Dashboard — Kitten Tracker" };

export default async function DashboardPage() {
  await requireUser();

  const totalKittens = db.select({ id: kittens.id }).from(kittens).all().length;

  const activeKittens = db
    .select()
    .from(kittens)
    .where(inArray(kittens.status, ACTIVE_STATUSES))
    .orderBy(kittens.name)
    .all();
  const ids = activeKittens.map((k) => k.id);

  const settings = getAlertSettings();
  const alerts = alertsByKitten(ids, settings);
  const weightPoints = weightPointsByKitten(ids);
  const covers = coverPhotoIdByKitten(
    activeKittens.map((k) => ({ id: k.id, coverPhotoId: k.coverPhotoId })),
  );

  // Last feed per active hand-fed kitten.
  const handFedIds = activeKittens.filter((k) => k.feedingMethod === "hand").map((k) => k.id);
  const lastFedByKitten = new Map<number, number>();
  if (handFedIds.length > 0) {
    for (const r of db
      .select({ kittenId: feedings.kittenId, fedAt: feedings.fedAt })
      .from(feedings)
      .where(inArray(feedings.kittenId, handFedIds))
      .all()) {
      const ms = r.fedAt.getTime();
      const prev = lastFedByKitten.get(r.kittenId);
      if (prev === undefined || ms > prev) lastFedByKitten.set(r.kittenId, ms);
    }
  }

  const feedingRows: FeedingDueRow[] = activeKittens
    .filter((k) => k.feedingMethod === "hand")
    .map((k) => ({
      id: k.id,
      name: k.name,
      intervalMinutes: k.feedingIntervalMinutes,
      lastFedMs: lastFedByKitten.get(k.id) ?? null,
    }));

  // Medical-due: active kittens + in-care mothers with treatments overdue or due
  // ≤7 days. Kittens are template/birth-date driven; mothers are record driven.
  const WITHIN_DAYS = 7;
  const kittenTemplates = getScheduleTemplates("kitten");
  const motherTemplates = getScheduleTemplates("mother");
  const today = todayIso();
  const dueByKitten = medicalDueByKitten(
    activeKittens.map((k) => ({ id: k.id, birthDate: k.birthDate })),
    kittenTemplates,
    today,
  );
  const kittenMedicalRows: MedicalDueRow[] = activeKittens.flatMap((k) =>
    (dueByKitten.get(k.id) ?? []).map((item) => ({
      subjectType: "kitten" as const,
      subjectId: k.id,
      subjectName: k.name,
      vaccineType: item.vaccineType,
      label: item.label,
      dueDateIso: item.dueDateIso,
      overdue: item.overdue,
    })),
  );

  const careMothers = db
    .select({ id: mothers.id, name: mothers.name })
    .from(mothers)
    .where(eq(mothers.status, "in_care"))
    .all();
  const dueByMother = motherDueBySubject(
    careMothers.map((m) => m.id),
    motherTemplates,
    today,
  );
  const motherMedicalRows: MedicalDueRow[] = careMothers.flatMap((m) =>
    (dueByMother.get(m.id) ?? [])
      .filter((item) => item.overdue || daysUntil(item.dueDateIso, today) <= WITHIN_DAYS)
      .map((item) => ({
        subjectType: "mother" as const,
        subjectId: m.id,
        subjectName: m.name,
        vaccineType: item.vaccineType,
        label: item.label,
        dueDateIso: item.dueDateIso,
        overdue: item.overdue,
      })),
  );
  const medicalRows: MedicalDueRow[] = [...kittenMedicalRows, ...motherMedicalRows];

  // Alert center: flagged (urgent first), then warnings.
  const flagged = activeKittens
    .map((k) => ({ kitten: k, alert: alerts.get(k.id)! }))
    .filter(({ alert }) => alert.level === "urgent" || alert.level === "warning")
    .sort((a, b) => (a.alert.level === "urgent" ? 0 : 1) - (b.alert.level === "urgent" ? 0 : 1));

  if (totalKittens === 0) {
    return (
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed py-20 text-center">
          <div className="bg-muted flex size-14 items-center justify-center rounded-full">
            <Cat className="text-muted-foreground size-7" aria-hidden />
          </div>
          <p className="font-medium">No kittens yet</p>
          <p className="text-muted-foreground max-w-xs text-sm">
            Add a mother and her litter to get started — weights, feeding countdowns and alerts will
            show up here.
          </p>
          <Link href="/mothers/new" className="text-sm underline underline-offset-2">
            Add a mother
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <h1 className="text-2xl font-semibold">Dashboard</h1>

      {flagged.length > 0 ? (
        <section className="flex flex-col gap-3">
          <h2 className="flex items-center gap-2 text-lg font-medium">
            <TriangleAlert className="size-5" aria-hidden /> Needs attention
          </h2>
          <div className="flex flex-col gap-2">
            {flagged.map(({ kitten, alert }) => (
              <Link key={kitten.id} href={`/kittens/${kitten.id}`} className="group">
                <Card
                  className={
                    alert.level === "urgent"
                      ? "border-red-200 bg-red-50 transition-colors"
                      : "border-amber-200 bg-amber-50 transition-colors"
                  }
                >
                  <CardContent className="flex flex-col gap-1 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">{kitten.name}</span>
                      <AlertBadge result={alert} />
                    </div>
                    <p className="text-sm">{alert.reasons[0]}</p>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {feedingRows.length > 0 ? (
        <section className="flex flex-col gap-3">
          <h2 className="flex items-center gap-2 text-lg font-medium">
            <UtensilsCrossed className="size-5" aria-hidden /> Feeding due
          </h2>
          <DashboardFeeding rows={feedingRows} />
        </section>
      ) : null}

      <section className="flex flex-col gap-3">
        <h2 className="flex items-center gap-2 text-lg font-medium">
          <Pill className="size-5" aria-hidden /> Medical due
        </h2>
        <DashboardMedical
          rows={medicalRows}
          kittenTemplates={kittenTemplates}
          motherTemplates={motherTemplates}
          todayIso={today}
        />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="flex items-center gap-2 text-lg font-medium">
          <Cat className="size-5" aria-hidden /> Active kittens
        </h2>
        {activeKittens.length === 0 ? (
          <p className="text-muted-foreground rounded-lg border border-dashed p-4 text-sm">
            No active kittens right now.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {activeKittens.map((kitten) => {
              const points = weightPoints.get(kitten.id) ?? [];
              const last = points.at(-1);
              const alert = alerts.get(kitten.id);
              const coverId = covers.get(kitten.id);
              return (
                <Link key={kitten.id} href={`/kittens/${kitten.id}`} className="group">
                  <Card className="h-full transition-all group-hover:ring-primary/40 group-hover:shadow-sm">
                    <CardContent className="flex items-center gap-4">
                      {coverId ? (
                        <Image
                          src={`/api/photos/${coverId}?thumb=1`}
                          alt=""
                          width={72}
                          height={72}
                          unoptimized
                          className="size-18 shrink-0 rounded-xl object-cover"
                        />
                      ) : (
                        <span className="bg-muted flex size-18 shrink-0 items-center justify-center rounded-xl">
                          <Cat className="text-muted-foreground size-8" aria-hidden />
                        </span>
                      )}
                      <div className="flex min-w-0 flex-col gap-1.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="truncate text-base font-medium">{kitten.name}</span>
                          <StatusBadge status={kitten.status} />
                        </div>
                        <p className="text-muted-foreground text-sm">
                          {formatAge(kitten.birthDate, { estimated: kitten.birthDateEstimated }) ??
                            "age unknown"}
                          {last
                            ? ` · ${last.weightGrams} g${alert?.trend ? ` ${TREND_ARROW[alert.trend]}` : ""}`
                            : " · no weight"}
                        </p>
                        <div className="flex flex-wrap items-center gap-2">
                          {alert ? <AlertBadge result={alert} /> : null}
                          {kitten.feedingMethod === "hand" ? (
                            <FeedCountdown
                              lastFedMs={lastFedByKitten.get(kitten.id) ?? null}
                              intervalMinutes={kitten.feedingIntervalMinutes}
                            />
                          ) : null}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
