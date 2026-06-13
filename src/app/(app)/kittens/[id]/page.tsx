import { asc, desc, eq } from "drizzle-orm";
import { Camera, Cat, LineChart, Milk, Pencil, Pill, Scale, UtensilsCrossed } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { AlertBanner } from "@/components/alert-banner";
import { HintsPanel } from "@/components/hints-panel";
import { PhotoGallery } from "@/components/photo-gallery";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/db";
import {
  adopters,
  feedings,
  kittens,
  litters,
  mothers,
  statusHistory,
  vaccinations,
  weightEntries,
} from "@/db/schema";
import { evaluateAlert, TREND_ARROW } from "@/lib/alerts";
import { requireUser } from "@/lib/auth/guard";
import { formatAge, formatDate, formatDateTime, todayIso } from "@/lib/dates";
import { buildKittenGrowthSeries } from "@/lib/growth";
import { getSubjectPhotos } from "@/lib/photo-data";
import { nextDueAll } from "@/lib/schedule";
import { getAlertSettings, getScheduleTemplates } from "@/lib/settings";
import { ACTIVE_STATUSES, STATUS_LABELS } from "@/lib/status";
import { FeedingCard, type FeedingRow } from "./feeding-card";
import { GrowthChart } from "./growth-chart";
import { MedicalCard, type VaccinationRow } from "./medical-card";
import { StatusControl } from "./status-control";
import { WeightsCard, type WeightRow } from "./weights-card";

const SEX_LABELS = { male: "Male", female: "Female", unknown: "Unknown" } as const;

