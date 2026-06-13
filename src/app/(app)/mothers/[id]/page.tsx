import { asc, desc, eq, inArray } from "drizzle-orm";
import { Camera, Pencil, Plus } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { AlertBadge } from "@/components/alert-badge";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/db";
import { kittens, litters, motherHealthLogs, mothers } from "@/db/schema";
import { requireUser } from "@/lib/auth/guard";
import { formatAge, formatDate } from "@/lib/dates";
import { getAlertSettings } from "@/lib/settings";
import { ACTIVE_STATUSES } from "@/lib/status";
import { alertsByKitten } from "@/lib/weight-data";
import { HealthLog } from "./health-log";

const MOTHER_STATUS_LABELS: Record<string, string> = {
  in_care: "In care",
  returned: "Returned to shelter",
  deceased: "Deceased",
};

export default async function MotherDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const idParse = z.coerce
    .number()
    .int()
    .positive()
    .safeParse((await params).id);
  if (!idParse.success) notFound();
  const mother = db.select().from(mothers).where(eq(mothers.id, idParse.data)).get();
  if (!mother) notFound();

  const motherLitters = db
    .select()
    .from(litters)
    .where(eq(litters.motherId, mother.id))
    .orderBy(desc(litters.id))
    .all();
  const litterKittens =
    motherLitters.length > 0
      ? db
          .select()
          .from(kittens)
          .where(
            inArray(
              kittens.litterId,
              motherLitters.map((l) => l.id),
            ),
          )
          .orderBy(asc(kittens.name))
          .all()
      : [];
  const activeKittenIds = litterKittens
    .filter((k) => (ACTIVE_STATUSES as string[]).includes(k.status))
    .map((k) => k.id);
  const kittenAlerts = alertsByKitten(activeKittenIds, getAlertSettings());
  const logs = db
    .select()
    .from(motherHealthLogs)
    .where(eq(motherHealthLogs.motherId, mother.id))
    .orderBy(desc(motherHealthLogs.loggedAt), desc(motherHealthLogs.id))
    .all();

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold">{mother.name}</h1>
          <p className="text-muted-foreground text-sm">
            {mother.shelterNumber ? `#${mother.shelterNumber} · ` : ""}
            intake {formatDate(mother.intakeDate)} ·{" "}
            {MOTHER_STATUS_LABELS[mother.status] ?? mother.status}
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href={`/mothers/${mother.id}/edit`}>
            <Pencil className="size-4" aria-hidden /> Edit
          </Link>
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Profile</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <div>
                <p className="text-muted-foreground text-xs font-medium uppercase">
                  Behaviour notes
                </p>
                <p className="mt-1 text-sm whitespace-pre-wrap">
                  {mother.notesBehaviour || "No notes yet."}
                </p>
              </div>
              {/* Photo slot — uploads arrive in step 6 */}
              <div className="text-muted-foreground flex items-center gap-2 rounded-lg border border-dashed p-4 text-sm">
                <Camera className="size-4" aria-hidden /> Photos coming soon
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Litters & kittens</CardTitle>
              <Button asChild size="sm" variant="outline">
                <Link href={`/litters/new?mother=${mother.id}`}>
                  <Plus className="size-4" aria-hidden /> Add litter
                </Link>
              </Button>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {motherLitters.length === 0 ? (
                <p className="text-muted-foreground text-sm">No litters yet.</p>
              ) : (
                motherLitters.map((litter) => {
                  const inLitter = litterKittens.filter((k) => k.litterId === litter.id);
                  return (
                    <div key={litter.id} className="rounded-lg border p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-medium">
                          Litter · born {formatDate(litter.birthDate)}
                          {litter.birthDateEstimated ? " (estimated)" : ""}
                        </p>
                        <Button asChild size="sm" variant="ghost" className="h-7 px-2 text-xs">
                          <Link href={`/kittens/new?litter=${litter.id}`}>
                            <Plus className="size-3" aria-hidden /> Add kitten
                          </Link>
                        </Button>
                      </div>
                      {litter.notes ? (
                        <p className="text-muted-foreground mt-1 text-xs">{litter.notes}</p>
                      ) : null}
                      {inLitter.length === 0 ? (
                        <p className="text-muted-foreground mt-2 text-sm">No kittens yet.</p>
                      ) : (
                        <ul className="mt-2 flex flex-col gap-1">
                          {inLitter.map((kitten) => (
                            <li key={kitten.id}>
                              <Link
                                href={`/kittens/${kitten.id}`}
                                className="hover:bg-muted flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm"
                              >
                                <span className="font-medium">{kitten.name}</span>
                                <span className="flex items-center gap-2">
                                  {kittenAlerts.has(kitten.id) ? (
                                    <AlertBadge result={kittenAlerts.get(kitten.id)!} />
                                  ) : null}
                                  <span className="text-muted-foreground text-xs">
                                    {formatAge(kitten.birthDate, {
                                      estimated: kitten.birthDateEstimated,
                                    }) ?? "age unknown"}
                                  </span>
                                  <StatusBadge status={kitten.status} />
                                </span>
                              </Link>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Health log</CardTitle>
          </CardHeader>
          <CardContent>
            <HealthLog
              motherId={mother.id}
              logs={logs.map((log) => ({
                id: log.id,
                category: log.category,
                entry: log.entry,
                loggedAtMs: log.loggedAt.getTime(),
              }))}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
