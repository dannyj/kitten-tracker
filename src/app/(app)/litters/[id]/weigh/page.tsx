import { and, asc, eq, inArray } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { db } from "@/db";
import { kittens, litters, mothers } from "@/db/schema";
import { requireUser } from "@/lib/auth/guard";
import { formatDate } from "@/lib/dates";
import { coverPhotoIdByKitten } from "@/lib/photo-data";
import { ACTIVE_STATUSES } from "@/lib/status";
import { weightPointsByKitten } from "@/lib/weight-data";
import { WeighFlow, type WeighTarget } from "./weigh-flow";

export const metadata = { title: "Weigh litter — Kitten Tracker" };

export default async function WeighLitterPage({ params }: { params: Promise<{ id: string }> }) {
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

  const points = weightPointsByKitten(activeKittens.map((k) => k.id));
  const covers = coverPhotoIdByKitten(
    activeKittens.map((k) => ({ id: k.id, coverPhotoId: k.coverPhotoId })),
  );
  const targets: WeighTarget[] = activeKittens.map((k) => {
    const kp = points.get(k.id) ?? [];
    return {
      id: k.id,
      name: k.name,
      lastWeightGrams: kp.at(-1)?.weightGrams ?? null,
      coverPhotoId: covers.get(k.id) ?? null,
    };
  });

  const title = `${mother ? `${mother.name}'s litter` : "Orphan litter"} · born ${formatDate(litter.birthDate)}`;

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Weigh litter</h1>
        <p className="text-muted-foreground text-sm">{title}</p>
      </div>
      {targets.length === 0 ? (
        <div className="flex flex-col items-start gap-3 rounded-lg border border-dashed p-6">
          <p className="text-sm">No active kittens in this litter to weigh.</p>
          <Button asChild variant="outline">
            <Link href="/kittens">Back to kittens</Link>
          </Button>
        </div>
      ) : (
        <WeighFlow litterId={litter.id} kittens={targets} />
      )}
    </div>
  );
}