export default async function KittenDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const idParse = z.coerce
    .number()
    .int()
    .positive()
    .safeParse((await params).id);
  if (!idParse.success) notFound();
  const kitten = db.select().from(kittens).where(eq(kittens.id, idParse.data)).get();
  if (!kitten) notFound();

  const litter = db.select().from(litters).where(eq(litters.id, kitten.litterId)).get();
  const mother = litter?.motherId
    ? db.select().from(mothers).where(eq(mothers.id, litter.motherId)).get()
    : undefined;
  const history = db
    .select()
    .from(statusHistory)
    .where(eq(statusHistory.kittenId, kitten.id))
    .orderBy(desc(statusHistory.changedAt), desc(statusHistory.id))
    .all();
  const isAdmin = user.role === "admin";
  const adopterRows = isAdmin
    ? db
        .select()
        .from(adopters)
        .where(eq(adopters.kittenId, kitten.id))
        .orderBy(asc(adopters.id))
        .all()
    : [];
  const adopter = adopterRows.at(-1);

  const deathDate =
    kitten.status === "deceased"
      ? history.find((h) => h.status === "deceased")?.changedAt
      : undefined;
  const age = formatAge(kitten.birthDate, {
    estimated: kitten.birthDateEstimated,
    until: deathDate,
  });

  // Weights, growth chart and alert (alerts only for active kittens).
  const settings = getAlertSettings();
  const weightRows = db
    .select()
    .from(weightEntries)
    .where(eq(weightEntries.kittenId, kitten.id))
    .orderBy(asc(weightEntries.weighedAt), asc(weightEntries.id))
    .all();
  const points = weightRows.map((w) => ({
    weighedAtMs: w.weighedAt.getTime(),
    weightGrams: w.weightGrams,
  }));
  const cardRows: WeightRow[] = weightRows
    .map((w) => ({
      id: w.id,
      weighedAtMs: w.weighedAt.getTime(),
      weightGrams: w.weightGrams,
      note: w.note,
      createdAtMs: w.createdAt.getTime(),
    }))
    .reverse(); // newest-first for display
  const growthSeries = buildKittenGrowthSeries(points, {
    minDailyGainG: settings.minDailyGainG,
    targetDailyGainG: settings.targetDailyGainG,
  });
  const isActive = (ACTIVE_STATUSES as string[]).includes(kitten.status);
  const alert = isActive ? evaluateAlert(points, settings) : null;
  const latestWeightG = points.at(-1)?.weightGrams ?? null;

  // Vaccinations / medical log.
  const vaccinationRowsRaw = db
    .select()
    .from(vaccinations)
    .where(eq(vaccinations.kittenId, kitten.id))
    .orderBy(desc(vaccinations.givenAt), desc(vaccinations.id))
    .all();
  const givenAtById = new Map(vaccinationRowsRaw.map((v) => [v.id, v.givenAt]));
  const vaccinationRows: VaccinationRow[] = vaccinationRowsRaw.map((v) => ({
    id: v.id,
    type: v.type,
    givenAtIso: v.givenAt,
    batchNumber: v.batchNumber,
    administeredBy: v.administeredBy,
    nextDueDateIso: v.nextDueDate,
    note: v.note,
    correctsOfDateIso: v.correctsId ? (givenAtById.get(v.correctsId) ?? null) : null,
    createdAtMs: v.createdAt.getTime(),
  }));
  const kittenPhotos = getSubjectPhotos("kitten", kitten.id);
  // Cover photo for the header: chosen cover, else most recent, else placeholder.
  const coverPhotoId = kitten.coverPhotoId ?? kittenPhotos.at(-1)?.id ?? null;
  const scheduleTemplatesList = getScheduleTemplates();
  // Count administered events (originals only, not corrections) per type.
  const givenCountByType: Record<string, number> = {};
  for (const v of vaccinationRowsRaw) {
    if (v.correctsId === null) givenCountByType[v.type] = (givenCountByType[v.type] ?? 0) + 1;
  }
  const dueItems =
    isActive && kitten.birthDate
      ? nextDueAll(kitten.birthDate, scheduleTemplatesList, givenCountByType, todayIso())
      : [];

  // Feedings (only surfaced when the kitten is hand-fed, but always loaded so
  // toggling the flag back on shows the preserved history).
  const feedingRows: FeedingRow[] = kitten.handFeeding
    ? db
        .select()
        .from(feedings)
        .where(eq(feedings.kittenId, kitten.id))
        .orderBy(desc(feedings.fedAt), desc(feedings.id))
        .all()
        .map((f) => ({
          id: f.id,
          fedAtMs: f.fedAt.getTime(),
          amountMl: f.amountMl,
          formula: f.formula,
          quality: f.quality,
          note: f.note,
          createdAtMs: f.createdAt.getTime(),
        }))
    : [];

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex items-start gap-3">
          {coverPhotoId ? (
            <Image
              src={`/api/photos/${coverPhotoId}?thumb=1`}
              alt={`${kitten.name}`}
              width={64}
              height={64}
              unoptimized
              className="size-16 shrink-0 rounded-lg object-cover"
            />
          ) : (
            <span className="bg-muted flex size-16 shrink-0 items-center justify-center rounded-lg">
              <Cat className="text-muted-foreground size-7" aria-hidden />
            </span>
          )}
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-semibold">
              {kitten.name}
              {kitten.handFeeding ? (
                <span
                  className="inline-flex items-center gap-1 rounded-full bg-sky-100 px-2 py-0.5 text-xs font-medium text-sky-900"
                  title="Hand-feeding"
                >
                  <Milk className="size-3" aria-hidden /> hand-fed
                </span>
              ) : null}
            </h1>
            <p className="text-muted-foreground mt-1 flex flex-wrap items-center gap-2 text-sm">
              {kitten.shelterNumber ? <span>#{kitten.shelterNumber}</span> : null}
              <span>{age ? `${age} old` : "age unknown"}</span>
              {deathDate ? (
                <span>(at {formatDate(deathDate.toISOString().slice(0, 10))})</span>
              ) : null}
              <StatusBadge status={kitten.status} />
            </p>
          </div>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href={`/kittens/${kitten.id}/edit`}>
            <Pencil className="size-4" aria-hidden /> Edit
          </Link>
        </Button>
      </div>

      {alert && (alert.level === "warning" || alert.level === "urgent") ? (
        <div className="flex flex-col gap-3">
          <AlertBanner result={alert} />
          <HintsPanel
            urgent={alert.level === "urgent"}
            feedingHref={kitten.handFeeding ? "#feeding" : undefined}
          />
        </div>
      ) : alert ? (
        <AlertBanner result={alert} />
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Profile</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                <div>
                  <dt className="text-muted-foreground text-xs font-medium uppercase">Sex</dt>
                  <dd>{SEX_LABELS[kitten.sex]}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground text-xs font-medium uppercase">
                    Color / markings
                  </dt>
                  <dd>{kitten.color ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground text-xs font-medium uppercase">
                    Birth date
                  </dt>
                  <dd>
                    {formatDate(kitten.birthDate)}
                    {kitten.birthDateEstimated ? " (estimated)" : ""}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground text-xs font-medium uppercase">Litter</dt>
                  <dd>
                    {mother ? (
                      <Link href={`/mothers/${mother.id}`} className="hover:underline">
                        {mother.name}&apos;s litter
                      </Link>
                    ) : (
                      "Orphan litter"
                    )}
                    {litter ? ` · born ${formatDate(litter.birthDate)}` : ""}
                  </dd>
                </div>
                {kitten.handFeeding ? (
                  <div>
                    <dt className="text-muted-foreground text-xs font-medium uppercase">
                      Feeding interval
                    </dt>
                    <dd>every {kitten.feedingIntervalMinutes} min</dd>
                  </div>
                ) : null}
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Change status</CardTitle>
            </CardHeader>
            <CardContent>
              <StatusControl kittenId={kitten.id} currentStatus={kitten.status} isAdmin={isAdmin} />
            </CardContent>
          </Card>

          {isAdmin && adopter ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Adopter</CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                  <div>
                    <dt className="text-muted-foreground text-xs font-medium uppercase">Name</dt>
                    <dd>{adopter.name}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground text-xs font-medium uppercase">
                      Adoption date
                    </dt>
                    <dd>{formatDate(adopter.adoptionDate)}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground text-xs font-medium uppercase">Phone</dt>
                    <dd>{adopter.phone ?? "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground text-xs font-medium uppercase">Email</dt>
                    <dd className="break-all">{adopter.email ?? "—"}</dd>
                  </div>
                  <div className="col-span-2">
                    <dt className="text-muted-foreground text-xs font-medium uppercase">Address</dt>
                    <dd className="whitespace-pre-wrap">{adopter.address ?? "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground text-xs font-medium uppercase">
                      Shelter ref.
                    </dt>
                    <dd>{adopter.shelterReference ?? "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground text-xs font-medium uppercase">Note</dt>
                    <dd>{adopter.note ?? "—"}</dd>
                  </div>
                </dl>
              </CardContent>
            </Card>
          ) : null}
        </div>

        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Status history</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="flex flex-col gap-0">
                {history.map((entry, i) => (
                  <li key={entry.id} className="relative flex gap-3 pb-4 last:pb-0">
                    {i < history.length - 1 ? (
                      <span
                        className="bg-border absolute top-3 left-[5px] h-full w-px"
                        aria-hidden
                      />
                    ) : null}
                    <span className="bg-primary relative mt-1.5 size-2.5 shrink-0 rounded-full" />
                    <div>
                      <p className="text-sm font-medium">{STATUS_LABELS[entry.status]}</p>
                      <p className="text-muted-foreground text-xs">
                        {formatDateTime(entry.changedAt)}
                      </p>
                      {entry.note ? <p className="mt-1 text-sm">{entry.note}</p> : null}
                    </div>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Scale className="size-4" aria-hidden /> Weights
                {alert && alert.avgDailyGainG !== null && alert.trend ? (
                  <span className="text-muted-foreground text-sm font-normal">
                    {TREND_ARROW[alert.trend]} {alert.avgDailyGainG} g/day
                  </span>
                ) : null}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <GrowthChart points={growthSeries} />
              <Button asChild variant="ghost" size="sm" className="self-start gap-1 px-2">
                <Link href={`/litters/${kitten.litterId}`}>
                  <LineChart className="size-4" aria-hidden /> Compare with littermates
                </Link>
              </Button>
              <WeightsCard kittenId={kitten.id} rows={cardRows} />
              {cardRows.length > 0 ? (
                <Link
                  href={`/kittens/${kitten.id}/weights`}
                  className="text-muted-foreground self-start text-xs underline underline-offset-2"
                >
                  Manage entries
                </Link>
              ) : null}
            </CardContent>
          </Card>

          {kitten.handFeeding ? (
            <Card id="feeding" className="scroll-mt-20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <UtensilsCrossed className="size-4" aria-hidden /> Hand-feeding
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <FeedingCard
                  kittenId={kitten.id}
                  intervalMinutes={kitten.feedingIntervalMinutes}
                  latestWeightG={latestWeightG}
                  rows={feedingRows}
                />
                {feedingRows.length > 0 ? (
                  <Link
                    href={`/kittens/${kitten.id}/feedings`}
                    className="text-muted-foreground self-start text-xs underline underline-offset-2"
                  >
                    Manage entries
                  </Link>
                ) : null}
              </CardContent>
            </Card>
          ) : null}

          <Card id="medical" className="scroll-mt-20">
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Pill className="size-4" aria-hidden /> Vaccinations & medical
              </CardTitle>
              <Button asChild size="sm" variant="outline">
                <Link href={`/export/kitten/${kitten.id}`}>Export</Link>
              </Button>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <MedicalCard
                kittenId={kitten.id}
                templates={scheduleTemplatesList}
                rows={vaccinationRows}
                dueItems={dueItems}
              />
              {vaccinationRows.length > 0 ? (
                <Link
                  href={`/kittens/${kitten.id}/medical`}
                  className="text-muted-foreground self-start text-xs underline underline-offset-2"
                >
                  Manage entries
                </Link>
              ) : null}
            </CardContent>
          </Card>

          {/* Structure is final now; this fills in during step 6 */}
          <Card id="photos" className="scroll-mt-20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Camera className="size-4" aria-hidden /> Photos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <PhotoGallery
                subjectType="kitten"
                subjectId={kitten.id}
                birthDateIso={kitten.birthDate}
                coverPhotoId={kitten.coverPhotoId}
                photos={kittenPhotos}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
