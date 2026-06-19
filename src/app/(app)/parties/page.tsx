import { asc, count, eq, inArray, type SQL } from "drizzle-orm";
import { Contact, Plus } from "lucide-react";
import Link from "next/link";
import { PartyStatusBadge } from "@/components/party-status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { db } from "@/db";
import { interestedParties, PARTY_STATUSES, type PartyStatus, viewings } from "@/db/schema";
import { requireUser } from "@/lib/auth/guard";
import { ACTIVE_PARTY_STATUSES } from "@/lib/parties";
import { PartyFilterBar } from "./filter-bar";

export const metadata = { title: "Interested parties — Kitten Tracker" };

export default async function PartiesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const user = await requireUser();
  const isAdmin = user.role === "admin";
  const { status } = await searchParams;

  const conditions: SQL[] = [];
  if (!status || status === "default") {
    conditions.push(inArray(interestedParties.status, ACTIVE_PARTY_STATUSES));
  } else if (status !== "all" && (PARTY_STATUSES as readonly string[]).includes(status)) {
    conditions.push(eq(interestedParties.status, status as PartyStatus));
  }

  const rows = db
    .select()
    .from(interestedParties)
    .where(conditions.length > 0 ? conditions[0] : undefined)
    .orderBy(asc(interestedParties.name))
    .all();

  // Viewing counts for context, in one grouped query.
  const viewingCounts = new Map<number, number>();
  if (rows.length > 0) {
    for (const r of db
      .select({ partyId: viewings.interestedPartyId, n: count() })
      .from(viewings)
      .where(
        inArray(
          viewings.interestedPartyId,
          rows.map((r) => r.id),
        ),
      )
      .groupBy(viewings.interestedPartyId)
      .all()) {
      viewingCounts.set(r.partyId, r.n);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">Interested parties</h1>
        {isAdmin ? (
          <Button asChild variant="outline">
            <Link href="/parties/new">
              <Plus className="size-4" aria-hidden /> Party
            </Link>
          </Button>
        ) : null}
      </div>

      <PartyFilterBar />

      {rows.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed py-16 text-center">
          <Contact className="text-muted-foreground size-7" aria-hidden />
          <p className="font-medium">No interested parties match</p>
          <p className="text-muted-foreground text-sm">
            Adjust the filter, or add someone who has enquired.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {rows.map((p) => (
            <Link key={p.id} href={`/parties/${p.id}`} className="block">
              <Card className="transition-colors hover:bg-muted/50">
                <CardContent className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium">
                      {p.name}
                      {p.partnerName ? ` & ${p.partnerName}` : ""}
                    </p>
                    <p className="text-muted-foreground truncate text-sm">
                      {isAdmin
                        ? [p.phone, p.email].filter(Boolean).join(" · ") || "No contact details"
                        : `${viewingCounts.get(p.id) ?? 0} viewing(s)`}
                    </p>
                  </div>
                  <PartyStatusBadge status={p.status} />
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      <p className="text-muted-foreground text-xs">
        These are contact details for people who may never adopt. Prune parties who didn&apos;t
        proceed — don&apos;t retain contact data indefinitely without reason.
      </p>
    </div>
  );
}
