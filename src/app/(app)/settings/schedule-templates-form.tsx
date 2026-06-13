"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { FormState } from "@/lib/forms";
import type { ScheduleTemplate } from "@/lib/schedule";
import { resetScheduleTemplates, saveScheduleTemplates } from "./actions";

export function ScheduleTemplatesForm({ templates }: { templates: ScheduleTemplate[] }) {
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
      <form action={formAction} className="flex flex-col gap-4">
        {templates.map((tpl) => (
          <div key={tpl.vaccineType} className="flex flex-col gap-2 rounded-lg border p-3">
            <p className="text-sm font-medium">{tpl.label}</p>
            <div className="grid grid-cols-3 gap-2">
              <div className="flex flex-col gap-1">
                <Label htmlFor={`${tpl.vaccineType}__firstWeeks`} className="text-xs">
                  First (weeks)
                </Label>
                <Input
                  id={`${tpl.vaccineType}__firstWeeks`}
                  name={`${tpl.vaccineType}__firstWeeks`}
                  type="number"
                  step="0.5"
                  min={0}
                  required
                  defaultValue={tpl.firstWeeks}
                />
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor={`${tpl.vaccineType}__everyWeeks`} className="text-xs">
                  Every (weeks)
                </Label>
                <Input
                  id={`${tpl.vaccineType}__everyWeeks`}
                  name={`${tpl.vaccineType}__everyWeeks`}
                  type="number"
                  step="0.5"
                  min={0}
                  required
                  defaultValue={tpl.everyWeeks}
                />
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor={`${tpl.vaccineType}__untilWeeks`} className="text-xs">
                  Until (weeks)
                </Label>
                <Input
                  id={`${tpl.vaccineType}__untilWeeks`}
                  name={`${tpl.vaccineType}__untilWeeks`}
                  type="number"
                  step="0.5"
                  min={0}
                  required
                  defaultValue={tpl.untilWeeks}
                />
              </div>
            </div>
          </div>
        ))}
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
