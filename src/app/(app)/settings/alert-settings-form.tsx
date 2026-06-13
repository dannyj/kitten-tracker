"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DEFAULT_ALERT_SETTINGS, type AlertSettings } from "@/lib/alerts";
import type { FormState } from "@/lib/forms";
import { resetAlertSettings, saveAlertSettings } from "./actions";

type Field = {
  name: keyof AlertSettings;
  label: string;
  help: string;
  unit: string;
  step?: string;
};

const FIELDS: Field[] = [
  {
    name: "minDailyGainG",
    label: "Warning floor",
    help: "Average daily gain below this triggers a warning.",
    unit: "g/day",
    step: "0.5",
  },
  {
    name: "targetDailyGainG",
    label: "Target gain",
    help: "Healthy daily gain — drives the chart's expected-growth band.",
    unit: "g/day",
    step: "0.5",
  },
  {
    name: "lossPctUrgent",
    label: "Urgent loss",
    help: "A drop of at least this much vs the previous weighing is urgent.",
    unit: "%",
    step: "0.5",
  },
  {
    name: "noGainHoursUrgent",
    label: "Urgent no-gain window",
    help: "No net gain across at least this many hours is urgent.",
    unit: "hours",
    step: "1",
  },
];

export function AlertSettingsForm({ settings }: { settings: AlertSettings }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(saveAlertSettings, null);
  const [, resetAction, resetPending] = useActionState(async () => {
    await resetAlertSettings();
    return null;
  }, null);

  return (
    <div className="flex flex-col gap-4">
      <form action={formAction} className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          {FIELDS.map((field) => (
            <div key={field.name} className="flex flex-col gap-1.5">
              <Label htmlFor={field.name}>
                {field.label} ({field.unit})
              </Label>
              <Input
                id={field.name}
                name={field.name}
                type="number"
                inputMode="decimal"
                min={0}
                step={field.step}
                required
                defaultValue={settings[field.name]}
              />
              <p className="text-muted-foreground text-xs">
                {field.help} Default {DEFAULT_ALERT_SETTINGS[field.name]}.
              </p>
            </div>
          ))}
        </div>
        {state?.error ? (
          <p role="alert" className="text-destructive text-sm">
            {state.error}
          </p>
        ) : null}
        <div className="flex gap-2">
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : "Save thresholds"}
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
