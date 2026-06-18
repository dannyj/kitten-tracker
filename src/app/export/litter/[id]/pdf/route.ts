import { type NextRequest } from "next/server";
import { audit } from "@/lib/audit";
import { getCurrentSession } from "@/lib/auth/session";
import { todayIso } from "@/lib/dates";
import { getLitterExport } from "@/lib/export-data";
import { litterPdf } from "@/lib/export-pdf";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user } = await getCurrentSession();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) return new Response("Not found", { status: 404 });

  const isAdmin = user.role === "admin";
  const includesAdopter = isAdmin && request.nextUrl.searchParams.get("adopter") === "1";
  const data = getLitterExport(id, includesAdopter);
  if (!data) return new Response("Not found", { status: 404 });

  audit("export.litter", {
    username: user.username,
    detail: `id=${id} pdf adopter=${includesAdopter}`,
  });
  if (includesAdopter) {
    audit("adopter_pii.access", { username: user.username, detail: `litter pdf id=${id}` });
  }

  const pdf = await litterPdf(data.title, data.mother, data.kittens, {
    generatedAtIso: todayIso(),
    fosterName: user.username,
    includesAdopter,
  });
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="medical-litter-${id}.pdf"`,
    },
  });
}
