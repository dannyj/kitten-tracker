"use server";

import { eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { interestedParties, kittens, viewingKittens, viewings } from "@/db/schema";
import { requireUser } from "@/lib/auth/guard";
import { formValues, type FormState } from "@/lib/forms";
import { isPartyTransitionAllowed } from "@/lib/parties";

// visitedAt arrives as an absolute ISO instant (the client pins the
// datetime-local wall-clock before submit — see pinDatetimeField). A viewing is
// an appointment, so a future date is valid; we only sanity-check parseability.
const viewingSchema = z.object({
  interestedPartyId: z.coerce.number().int().positive("An interested party is required"),
  visitedAt: z
    .string()
    .min(1, "A date and time is required")
    .refine((v) => !Number.isNaN(new Date(v).getTime()), "Invalid date/time"),
  location: z.string().trim().max(200).optional().or(z.literal("")),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
});

function kittenIdsFrom(formData: FormData): number[] {
  return formData
    .getAll("kittenId")
    .map((v) => Number(v))
    .filter((n) => Number.isInteger(n) && n > 0);
}

export async function createViewing(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireUser();
  const parsed = viewingSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message, values: formValues(formData) };
  }
  const kittenIds = kittenIdsFrom(formData);
  if (kittenIds.length === 0) {
    return { error: "Select at least one kitten for this viewing.", values: formValues(formData) };
  }

  const party = db
    .select()
    .from(interestedParties)
    .where(eq(interestedParties.id, parsed.data.interestedPartyId))
    .get();
  if (!party) return { error: "Interested party not found", values: formValues(formData) };

  const found = db
    .select({ id: kittens.id })
    .from(kittens)
    .where(inArray(kittens.id, kittenIds))
    .all();
  if (found.length !== kittenIds.length) {
    return { error: "One or more selected kittens no longer exist.", values: formValues(formData) };
  }

  // "Mark as viewing booked" — only when the foster opts in and the move is a
  // sensible forward step (don't drag a party back from approved/viewed).
  const bookIt = formData.get("bookStatus") === "on";

  db.transaction((tx) => {
    const viewingId = tx
      .insert(viewings)
      .values({
        interestedPartyId: party.id,
        visitedAt: new Date(parsed.data.visitedAt),
        location: parsed.data.location || null,
        notes: parsed.data.notes || null,
      })
      .returning({ id: viewings.id })
      .get().id;
    for (const kittenId of kittenIds) {
      tx.insert(viewingKittens).values({ viewingId, kittenId }).run();
    }
    if (bookIt && isPartyTransitionAllowed(party.status, "viewing_booked")) {
      tx.update(interestedParties)
        .set({ status: "viewing_booked" })
        .where(eq(interestedParties.id, party.id))
        .run();
    }
  });

  revalidatePath("/viewings");
  revalidatePath(`/parties/${party.id}`);
  redirect("/viewings");
}

const updateSchema = viewingSchema.extend({
  id: z.coerce.number().int().positive(),
});

export async function updateViewing(_prev: FormState, formData: FormData): Promise<FormState> {
  // Editing impressions/details is working judgement — no hard edit window.
  await requireUser();
  const parsed = updateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message, values: formValues(formData) };
  }
  const existing = db.select().from(viewings).where(eq(viewings.id, parsed.data.id)).get();
  if (!existing) return { error: "Viewing not found" };

  db.update(viewings)
    .set({
      visitedAt: new Date(parsed.data.visitedAt),
      location: parsed.data.location || null,
      notes: parsed.data.notes || null,
    })
    .where(eq(viewings.id, parsed.data.id))
    .run();

  revalidatePath("/viewings");
  revalidatePath(`/parties/${existing.interestedPartyId}`);
  return null;
}

export async function deleteViewing(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireUser();
  const id = z.coerce.number().int().positive().safeParse(formData.get("id"));
  if (!id.success) return { error: "Invalid viewing" };
  const existing = db.select().from(viewings).where(eq(viewings.id, id.data)).get();
  if (!existing) return { error: "Viewing not found" };
  // viewing_kittens rows cascade off the viewing FK.
  db.delete(viewings).where(eq(viewings.id, id.data)).run();
  revalidatePath("/viewings");
  revalidatePath(`/parties/${existing.interestedPartyId}`);
  return null;
}

// Used by the calendar's "mark viewed" affordance once a booked viewing's date
// has passed. Advances the linked party to "viewed" when that's a valid step.
export async function markPartyViewed(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireUser();
  const partyId = z.coerce.number().int().positive().safeParse(formData.get("partyId"));
  if (!partyId.success) return { error: "Invalid party" };
  const party = db
    .select()
    .from(interestedParties)
    .where(eq(interestedParties.id, partyId.data))
    .get();
  if (!party) return { error: "Party not found" };
  if (isPartyTransitionAllowed(party.status, "viewed")) {
    db.update(interestedParties)
      .set({ status: "viewed" })
      .where(eq(interestedParties.id, partyId.data))
      .run();
  }
  revalidatePath("/viewings");
  revalidatePath(`/parties/${partyId.data}`);
  return null;
}
