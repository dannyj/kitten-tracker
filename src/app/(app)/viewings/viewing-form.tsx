"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { pinDatetimeField, toDatetimeLocal } from "@/lib/dates";
import type { FormState } from "@/lib/forms";
import { createViewing } from "./actions";

export function ViewingForm({
  parties,
  kittens,
  defaultPartyId,
  defaultKittenId,
}: {
  parties: { id: number; name: string }[];
  kittens: { id: number; name: string }[];
  defaultPartyId?: number;
  defaultKittenId?: number;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    async (prev, formData) => {
      pinDatetimeField(formData, "visitedAt");
      return createViewing(prev, formData);
    },
    null,
  );
  const v = (field: string, fallback: string) => state?.values?.[field] ?? fallback;

  return (
    <form action={formAction} className="flex max-w-lg flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="interestedPartyId">Interested party *</Label>
        <Select
          name="interestedPartyId"
          defaultValue={v("interestedPartyId", defaultPartyId ? String(defaultPartyId) : "")}
        >
          <SelectTrigger id="interestedPartyId" className="w-full">
            <SelectValue placeholder="Choose a party" />
          </SelectTrigger>
          <SelectContent>
            {parties.map((p) => (
              <SelectItem key={p.id} value={String(p.id)}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <fieldset className="flex flex-col gap-2 rounded-lg border p-3">
        <legend className="px-1 text-sm font-medium">Kitten(s) *</legend>
        {kittens.length === 0 ? (
          <p className="text-muted-foreground text-sm">No adoptable kittens available.</p>
        ) : (
          kittens.map((k) => (
            <label key={k.id} className="flex items-center gap-2 text-sm">
              <Checkbox
                name="kittenId"
                value={String(k.id)}
                defaultChecked={defaultKittenId === k.id}
              />
              {k.name}
            </label>
          ))
        )}
      </fieldset>

      <div className="flex flex-col gap-2">
        <Label htmlFor="visitedAt">Date &amp; time *</Label>
        <Input
          id="visitedAt"
          name="visitedAt"
          type="datetime-local"
          required
          defaultValue={v("visitedAt", toDatetimeLocal(new Date()))}
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="location">Location</Label>
        <Input
          id="location"
          name="location"
          maxLength={200}
          placeholder="e.g. Shelter, foster home"
          defaultValue={v("location", "")}
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="notes">Notes / impressions</Label>
        <Textarea
          id="notes"
          name="notes"
          rows={3}
          maxLength={2000}
          placeholder="Fit, living situation, other pets, general impression…"
          defaultValue={v("notes", "")}
        />
      </div>

      <label className="flex items-center gap-2 text-sm">
        <Checkbox name="bookStatus" value="on" defaultChecked />
        Mark the party as &ldquo;viewing booked&rdquo;
      </label>

      {state?.error ? (
        <p role="alert" className="text-destructive text-sm">
          {state.error}
        </p>
      ) : null}
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Book viewing"}
        </Button>
      </div>
    </form>
  );
}
