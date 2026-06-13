"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { KittenStatus } from "@/db/schema";
import { todayIso } from "@/lib/dates";
import type { FormState } from "@/lib/forms";
import { availableTransitions, STATUS_LABELS } from "@/lib/status";
import { changeKittenStatus } from "../actions";

function TransitionDialog({
  kittenId,
  from,
  to,
  requiresNote,
  onClose,
}: {
  kittenId: number;
  from: KittenStatus;
  to: KittenStatus;
  requiresNote: boolean;
  onClose: () => void;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    async (prev, formData) => {
      const result = await changeKittenStatus(prev, formData);
      if (!result) onClose();
      return result;
    },
    null,
  );
  const v = (field: string, fallback: string) => state?.values?.[field] ?? fallback;
  const isAdoption = to === "adopted";

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {STATUS_LABELS[from]} → {STATUS_LABELS[to]}
          </DialogTitle>
          <DialogDescription>
            {isAdoption
              ? "Adopter details are required to mark a kitten as adopted."
              : requiresNote
                ? "This moves the kitten backwards in the pipeline — a note is required."
                : "This will be recorded in the status history."}
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="flex flex-col gap-4">
          <input type="hidden" name="kittenId" value={kittenId} />
          <input type="hidden" name="toStatus" value={to} />

          {isAdoption ? (
            <>
              <div className="flex flex-col gap-2">
                <Label htmlFor="adopterName">Adopter name *</Label>
                <Input
                  id="adopterName"
                  name="adopterName"
                  required
                  maxLength={200}
                  defaultValue={v("adopterName", "")}
                />
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="adopterPhone">Phone</Label>
                  <Input
                    id="adopterPhone"
                    name="adopterPhone"
                    type="tel"
                    placeholder="06… or +31…"
                    maxLength={25}
                    defaultValue={v("adopterPhone", "")}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="adopterEmail">Email</Label>
                  <Input
                    id="adopterEmail"
                    name="adopterEmail"
                    type="email"
                    maxLength={200}
                    defaultValue={v("adopterEmail", "")}
                  />
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="adopterAddress">Address</Label>
                <Textarea
                  id="adopterAddress"
                  name="adopterAddress"
                  rows={2}
                  maxLength={500}
                  defaultValue={v("adopterAddress", "")}
                />
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="adoptionDate">Adoption date *</Label>
                  <Input
                    id="adoptionDate"
                    name="adoptionDate"
                    type="date"
                    required
                    defaultValue={v("adoptionDate", todayIso())}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="shelterReference">Shelter reference</Label>
                  <Input
                    id="shelterReference"
                    name="shelterReference"
                    maxLength={100}
                    defaultValue={v("shelterReference", "")}
                  />
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="adopterNote">Note</Label>
                <Textarea
                  id="adopterNote"
                  name="adopterNote"
                  rows={2}
                  maxLength={2000}
                  defaultValue={v("adopterNote", "")}
                />
              </div>
            </>
          ) : null}

          <div className="flex flex-col gap-2">
            <Label htmlFor="note">{requiresNote ? "Note (required)" : "Note (optional)"}</Label>
            <Textarea
              id="note"
              name="note"
              rows={2}
              maxLength={2000}
              required={requiresNote}
              placeholder={requiresNote ? "Why is this kitten moving back?" : ""}
              defaultValue={v("note", "")}
            />
          </div>

          {state?.error ? (
            <p role="alert" className="text-destructive text-sm">
              {state.error}
            </p>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : `Mark as ${STATUS_LABELS[to].toLowerCase()}`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function StatusControl({
  kittenId,
  currentStatus,
  isAdmin,
}: {
  kittenId: number;
  currentStatus: KittenStatus;
  isAdmin: boolean;
}) {
  const [target, setTarget] = useState<{ to: KittenStatus; requiresNote: boolean } | null>(null);
  // Adoption captures adopter PII, which is admin-only.
  const transitions = availableTransitions(currentStatus).filter(
    (t) => isAdmin || t.to !== "adopted",
  );

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        {transitions
          .filter((t) => !t.requiresNote)
          .map((t) => (
            <Button key={t.to} size="sm" onClick={() => setTarget(t)}>
              → {STATUS_LABELS[t.to]}
            </Button>
          ))}
      </div>
      <div className="flex flex-wrap gap-2">
        {transitions
          .filter((t) => t.requiresNote)
          .map((t) => (
            <Button
              key={t.to}
              size="sm"
              variant="outline"
              className="text-muted-foreground"
              onClick={() => setTarget(t)}
            >
              ↩ {STATUS_LABELS[t.to]}
            </Button>
          ))}
      </div>
      {target ? (
        <TransitionDialog
          kittenId={kittenId}
          from={currentStatus}
          to={target.to}
          requiresNote={target.requiresNote}
          onClose={() => setTarget(null)}
        />
      ) : null}
    </div>
  );
}
