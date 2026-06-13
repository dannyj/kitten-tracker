"use client";

import { useActionState, useRef, useState } from "react";
import { addVaccination } from "@/app/(app)/kittens/vaccination-actions";
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
import { todayIso } from "@/lib/dates";
import type { FormState } from "@/lib/forms";
import { suggestNextDueDate, VACCINE_TYPES, type ScheduleTemplate } from "@/lib/schedule";

export type VaccinationDefaults = {
  type?: string;
  givenAtIso?: string;
  batchNumber?: string | null;
  administeredBy?: string | null;
  nextDueDateIso?: string | null;
  note?: string | null;
};

/** Shared field set for add / edit / correct, with template-driven next-due prefill. */
export function VaccinationFields({
  templates,
  defaults,
}: {
  templates: ScheduleTemplate[];
  defaults?: VaccinationDefaults;
}) {
  const known = defaults?.type && (VACCINE_TYPES as readonly string[]).includes(defaults.type);
  const [type, setType] = useState<string>(
    known ? defaults!.type! : defaults?.type ? "other" : "FVRCP",
  );
  const [otherType, setOtherType] = useState<string>(known ? "" : (defaults?.type ?? ""));
  const [givenAt, setGivenAt] = useState<string>(defaults?.givenAtIso ?? todayIso());
  const [nextDue, setNextDue] = useState<string>(defaults?.nextDueDateIso ?? "");

  function applyTemplate(nextType: string, nextGiven: string) {
    const tpl = templates.find((t) => t.vaccineType === nextType);
    setNextDue(tpl ? (suggestNextDueDate(nextGiven, tpl) ?? "") : "");
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="flex flex-1 flex-col gap-1.5">
          <Label>Type</Label>
          <Select
            value={type}
            onValueChange={(v) => {
              setType(v);
              applyTemplate(v, givenAt);
            }}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {VACCINE_TYPES.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-1 flex-col gap-1.5">
          <Label htmlFor="givenAt">Date given</Label>
          <Input
            id="givenAt"
            name="givenAt"
            type="date"
            required
            value={givenAt}
            max={todayIso()}
            onChange={(e) => {
              setGivenAt(e.target.value);
              applyTemplate(type, e.target.value);
            }}
          />
        </div>
      </div>
      {type === "other" ? (
        <Input
          name="type"
          maxLength={50}
          required
          placeholder="Type (e.g. ringworm treatment)"
          value={otherType}
          onChange={(e) => setOtherType(e.target.value)}
        />
      ) : (
        <input type="hidden" name="type" value={type} />
      )}
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          name="batchNumber"
          maxLength={100}
          placeholder="Batch / lot number"
          className="flex-1"
          defaultValue={defaults?.batchNumber ?? ""}
        />
        <Input
          name="administeredBy"
          maxLength={100}
          placeholder="Administered by (vet / self)"
          className="flex-1"
          defaultValue={defaults?.administeredBy ?? ""}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="nextDueDate">Next due (optional)</Label>
        <Input
          id="nextDueDate"
          name="nextDueDate"
          type="date"
          value={nextDue}
          onChange={(e) => setNextDue(e.target.value)}
        />
      </div>
      <Input
        name="note"
        maxLength={1000}
        placeholder="Note (optional)"
        defaultValue={defaults?.note ?? ""}
      />
    </div>
  );
}

/** Standalone add form, reused on the kitten detail card and the dashboard dialog. */
export function VaccinationQuickAdd({
  kittenId,
  templates,
  defaultType,
  onAdded,
}: {
  kittenId: number;
  templates: ScheduleTemplate[];
  defaultType?: string;
  onAdded?: () => void;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    async (prev, formData) => {
      const result = await addVaccination(prev, formData);
      if (!result) {
        formRef.current?.reset();
        onAdded?.();
      }
      return result;
    },
    null,
  );

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-3 rounded-lg border p-3">
      <input type="hidden" name="kittenId" value={kittenId} />
      <VaccinationFields
        templates={templates}
        defaults={defaultType ? { type: defaultType } : undefined}
      />
      {state?.error ? (
        <p role="alert" className="text-destructive text-sm">
          {state.error}
        </p>
      ) : null}
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Log entry"}
        </Button>
      </div>
    </form>
  );
}
