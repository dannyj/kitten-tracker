import { desc, eq } from "drizzle-orm";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/db";
import { feedings, kittens, weightEntries } from "@/db/schema";
import { requireUser } from "@/lib/auth/guard";
import { FeedingCard, type FeedingRow } from "../feeding-card";

export const metadata = { title: "Manage feeds — Kitten Tracker" };

export default async function ManageFeedingsPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const idParse = z.coerce
    .number()
    .int()
    .positive()
    .safeParse((await params).id);
  if (!idParse.success) notFound();
  const kitten = db.select().from(kittens).where(eq(kittens.id, idParse.data)).get();
  if (!kitten) notFound();

  const rows: FeedingRow[] = db
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
    }));
  const latestWeight = db
    .select({ weightGrams: weightEntries.weightGrams })
    .from(weightEntries)
    .where(eq(weightEntries.kittenId, kitten.id))
    .orderBy(desc(weightEntries.weighedAt))
    .get();

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
      <Button asChild variant="ghost" size="sm" className="self-start gap-1 px-2">
        <Link href={`/kittens/${kitten.id}`}>
          <ArrowLeft className="size-4" aria-hidden /> Back to {kitten.name}
        </Link>
      </Button>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Manage feeds — {kitten.name}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground mb-4 text-sm">
            Correct or delete entries within 15 minutes of logging. Older entries are locked.
          </p>
          <FeedingCard
            kittenId={kitten.id}
            intervalMinutes={kitten.feedingIntervalMinutes}
            latestWeightG={latestWeight?.weightGrams ?? null}
            rows={rows}
            manage
          />
        </CardContent>
      </Card>
    </div>
  );
}
