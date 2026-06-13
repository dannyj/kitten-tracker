import { asc, eq, inArray } from "drizzle-orm";
import { CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { AlertBadge } from "@/components/alert-badge";
import { Card, CardContent } from "@/components/ui/card";
import { db } from "@/db";
import { kittens, litters, mothers } from "@/db/schema";
import { type AlertResult } from "@/lib/alerts";
import { requireUser } from "@/lib/auth/guard";
import { getAlertSettings } from "@/lib/settings";
import { ACTIVE_STATUSES } from "@/lib/status";
import { alertsByKitten } from "@/lib/weight-data";

export const metadata = { title: "Alerts — Kitten Tracker" };

const SEVERITY_ORDER: Record<AlertResult["level"], number> = {
  urgent: 0,
  warning: 1,
  ok: 2,
  insufficient: 3,
};

export default async function AlertsPage() {
  await requireUser();
  const settings = getAlertSettings();

  const activeKittens = db
    .select({
      id: kittens.id,
      name: kittens.name,
      litterId: kittens.litterId,
      motherName: mothers.name,
    })
    .from(kittens)
    .innerJoin(litters, eq(kittens.litterId, litters.id))
    .leftJoin(mothers, eq(litters.motherId, mothers.id))
    .where(inArray(kittens.status, ACTIVE_STATUSES))
    .orderBy(asc(kittens.name))
    .all();

  const alerts = alertsByKitten(
    activeKittens.map((k) => k.id),
    settings,
  );

  const flagged = activeKittens
    .map((k) => ({ kitten: k, alert: alerts.get(k.id)! }))
    .filter(({ alert }) => alert.level === "urgent" || alert.level === "warning")
    .sort(
      (a, b) =>
        SEVERITY_ORDER[a.alert.level] - SEVERITY_ORDER[b.alert.level] ||
        a.kitten.name.localeCompare(b.kitten.name),
    );

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Alert center</h1>
        <p className="text-muted-foreground text-sm">
          Active kittens that need attention, most urgent first.
        </p>
      </div>

      {flagged.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed py-16 text-center">
          <CheckCircle2 className="size-8 text-emerald-600" aria-hidden />
          <p className="font-medium">No active warnings</p>
          <p className="text-muted-foreground text-sm">
            Every active kitten is on track or doesn&apos;t have enough data yet.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {flagged.map(({ kitten, alert }) => (
            <Link key={kitten.id} href={`/kittens/${kitten.id}`} className="group">
              <Card className="group-hover:border-primary/50 transition-colors">
                <CardContent className="flex flex-col gap-1 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{kitten.name}</span>
                    <AlertBadge result={alert} showAll />
                  </div>
                  <p className="text-muted-foreground text-xs">
                    {kitten.motherName ? `${kitten.motherName}'s litter` : "Orphan litter"}
                  </p>
                  <ul className="mt-1 flex flex-col gap-0.5 text-sm">
                    {alert.reasons.map((reason, i) => (
                      <li key={i}>{reason}</li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
