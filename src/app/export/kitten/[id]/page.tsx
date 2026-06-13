import { notFound } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth/guard";
import { todayIso } from "@/lib/dates";
import { getKittenExport } from "@/lib/export-data";
import { ExportDisclaimer, ExportHeader, KittenSummary } from "../../export-view";

export const metadata = { title: "Medical summary — Kitten Tracker" };

export default async function KittenExportPage({
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
  const data = getKittenExport(idParse.data, includesAdopter);
  if (!data) notFound();

  if (includesAdopter) {
    console.warn(`[audit] adopter PII included in kitten export id=${data.id} by ${user.username}`);
  }

  return (
    <div className="flex flex-col gap-6">
      <ExportHeader
        title={`Medical summary — ${data.name}`}
        generatedAtIso={todayIso()}
        fosterName={user.username}
        isAdmin={isAdmin}
        includesAdopter={includesAdopter}
        selfHref={`/export/kitten/${data.id}`}
        pdfHref={`/export/kitten/${data.id}/pdf`}
      />
      <KittenSummary k={data} includesAdopter={includesAdopter} />
      <ExportDisclaimer />
    </div>
  );
}
