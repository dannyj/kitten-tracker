import { and, desc, eq } from "drizzle-orm";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { MedicalCard, type VaccinationRow } from "@/app/(app)/kittens/[id]/medical-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/db";
import { mothers, vaccinations } from "@/db/schema";
import { requireUser } from "@/lib/auth/guard";
import { MOTHER_VACCINE_TYPES } from "@/lib/schedule";
import { getScheduleTemplates } from "@/lib/settings";

export const metadata = { title: "Manage medical — Kitten Tracker" };

export default async function ManageMotherMedicalPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireUser();
  const idParse = z.coerce
    .number()
    .int()
    .positive()
    .safeParse((await params).id);
  if (!idParse.success) notFound();
  const mother = db.select().from(mothers).where(eq(mothers.id, idParse.data)).get();
  if (!mother) notFound();

  const raw = db
    .select()
    .from(vaccinations)
    .where(and(eq(vaccinations.subjectType, "mother"), eq(vaccinations.subjectId, mother.id)))
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
        <Link href={`/mothers/${mother.id}`}>
          <ArrowLeft className="size-4" aria-hidden /> Back to {mother.name}
        </Link>
      </Button>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Manage medical records — {mother.name}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground mb-4 text-sm">
            Edit or delete entries within 15 minutes of logging. Older medical records are locked —
            use &ldquo;Correct&rdquo; to add a referenced correction without changing the original.
          </p>
          <MedicalCard
            subjectType="mother"
            subjectId={mother.id}
            templates={getScheduleTemplates("mother")}
            types={MOTHER_VACCINE_TYPES}
            rows={rows}
            dueItems={[]}
            manage
          />
        </CardContent>
      </Card>
    </div>
  );
}
