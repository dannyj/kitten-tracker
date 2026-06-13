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
import type { FormState } from "@/lib/forms";
import { createLitter } from "./actions";

export function LitterForm({
  mothers,
  preselectedMotherId,
}: {
  mothers: { id: number; name: string }[];
  preselectedMotherId?: number;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(createLitter, null);
  const v = (field: string, fallback: string) => state?.values?.[field] ?? fallback;

  return (
    <form action={formAction} className="flex max-w-lg flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="motherId">Mother</Label>
        <Select
          name="motherId"
          defaultValue={v("motherId", preselectedMotherId ? String(preselectedMotherId) : "none")}
        >
          <SelectTrigger id="motherId" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">None — orphan litter</SelectItem>
            {mothers.map((mother) => (
              <SelectItem key={mother.id} value={String(mother.id)}>
                {mother.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="birthDate">Birth date *</Label>
        <Input
          id="birthDate"
          name="birthDate"
          type="date"
          required
          defaultValue={v("birthDate", "")}
        />
      </div>
      <div className="flex items-center gap-2">
        <Checkbox
          id="birthDateEstimated"
          name="birthDateEstimated"
          defaultChecked={v("birthDateEstimated", "") === "on"}
        />
        <Label htmlFor="birthDateEstimated">Birth date is estimated</Label>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="notes">Notes</Label>
        <Textarea
          id="notes"
          name="notes"
          rows={3}
          maxLength={2000}
          placeholder="Found in a shed, brought in by…"
          defaultValue={v("notes", "")}
        />
      </div>
      {state?.error ? (
        <p role="alert" className="text-destructive text-sm">
          {state.error}
        </p>
      ) : null}
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Add litter"}
        </Button>
      </div>
    </form>
  );
}
