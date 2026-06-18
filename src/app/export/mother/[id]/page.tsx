import { notFound } from "next/navigation";
import { z } from "zod";
import { audit } from "@/lib/audit";
import { requireUser } from "@/lib/auth/guard";
import { todayIso } from "@/lib/dates";
import { getMotherExport } from "@/lib/export-data";
import { ExportDisclaimer, ExportHeader, MotherSummary } from "../../export-view";

export const metadata = { title: "Mother medical summary — Kitten Tracker" };

export default async function MotherExportPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const idParse = z.coerce
    .number()
    .int()
    .positive()
    .safeParse((await params).id);
  if (!idParse.success) notFound();

  const data = getMotherExport(idParse.data);
  if (!data) notFound();

  audit("export.mother", { username: user.username, detail: `id=${data.id} print` });

  return (
    <div className="flex flex-col gap-6">
      <ExportHeader
        title={`Medical summary — ${data.name}`}
        generatedAtIso={todayIso()}
        fosterName={user.username}
        // Mothers have no adopter, so suppress the adopter opt-in control.
        isAdmin={false}
        includesAdopter={false}
        selfHref={`/export/mother/${data.id}`}
        pdfHref={`/export/mother/${data.id}/pdf`}
      />
      <MotherSummary m={data} />
      <ExportDisclaimer />
    </div>
  );
}
