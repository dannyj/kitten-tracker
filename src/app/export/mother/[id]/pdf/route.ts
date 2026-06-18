import { type NextRequest } from "next/server";
import { audit } from "@/lib/audit";
import { getCurrentSession } from "@/lib/auth/session";
import { todayIso } from "@/lib/dates";
import { getMotherExport } from "@/lib/export-data";
import { motherPdf } from "@/lib/export-pdf";

export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user } = await getCurrentSession();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) return new Response("Not found", { status: 404 });

  const data = getMotherExport(id);
  if (!data) return new Response("Not found", { status: 404 });

  audit("export.mother", { username: user.username, detail: `id=${id} pdf` });

  const pdf = await motherPdf(data, {
    generatedAtIso: todayIso(),
    fosterName: user.username,
    includesAdopter: false,
  });
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="medical-mother-${id}.pdf"`,
    },
  });
}
