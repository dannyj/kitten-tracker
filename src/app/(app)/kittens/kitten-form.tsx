"use client";

import { useActionState, useState } from "react";
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
import { Switch } from "@/components/ui/switch";
import type { Kitten } from "@/db/types";
import type { FormState } from "@/lib/forms";
import { createKitten, updateKitten } from "./actions";

export type LitterOption = {
  id: number;
  label: string;
  birthDate: string | null;
  estimated: boolean;
};

export function KittenForm({
  kitten,
  litterOptions,
  preselectedLitterId,
}: {
  kitten?: Kitten;
  litterOptions: LitterOption[];
  preselectedLitterId?: number;
}) {
  const action = kitten ? updateKitten : createKitten;
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, null);
  const v = (field: string, fallback: string) => state?.values?.[field] ?? fallback;

  const initialLitterId = v(
    "litterId",
    String(kitten?.litterId ?? preselectedLitterId ?? litterOptions[0]?.id ?? ""),
  );
  const preselectedLitter = litterOptions.find((l) => String(l.id) === initialLitterId);

  const [handFeeding, setHandFeeding] = useState(
    state?.values ? state.values.handFeeding === "on" : (kitten?.handFeeding ?? false),
  );
  // Pre-fill birth date from the litter; user can override per kitten.
  const [birthDate, setBirthDate] = useState(
    v("birthDate", kitten?.birthDate ?? preselectedLitter?.birthDate ?? ""),
  );
  const [estimated, setEstimated] = useState(
    state?.values
      ? state.values.birthDateEstimated === "on"
      : (kitten?.birthDateEstimated ?? preselectedLitter?.estimated ?? false),
  );

  return (
    <form action={formAction} className="flex max-w-lg flex-col gap-4">
      {kitten ? <input type="hidden" name="id" value={kitten.id} /> : null}
      <div className="flex flex-col gap-2">
        <Label htmlFor="litterId">Litter *</Label>
        <Select
          name="litterId"
          defaultValue={initialLitterId}
          onValueChange={(value) => {
            const litter = litterOptions.find((l) => String(l.id) === value);
            if (litter && !kitten) {
              setBirthDate(litter.birthDate ?? "");
              setEstimated(litter.estimated);
            }
          }}
        >
          <SelectTrigger id="litterId" className="w-full">
            <SelectValue placeholder="Choose a litter" />
          </SelectTrigger>
          <SelectContent>
            {litterOptions.map((litter) => (
              <SelectItem key={litter.id} value={String(litter.id)}>
                {litter.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="name">Name *</Label>
        <Input
          id="name"
          name="name"
          required
          maxLength={100}
          defaultValue={v("name", kitten?.name ?? "")}
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="shelterNumber">Shelter number</Label>
        <Input
          id="shelterNumber"
          name="shelterNumber"
          maxLength={50}
          defaultValue={v("shelterNumber", kitten?.shelterNumber ?? "")}
        />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="sex">Sex</Label>
          <Select name="sex" defaultValue={v("sex", kitten?.sex ?? "unknown")}>
            <SelectTrigger id="sex" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="unknown">Unknown</SelectItem>
              <SelectItem value="female">Female</SelectItem>
              <SelectItem value="male">Male</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="color">Color / markings</Label>
          <Input
            id="color"
            name="color"
            maxLength={200}
            defaultValue={v("color", kitten?.color ?? "")}
          />
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="birthDate">Birth date</Label>
        <Input
          id="birthDate"
          name="birthDate"
          type="date"
          value={birthDate}
          onChange={(e) => setBirthDate(e.target.value)}
        />
      </div>
      <div className="flex items-center gap-2">
        <Checkbox
          id="birthDateEstimated"
          name="birthDateEstimated"
          checked={estimated}
          onCheckedChange={(checked) => setEstimated(checked === true)}
        />
        <Label htmlFor="birthDateEstimated">Birth date is estimated</Label>
      </div>

      <div className="flex flex-col gap-3 rounded-lg border p-3">
        <div className="flex items-center justify-between">
          <Label htmlFor="handFeeding">Hand-feeding</Label>
          <Switch
            id="handFeeding"
            name="handFeeding"
            checked={handFeeding}
            onCheckedChange={setHandFeeding}
          />
        </div>
        {handFeeding ? (
          <div className="flex flex-col gap-2">
            <Label htmlFor="feedingIntervalMinutes">Feeding interval (minutes)</Label>
            <Input
              id="feedingIntervalMinutes"
              name="feedingIntervalMinutes"
              type="number"
              min={30}
              max={720}
              step={15}
              defaultValue={v(
                "feedingIntervalMinutes",
                String(kitten?.feedingIntervalMinutes ?? 120),
              )}
            />
          </div>
        ) : null}
      </div>

      {state?.error ? (
        <p role="alert" className="text-destructive text-sm">
          {state.error}
        </p>
      ) : null}
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : kitten ? "Save changes" : "Add kitten"}
        </Button>
      </div>
    </form>
  );
}
