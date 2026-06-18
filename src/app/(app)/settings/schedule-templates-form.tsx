"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { FormState } from "@/lib/forms";
import type { ScheduleTemplate } from "@/lib/schedule";
import { resetScheduleTemplates, saveScheduleTemplates } from "./actions";

function fieldName(tpl: ScheduleTemplate, name: string) {
  return `${tpl.subjectType}__${tpl.vaccineType}__${name}`;
}

function WeekInput({
  tpl,
  name,
  label,
  min = 0,
}: {
  tpl: ScheduleTemplate;
  name: "firstWeeks" | "everyWeeks" | "untilWeeks";
  label: string;
  min?: number;
}) {
  const id = fieldName(tpl, name);
  return (
    <div className="flex flex-col gap-1">
      <Label htmlFor={id} className="text-xs">
        {label}
      </Label>
      <Input
        id={id}
        name={id}
        type="number"
        step="0.5"
        min={min}
        required
        defaultValue={tpl[name]}
      />
    </div>
  );
}

export function ScheduleTemplatesForm({
  kittenTemplates,
  motherTemplates,
}: {
  kittenTemplates: ScheduleTemplate[];
  motherTemplates: ScheduleTemplate[];
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    saveScheduleTemplates,
    null,
  );
  const [, resetAction, resetPending] = useActionState(async () => {
    await resetScheduleTemplates();
    return null;
  }, null);

  return (
    <div className="flex flex-col gap-4">
      <form action={formAction} className="flex flex-col gap-6">
        <div className="flex flex-col gap-3">
          <p className="text-sm font-semibold">Kittens</p>
          {kittenTemplates.map((tpl) => (
            <div key={fieldName(tpl, "row")} className="flex flex-col gap-2 rounded-lg border p-3">
              <p className="text-sm font-medium">{tpl.label}</p>
              <div className="grid grid-cols-3 gap-2">
                <WeekInput tpl={tpl} name="firstWeeks" label="First (weeks)" min={0.5} />
                <WeekInput tpl={tpl} name="everyWeeks" label="Every (weeks)" min={0.5} />
                <WeekInput tpl={tpl} name="untilWeeks" label="Until (weeks)" min={0.5} />
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-3">
          <div>
            <p className="text-sm font-semibold">Adult cat (mother)</p>
            <p className="text-muted-foreground text-xs">
              Adults have no birth-based schedule, so only the booster interval applies — it
              prefills the next-due when a treatment is logged. Set 0 for a one-off (microchip) or a
              treatment you don&apos;t track on a routine (e.g. rabies for indoor-only cats).
            </p>
          </div>
          {motherTemplates.map((tpl) => (
            <div
              key={fieldName(tpl, "row")}
              className="flex flex-wrap items-end justify-between gap-2 rounded-lg border p-3"
            >
              <p className="text-sm font-medium">{tpl.label}</p>
              <div className="w-32">
                <WeekInput tpl={tpl} name="everyWeeks" label="Every (weeks), 0 = one-off" />
              </div>
            </div>
          ))}
        </div>

        {state?.error ? (
          <p role="alert" className="text-destructive text-sm">
            {state.error}
          </p>
        ) : null}
        <div>
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : "Save templates"}
          </Button>
        </div>
      </form>
      <form action={resetAction}>
        <Button type="submit" variant="outline" size="sm" disabled={resetPending}>
          {resetPending ? "Resetting…" : "Reset to defaults"}
        </Button>
      </form>
    </div>
  );
}
