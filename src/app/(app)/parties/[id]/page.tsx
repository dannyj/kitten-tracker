import { eq } from "drizzle-orm";
import { CalendarPlus, Cat, Pencil } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { PartyStatusBadge } from "@/components/party-status-badge";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/db";
import { interestedParties } from "@/db/schema";
import { requireUser } from "@/lib/auth/guard";
import { getPartyLinkedKittens, getViewingItems, groupViewingsByTime } from "@/lib/viewing-data";
import { PartyStatusControl } from "./party-status-control";
import { ViewingList } from "../../viewings/viewing-list";

export default async function PartyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const isAdmin = user.role === "admin";
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

  const items = getViewingItems({ partyId: party.id });
  const { upcoming, past } = groupViewingsByTime(items);

  const linkedKittens = getPartyLinkedKittens(party.id);
  const adoptableKittens = linkedKittens.filter(
    (k) => k.status !== "adopted" && k.status !== "deceased",
  );

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            {party.name}
            {party.partnerName ? (
              <span className="text-muted-foreground text-lg font-normal">
                &amp; {party.partnerName}
              </span>
            ) : null}
          </h1>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-sm">
            <PartyStatusBadge status={party.status} />
            {party.source ? (
              <span className="text-muted-foreground">via {party.source}</span>
            ) : null}
          </p>
        </div>
        {isAdmin ? (
          <Button asChild variant="outline" size="sm">
            <Link href={`/parties/${party.id}/edit`}>
              <Pencil className="size-4" aria-hidden /> Edit
            </Link>
          </Button>
        ) : null}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="flex flex-col gap-6">
          {isAdmin ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Contact</CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                  <div>
                    <dt className="text-muted-foreground text-xs font-medium uppercase">Phone</dt>
                    <dd>{party.phone ?? "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground text-xs font-medium uppercase">Email</dt>
                    <dd className="break-all">{party.email ?? "—"}</dd>
                  </div>
                  <div className="col-span-2">
                    <dt className="text-muted-foreground text-xs font-medium uppercase">Address</dt>
                    <dd className="whitespace-pre-wrap">{party.address ?? "—"}</dd>
                  </div>
                  <div className="col-span-2">
                    <dt className="text-muted-foreground text-xs font-medium uppercase">Notes</dt>
                    <dd className="whitespace-pre-wrap">{party.notes ?? "—"}</dd>
                  </div>
                </dl>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="text-muted-foreground py-4 text-sm">
                Contact details are visible to admins only.
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Pipeline</CardTitle>
            </CardHeader>
            <CardContent>
              <PartyStatusControl
                partyId={party.id}
                currentStatus={party.status}
                isAdmin={isAdmin}
                adoptableKittens={adoptableKittens.map((k) => ({ id: k.id, name: k.name }))}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Linked kittens</CardTitle>
            </CardHeader>
            <CardContent>
              {linkedKittens.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  None yet — book a viewing to link kittens.
                </p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {linkedKittens.map((k) => (
                    <li key={k.id} className="flex items-center justify-between gap-2 text-sm">
                      <Link
                        href={`/kittens/${k.id}`}
                        className="flex items-center gap-2 hover:underline"
                      >
                        <Cat className="text-muted-foreground size-4" aria-hidden /> {k.name}
                      </Link>
                      <StatusBadge status={k.status} />
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <CardTitle className="text-base">Viewings</CardTitle>
              <Button asChild size="sm">
                <Link href={`/viewings/new?party=${party.id}`}>
                  <CalendarPlus className="size-4" aria-hidden /> Book a viewing
                </Link>
              </Button>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {items.length === 0 ? (
                <p className="text-muted-foreground text-sm">No viewings booked yet.</p>
              ) : (
                <>
                  {upcoming.length > 0 ? (
                    <div className="flex flex-col gap-2">
                      <h3 className="text-muted-foreground text-xs font-medium uppercase">
                        Upcoming
                      </h3>
                      <ViewingList items={upcoming} showParty={false} />
                    </div>
                  ) : null}
                  {past.length > 0 ? (
                    <div className="flex flex-col gap-2">
                      <h3 className="text-muted-foreground text-xs font-medium uppercase">Past</h3>
                      <ViewingList items={past} showParty={false} />
                    </div>
                  ) : null}
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
