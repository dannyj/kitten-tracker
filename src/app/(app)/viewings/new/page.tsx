import { asc, inArray } from "drizzle-orm";
import Link from "next/link";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { db } from "@/db";
import { interestedParties, kittens } from "@/db/schema";
import { requireUser } from "@/lib/auth/guard";
import { ACTIVE_STATUSES } from "@/lib/status";
import { ViewingForm } from "../viewing-form";

export const metadata = { title: "Book a viewing — Kitten Tracker" };

const idParam = z.coerce.number().int().positive();

export default async function NewViewingPage({
  searchParams,
}: {
  searchParams: Promise<{ party?: string; kitten?: string }>;
}) {
  await requireUser();
  const { party, kitten } = await searchParams;
  const partyParse = idParam.safeParse(party);
  const kittenParse = idParam.safeParse(kitten);

  const parties = db
    .select({ id: interestedParties.id, name: interestedParties.name })
    .from(interestedParties)
    .orderBy(asc(interestedParties.name))
    .all();

  // Only kittens still available to view (not adopted/returned/deceased).
  const kittenRows = db
    .select({ id: kittens.id, name: kittens.name })
    .from(kittens)
    .where(inArray(kittens.status, ACTIVE_STATUSES))
    .orderBy(asc(kittens.name))
    .all();

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <h1 className="text-2xl font-semibold">Book a viewing</h1>
      {parties.length === 0 ? (
        <div className="flex flex-col items-start gap-3 rounded-lg border border-dashed p-6">
          <p className="text-sm">
            A viewing needs an interested party — add one first.
          </p>
          <Button asChild>
            <Link href="/parties/new">Add interested party</Link>
          </Button>
        </div>
      ) : (
        <ViewingForm
          parties={parties}
          kittens={kittenRows}
          defaultPartyId={partyParse.success ? partyParse.data : undefined}
          defaultKittenId={kittenParse.success ? kittenParse.data : undefined}
        />
      )}
    </div>
  );
}
