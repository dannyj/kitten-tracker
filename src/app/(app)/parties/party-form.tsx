"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { InterestedParty } from "@/db/types";
import type { FormState } from "@/lib/forms";
import { createParty, updateParty } from "./actions";

export function PartyForm({ party }: { party?: InterestedParty }) {
  const action = party ? updateParty : createParty;
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, null);
  const v = (field: string, fallback: string) => state?.values?.[field] ?? fallback;

  return (
    <form action={formAction} className="flex max-w-lg flex-col gap-4">
      {party ? <input type="hidden" name="id" value={party.id} /> : null}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="name">Name *</Label>
          <Input
            id="name"
            name="name"
            required
            maxLength={200}
            defaultValue={v("name", party?.name ?? "")}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="partnerName">Partner name</Label>
          <Input
            id="partnerName"
            name="partnerName"
            maxLength={200}
            defaultValue={v("partnerName", party?.partnerName ?? "")}
          />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="phone">Phone</Label>
          <Input
            id="phone"
            name="phone"
            type="tel"
            placeholder="06… or +31…"
            maxLength={25}
            defaultValue={v("phone", party?.phone ?? "")}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            maxLength={200}
            defaultValue={v("email", party?.email ?? "")}
          />
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="address">Address</Label>
        <Textarea
          id="address"
          name="address"
          rows={2}
          maxLength={500}
          defaultValue={v("address", party?.address ?? "")}
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="source">How they found us</Label>
        <Input
          id="source"
          name="source"
          maxLength={200}
          placeholder="e.g. Instagram, word of mouth, shelter listing"
          defaultValue={v("source", party?.source ?? "")}
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="notes">Notes</Label>
        <Textarea
          id="notes"
          name="notes"
          rows={3}
          maxLength={2000}
          defaultValue={v("notes", party?.notes ?? "")}
        />
      </div>

      {state?.error ? (
        <p role="alert" className="text-destructive text-sm">
          {state.error}
        </p>
      ) : null}
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : party ? "Save changes" : "Add party"}
        </Button>
      </div>
    </form>
  );
}
