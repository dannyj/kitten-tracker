import { notFound } from "next/navigation";
import { z } from "zod";
import { audit } from "@/lib/audit";
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

  audit("export.kitten", {
    username: user.username,
    detail: `id=${data.id} print adopter=${includesAdopter}`,
  });
  if (includesAdopter) {
    audit("adopter_pii.access", { username: user.username, detail: `kitten export id=${data.id}` });
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
