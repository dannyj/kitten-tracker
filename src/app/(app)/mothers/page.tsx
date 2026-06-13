import { count, desc, max } from "drizzle-orm";
import { Heart, Plus } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { db } from "@/db";
import { litters, motherHealthLogs, mothers } from "@/db/schema";
import { requireUser } from "@/lib/auth/guard";
import { formatDate, formatDateTime } from "@/lib/dates";

export const metadata = { title: "Mothers — Kitten Tracker" };

const MOTHER_STATUS_LABELS: Record<string, string> = {
  in_care: "In care",
  returned: "Returned to shelter",
  deceased: "Deceased",
};

export default async function MothersPage() {
  await requireUser();

  const rows = db.select().from(mothers).orderBy(desc(mothers.createdAt)).all();
  const litterCounts = db
    .select({ motherId: litters.motherId, n: count() })
    .from(litters)
    .groupBy(litters.motherId)
    .all();
  const lastLogs = db
    .select({ motherId: motherHealthLogs.motherId, last: max(motherHealthLogs.loggedAt) })
    .from(motherHealthLogs)
    .groupBy(motherHealthLogs.motherId)
    .all();
  const littersByMother = new Map(litterCounts.map((r) => [r.motherId, r.n]));
  const lastLogByMother = new Map(lastLogs.map((r) => [r.motherId, r.last]));

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Mothers</h1>
        <Button asChild>
          <Link href="/mothers/new">
            <Plus className="size-4" aria-hidden /> Add mother
          </Link>
        </Button>
      </div>

      {rows.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed py-16 text-center">
          <Heart className="text-muted-foreground size-7" aria-hidden />
          <p className="font-medium">No mothers yet</p>
          <p className="text-muted-foreground text-sm">Add a mother to start a litter.</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {rows.map((mother) => {
            const lastLog = lastLogByMother.get(mother.id);
            return (
              <Link key={mother.id} href={`/mothers/${mother.id}`} className="group">
                <Card className="group-hover:border-primary/50 transition-colors">
                  <CardContent className="flex flex-col gap-1 p-4">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">{mother.name}</span>
                      <span className="text-muted-foreground text-xs">
                        {MOTHER_STATUS_LABELS[mother.status] ?? mother.status}
                      </span>
                    </div>
                    <p className="text-muted-foreground text-sm">
                      {mother.shelterNumber ? `#${mother.shelterNumber} · ` : ""}
                      intake {formatDate(mother.intakeDate)}
                    </p>
                    <p className="text-muted-foreground text-sm">
                      {littersByMother.get(mother.id) ?? 0} litter(s)
                      {lastLog
                        ? ` · last health log ${formatDateTime(lastLog)}`
                        : " · no health logs"}
                    </p>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
