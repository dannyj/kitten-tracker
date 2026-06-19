import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { interestedParties } from "@/db/schema";
import { requireAdmin } from "@/lib/auth/guard";
import { PartyForm } from "../../party-form";

export const metadata = { title: "Edit interested party — Kitten Tracker" };

export default async function EditPartyPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const idParse = z.coerce
    .number()
    .int()
    .positive()
    .safeParse((await params).id);
  if (!idParse.success) notFound();
  const party = db
    .select()
    .from(interestedParties)
    .where(eq(interestedParties.id, idParse.data))
    .get();
  if (!party) notFound();

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <h1 className="text-2xl font-semibold">Edit {party.name}</h1>
      <PartyForm party={party} />
    </div>
  );
}
