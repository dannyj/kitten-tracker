import { and, asc, eq, inArray } from "drizzle-orm";
import { FileText, Scale } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { AlertBadge } from "@/components/alert-badge";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/db";
import { kittens, litters, mothers } from "@/db/schema";
import { requireUser } from "@/lib/auth/guard";
import { formatAge, formatDate } from "@/lib/dates";
import { buildLitterSeries } from "@/lib/growth";
import { getAlertSettings } from "@/lib/settings";
import { ACTIVE_STATUSES } from "@/lib/status";
import { alertsByKitten, weightPointsByKitten } from "@/lib/weight-data";
import { LitterGrowthChart } from "./litter-growth-chart";

export const metadata = { title: "Litter — Kitten Tracker" };

export default async function LitterPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const idParse = z.coerce
    .number()
    .int()
    .positive()
    .safeParse((await params).id);
  if (!idParse.success) notFound();
  const litter = db.select().from(litters).where(eq(litters.id, idParse.data)).get();
  if (!litter) notFound();

  const mother = litter.motherId
    ? db.select().from(mothers).where(eq(mothers.id, litter.motherId)).get()
    : undefined;

  const activeKittens = db
    .select()
    .from(kittens)
    .where(and(eq(kittens.litterId, litter.id), inArray(kittens.status, ACTIVE_STATUSES)))
    .orderBy(asc(kittens.name))
    .all();

  const settings = getAlertSettings();
  const ids = activeKittens.map((k) => k.id);
  const pointsByKitten = weightPointsByKitten(ids);
  const alerts = alertsByKitten(ids, settings);
  const series = buildLitterSeries(
    activeKittens.map((k) => ({
      kittenId: k.id,
      name: k.name,
      samples: pointsByKitten.get(k.id) ?? [],
    })),
  );

  const title = mother ? `${mother.name}'s litter` : "Orphan litter";

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold">{title}</h1>
          <p className="text-muted-foreground text-sm">
            Born {formatDate(litter.birthDate)}
            {litter.birthDateEstimated ? " (estimated)" : ""}
            {mother ? (
              <>
                {" · "}
                <Link href={`/mothers/${mother.id}`} className="hover:underline">
                  {mother.name}
                </Link>
              </>
            ) : null}
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href={`/export/litter/${litter.id}`}>
              <FileText className="size-4" aria-hidden /> Export
            </Link>
          </Button>
          <Button asChild>
            <Link href={`/litters/${litter.id}/weigh`}>
              <Scale className="size-4" aria-hidden /> Weigh litter
            </Link>
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Growth — active siblings</CardTitle>
        </CardHeader>
        <CardContent>
          {activeKittens.length === 0 ? (
            <p className="text-muted-foreground text-sm">No active kittens in this litter.</p>
          ) : (
            <LitterGrowthChart series={series} />
          )}
        </CardContent>
      </Card>

      {activeKittens.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Kittens</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col gap-1">
              {activeKittens.map((k) => {
                const alert = alerts.get(k.id);
                return (
                  <li key={k.id}>
                    <Link
                      href={`/kittens/${k.id}`}
                      className="hover:bg-muted flex items-center justify-between gap-2 rounded-md px-2 py-2 text-sm"
                    >
                      <span className="font-medium">{k.name}</span>
                      <span className="flex items-center gap-2">
                        {alert ? <AlertBadge result={alert} /> : null}
                        <span className="text-muted-foreground text-xs">
                          {formatAge(k.birthDate, { estimated: k.birthDateEstimated }) ?? "—"}
                        </span>
                        <StatusBadge status={k.status} />
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
