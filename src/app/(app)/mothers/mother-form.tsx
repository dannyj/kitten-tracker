"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
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
import type { Mother } from "@/db/types";
import type { FormState } from "@/lib/forms";
import { createMother, updateMother } from "./actions";

const MOTHER_STATUS_LABELS: Record<string, string> = {
  in_care: "In care",
  returned: "Returned to shelter",
  deceased: "Deceased",
};

export function MotherForm({ mother }: { mother?: Mother }) {
  const action = mother ? updateMother : createMother;
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, null);
  const v = (field: string, fallback: string) => state?.values?.[field] ?? fallback;

  return (
    <form action={formAction} className="flex max-w-lg flex-col gap-4">
      {mother ? <input type="hidden" name="id" value={mother.id} /> : null}
      <div className="flex flex-col gap-2">
        <Label htmlFor="name">Name *</Label>
        <Input
          id="name"
          name="name"
          required
          maxLength={100}
          defaultValue={v("name", mother?.name ?? "")}
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="shelterNumber">Shelter number</Label>
        <Input
          id="shelterNumber"
          name="shelterNumber"
          maxLength={50}
          defaultValue={v("shelterNumber", mother?.shelterNumber ?? "")}
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="intakeDate">Intake date</Label>
        <Input
          id="intakeDate"
          name="intakeDate"
          type="date"
          defaultValue={v("intakeDate", mother?.intakeDate ?? "")}
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="status">Status</Label>
        <Select name="status" defaultValue={v("status", mother?.status ?? "in_care")}>
          <SelectTrigger id="status" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(MOTHER_STATUS_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="notesBehaviour">Behaviour notes</Label>
        <Textarea
          id="notesBehaviour"
          name="notesBehaviour"
          rows={5}
          maxLength={5000}
          placeholder="Temperament, handling notes, anything the shelter should know…"
          defaultValue={v("notesBehaviour", mother?.notesBehaviour ?? "")}
        />
      </div>
      {state?.error ? (
        <p role="alert" className="text-destructive text-sm">
          {state.error}
        </p>
      ) : null}
      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : mother ? "Save changes" : "Add mother"}
        </Button>
      </div>
    </form>
  );
}
