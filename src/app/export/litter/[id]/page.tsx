import { notFound } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth/guard";
import { todayIso } from "@/lib/dates";
import { getLitterExport } from "@/lib/export-data";
import { ExportDisclaimer, ExportHeader, KittenSummary } from "../../export-view";

export const metadata = { title: "Litter medical summary — Kitten Tracker" };

export default async function LitterExportPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ adopter?: string }>;
}) {
  const user = await requireUser();
  const idParse = z.coerce
    .number()
    .int()
    .positive()
    .safeParse((await params).id);
  if (!idParse.success) notFound();

  const isAdmin = user.role === "admin";
  const includesAdopter = isAdmin && (await searchParams).adopter === "1";
  const data = getLitterExport(idParse.data, includesAdopter);
  if (!data) notFound();

  if (includesAdopter) {
    console.warn(
      `[audit] adopter PII included in litter export id=${data.litterId} by ${user.username}`,
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <ExportHeader
        title={`Medical summary — ${data.title}`}
        generatedAtIso={todayIso()}
        fosterName={user.username}
        isAdmin={isAdmin}
        includesAdopter={includesAdopter}
        selfHref={`/export/litter/${data.litterId}`}
        pdfHref={`/export/litter/${data.litterId}/pdf`}
      />
      {data.kittens.length === 0 ? (
        <p className="text-muted-foreground text-sm">No kittens in this litter.</p>
      ) : (
        <div className="flex flex-col gap-4">
          {data.kittens.map((k) => (
            <KittenSummary key={k.id} k={k} includesAdopter={includesAdopter} />
          ))}
        </div>
      )}
      <ExportDisclaimer />
    </div>
  );
}
