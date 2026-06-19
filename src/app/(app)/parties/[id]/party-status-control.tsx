"use client";

import { useActionState, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { PartyStatus } from "@/db/schema";
import { todayIso } from "@/lib/dates";
import type { FormState } from "@/lib/forms";
import { PARTY_STATUS_LABELS, partyTransitions } from "@/lib/parties";
import { adoptParty, changePartyStatus } from "../actions";

type AdoptableKitten = { id: number; name: string };

function AdoptDialog({
  partyId,
  kittens,
  onClose,
}: {
  partyId: number;
  kittens: AdoptableKitten[];
  onClose: () => void;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    async (prev, formData) => {
      const result = await adoptParty(prev, formData);
      if (!result) onClose();
      return result;
    },
    null,
  );

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Link adoption</DialogTitle>
          <DialogDescription>
            Select the kitten(s) this party is adopting. This records the adopter from their
            contact details and moves the kitten(s) to adopted.
          </DialogDescription>
        </DialogHeader>
        {kittens.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            No adoptable kittens are linked to this party yet — book a viewing with the
            kitten(s) first.
          </p>
        ) : (
          <form action={formAction} className="flex flex-col gap-4">
            <input type="hidden" name="partyId" value={partyId} />
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-1 text-sm font-medium">Kitten(s) *</legend>
              {kittens.map((k) => (
                <label key={k.id} className="flex items-center gap-2 text-sm">
                  <Checkbox name="kittenId" value={String(k.id)} />
                  {k.name}
                </label>
              ))}
            </fieldset>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="adoptionDate">Adoption date *</Label>
                <Input
                  id="adoptionDate"
                  name="adoptionDate"
                  type="date"
                  required
                  defaultValue={state?.values?.adoptionDate ?? todayIso()}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="shelterReference">Shelter reference</Label>
                <Input
                  id="shelterReference"
                  name="shelterReference"
                  maxLength={100}
                  defaultValue={state?.values?.shelterReference ?? ""}
                />
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="adopterNote">Note</Label>
              <Textarea
                id="adopterNote"
                name="adopterNote"
                rows={2}
                maxLength={2000}
                defaultValue={state?.values?.adopterNote ?? ""}
              />
            </div>
            {state?.error ? (
              <p role="alert" className="text-destructive text-sm">
                {state.error}
              </p>
            ) : null}
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? "Saving…" : "Confirm adoption"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function PartyStatusControl({
  partyId,
  currentStatus,
  isAdmin,
  adoptableKittens,
}: {
  partyId: number;
  currentStatus: PartyStatus;
  isAdmin: boolean;
  adoptableKittens: AdoptableKitten[];
}) {
  const [adoptOpen, setAdoptOpen] = useState(false);
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    changePartyStatus,
    null,
  );
  const formRef = useRef<HTMLFormElement>(null);
  const toStatusRef = useRef<HTMLInputElement>(null);

  const transitions = partyTransitions(currentStatus);
  const offRamps: PartyStatus[] = ["withdrew", "not_suitable"];
  const forward = transitions.filter((t) => t !== "adopted" && !offRamps.includes(t));
  const backs = transitions.filter((t) => offRamps.includes(t));
  const canAdopt = transitions.includes("adopted");

  function submit(to: PartyStatus) {
    if (toStatusRef.current) toStatusRef.current.value = to;
    formRef.current?.requestSubmit();
  }

  return (
    <div className="flex flex-col gap-2">
      <form ref={formRef} action={formAction} className="hidden">
        <input type="hidden" name="partyId" value={partyId} />
        <input ref={toStatusRef} type="hidden" name="toStatus" defaultValue="" />
      </form>

      <div className="flex flex-wrap gap-2">
        {forward.map((t) => (
          <Button key={t} size="sm" disabled={pending} onClick={() => submit(t)}>
            → {PARTY_STATUS_LABELS[t]}
          </Button>
        ))}
        {canAdopt && isAdmin ? (
          <Button size="sm" onClick={() => setAdoptOpen(true)}>
            → {PARTY_STATUS_LABELS.adopted} (link kitten)
          </Button>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-2">
        {backs.map((t) => (
          <Button
            key={t}
            size="sm"
            variant="outline"
            className="text-muted-foreground"
            disabled={pending}
            onClick={() => submit(t)}
          >
            {PARTY_STATUS_LABELS[t]}
          </Button>
        ))}
      </div>

      {state?.error ? (
        <p role="alert" className="text-destructive text-sm">
          {state.error}
        </p>
      ) : null}

      {adoptOpen ? (
        <AdoptDialog
          partyId={partyId}
          kittens={adoptableKittens}
          onClose={() => setAdoptOpen(false)}
        />
      ) : null}
    </div>
  );
}
