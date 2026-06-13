import { desc, eq } from "drizzle-orm";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/db";
import { kittens, vaccinations } from "@/db/schema";
import { requireUser } from "@/lib/auth/guard";
import { getScheduleTemplates } from "@/lib/settings";
import { MedicalCard, type VaccinationRow } from "../medical-card";

export const metadata = { title: "Manage medical — Kitten Tracker" };

export default async function ManageMedicalPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const idParse = z.coerce
    .number()
    .int()
    .positive()
    .safeParse((await params).id);
  if (!idParse.success) notFound();
  const kitten = db.select().from(kittens).where(eq(kittens.id, idParse.data)).get();
  if (!kitten) notFound();

  const raw = db
    .select()
    .from(vaccinations)
    .where(eq(vaccinations.kittenId, kitten.id))
    .orderBy(desc(vaccinations.givenAt), desc(vaccinations.id))
    .all();
  const givenAtById = new Map(raw.map((v) => [v.id, v.givenAt]));
  const rows: VaccinationRow[] = raw.map((v) => ({
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

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
      <Button asChild variant="ghost" size="sm" className="self-start gap-1 px-2">
        <Link href={`/kittens/${kitten.id}`}>
          <ArrowLeft className="size-4" aria-hidden /> Back to {kitten.name}
        </Link>
      </Button>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Manage medical records — {kitten.name}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground mb-4 text-sm">
            Edit or delete entries within 15 minutes of logging. Older medical records are locked —
            use &ldquo;Correct&rdquo; to add a referenced correction without changing the original.
          </p>
          <MedicalCard
            kittenId={kitten.id}
            templates={getScheduleTemplates()}
            rows={rows}
            dueItems={[]}
            manage
          />
        </CardContent>
      </Card>
    </div>
  );
}
