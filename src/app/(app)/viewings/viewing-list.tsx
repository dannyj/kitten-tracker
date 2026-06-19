"use client";

import { CalendarClock, MapPin, Pencil } from "lucide-react";
import Link from "next/link";
import { useActionState, useState } from "react";
import { PartyStatusBadge } from "@/components/party-status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { PartyStatus } from "@/db/schema";
import { formatDateTime, pinDatetimeField, toDatetimeLocal } from "@/lib/dates";
import type { FormState } from "@/lib/forms";
import { useNow } from "@/lib/use-now";
import { deleteViewing, markPartyViewed, updateViewing } from "./actions";

export type ViewingItem = {
  id: number;
  visitedAtMs: number;
  location: string | null;
  notes: string | null;
  party: { id: number; name: string; status: PartyStatus };
  kittens: { id: number; name: string }[];
};

function EditDialog({ item, onClose }: { item: ViewingItem; onClose: () => void }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    async (prev, formData) => {
      // Pin the datetime-local wall-clock to an absolute instant before it hits
      // the server (which runs in UTC in prod).
      pinDatetimeField(formData, "visitedAt");
      const result = await updateViewing(prev, formData);
      if (!result) onClose();
      return result;
    },
    null,
  );
  const [deleteState, deleteAction, deleting] = useActionState<FormState, FormData>(
    async (prev, formData) => {
      const result = await deleteViewing(prev, formData);
      if (!result) onClose();
      return result;
    },
    null,
  );

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit viewing</DialogTitle>
        </DialogHeader>
        <form action={formAction} className="flex flex-col gap-4">
          <input type="hidden" name="id" value={item.id} />
          <input type="hidden" name="interestedPartyId" value={item.party.id} />
          <div className="flex flex-col gap-2">
            <Label htmlFor="visitedAt">Date &amp; time *</Label>
            <Input
              id="visitedAt"
              name="visitedAt"
              type="datetime-local"
              required
              defaultValue={toDatetimeLocal(new Date(item.visitedAtMs))}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="location">Location</Label>
            <Input
              id="location"
              name="location"
              maxLength={200}
              defaultValue={item.location ?? ""}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="notes">Notes / impressions</Label>
            <Textarea
              id="notes"
              name="notes"
              rows={4}
              maxLength={2000}
              placeholder="Fit, living situation, other pets, general impression…"
              defaultValue={item.notes ?? ""}
            />
          </div>
          {state?.error ? (
            <p role="alert" className="text-destructive text-sm">
              {state.error}
            </p>
          ) : null}
          <DialogFooter className="flex-row justify-between sm:justify-between">
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </form>
        <form action={deleteAction} className="border-t pt-3">
          <input type="hidden" name="id" value={item.id} />
          {deleteState?.error ? (
            <p role="alert" className="text-destructive mb-2 text-sm">
              {deleteState.error}
            </p>
          ) : null}
          <Button
            type="submit"
            variant="ghost"
            size="sm"
            disabled={deleting}
            className="text-destructive"
          >
            {deleting ? "Deleting…" : "Delete viewing"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function MarkViewedButton({ partyId }: { partyId: number }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(markPartyViewed, null);
  return (
    <form action={formAction}>
      <input type="hidden" name="partyId" value={partyId} />
      <Button type="submit" size="sm" variant="outline" disabled={pending}>
        {pending ? "…" : "Mark viewed"}
      </Button>
      {state?.error ? <span className="text-destructive ml-2 text-xs">{state.error}</span> : null}
    </form>
  );
}

export function ViewingList({
  items,
  showParty = true,
}: {
  items: ViewingItem[];
  showParty?: boolean;
}) {
  const [editing, setEditing] = useState<ViewingItem | null>(null);
  // null until mounted — keeps render pure and time-dependent affordances off
  // until hydration (matches the app's useNow convention).
  const now = useNow();

  return (
    <div className="flex flex-col gap-2">
      {items.map((item) => {
        const isPast = now !== null && item.visitedAtMs < now;
        const canMarkViewed = isPast && item.party.status === "viewing_booked";
        return (
          <Card key={item.id}>
            <CardContent className="flex flex-col gap-2 py-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <CalendarClock className="text-muted-foreground size-4" aria-hidden />
                  {formatDateTime(new Date(item.visitedAtMs))}
                </div>
                <div className="flex items-center gap-2">
                  {showParty ? (
                    <Link
                      href={`/parties/${item.party.id}`}
                      className="text-sm font-medium hover:underline"
                    >
                      {item.party.name}
                    </Link>
                  ) : null}
                  <PartyStatusBadge status={item.party.status} />
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {item.kittens.map((k) => (
                  <Link
                    key={k.id}
                    href={`/kittens/${k.id}`}
                    className="bg-muted rounded-full px-2 py-0.5 text-xs hover:underline"
                  >
                    {k.name}
                  </Link>
                ))}
              </div>
              {item.location ? (
                <p className="text-muted-foreground flex items-center gap-1 text-xs">
                  <MapPin className="size-3" aria-hidden /> {item.location}
                </p>
              ) : null}
              {item.notes ? <p className="whitespace-pre-wrap text-sm">{item.notes}</p> : null}
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="gap-1 px-2"
                  onClick={() => setEditing(item)}
                >
                  <Pencil className="size-3.5" aria-hidden /> Edit
                </Button>
                {canMarkViewed ? <MarkViewedButton partyId={item.party.id} /> : null}
              </div>
            </CardContent>
          </Card>
        );
      })}
      {editing ? <EditDialog item={editing} onClose={() => setEditing(null)} /> : null}
    </div>
  );
}
