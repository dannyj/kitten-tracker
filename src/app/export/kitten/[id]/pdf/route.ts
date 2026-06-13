import { type NextRequest } from "next/server";
import { getCurrentSession } from "@/lib/auth/session";
import { todayIso } from "@/lib/dates";
import { getKittenExport } from "@/lib/export-data";
import { kittenPdf } from "@/lib/export-pdf";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user } = await getCurrentSession();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) return new Response("Not found", { status: 404 });

  const isAdmin = user.role === "admin";
  const includesAdopter = isAdmin && request.nextUrl.searchParams.get("adopter") === "1";
  const data = getKittenExport(id, includesAdopter);
  if (!data) return new Response("Not found", { status: 404 });

  if (includesAdopter) {
    console.warn(`[audit] adopter PII included in kitten PDF id=${id} by ${user.username}`);
  }

  const pdf = await kittenPdf(data, {
    generatedAtIso: todayIso(),
    fosterName: user.username,
    includesAdopter,
  });
  const filename = `medical-${data.name.replace(/[^a-zA-Z0-9]+/g, "-").toLowerCase()}.pdf`;
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"`,
    },
  });
}
