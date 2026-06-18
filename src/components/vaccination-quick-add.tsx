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
import {
  suggestNextDueDate,
  VACCINE_TYPES,
  type MedicalSubjectType,
  type ScheduleTemplate,
} from "@/lib/schedule";

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
  types = VACCINE_TYPES,
}: {
  templates: ScheduleTemplate[];
  defaults?: VaccinationDefaults;
  /** Selectable types for this subject ("other" must be last, allows free text). */
  types?: readonly string[];
}) {
  const fallbackType = types[0];
  const known = defaults?.type && types.includes(defaults.type);
  const [type, setType] = useState<string>(
    known ? defaults!.type! : defaults?.type ? "other" : fallbackType,
  );
  const [otherType, setOtherType] = useState<string>(known ? "" : (defaults?.type ?? ""));
  const initialType = known ? defaults!.type! : defaults?.type ? "other" : fallbackType;
  const initialGiven = defaults?.givenAtIso ?? todayIso();
  const [givenAt, setGivenAt] = useState<string>(initialGiven);

  function suggest(nextType: string, nextGiven: string): string {
    const tpl = templates.find((t) => t.vaccineType === nextType);
    return tpl ? (suggestNextDueDate(nextGiven, tpl) ?? "") : "";
  }

  // On a fresh add, prefill the next-due from the default type's template. On
  // edit/correct, keep the entry's own value (don't invent one).
  const [nextDue, setNextDue] = useState<string>(
    defaults?.nextDueDateIso != null
      ? defaults.nextDueDateIso
      : defaults
        ? ""
        : suggest(initialType, initialGiven),
  );

  function applyTemplate(nextType: string, nextGiven: string) {
    setNextDue(suggest(nextType, nextGiven));
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
              {types.map((t) => (
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

/** Standalone add form, reused on the detail cards and the dashboard dialog. */
export function VaccinationQuickAdd({
  subjectType,
  subjectId,
  templates,
  types,
  defaultType,
  onAdded,
}: {
  subjectType: MedicalSubjectType;
  subjectId: number;
  templates: ScheduleTemplate[];
  types?: readonly string[];
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
      <input type="hidden" name="subjectType" value={subjectType} />
      <input type="hidden" name="subjectId" value={subjectId} />
      <VaccinationFields
        templates={templates}
        types={types}
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
