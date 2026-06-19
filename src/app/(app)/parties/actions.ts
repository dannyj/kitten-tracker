"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { interestedParties, kittens, PARTY_STATUSES } from "@/db/schema";
import { type AdopterInput, markKittenAdopted } from "@/lib/adoption";
import { requireAdmin, requireUser } from "@/lib/auth/guard";
import { formValues, type FormState, phoneSchema } from "@/lib/forms";
import { isPartyTransitionAllowed } from "@/lib/parties";

const partySchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(200),
  partnerName: z.string().trim().max(200).optional().or(z.literal("")),
  phone: phoneSchema,
  email: z.string().trim().email("Invalid email").max(200).optional().or(z.literal("")),
  address: z.string().trim().max(500).optional().or(z.literal("")),
  source: z.string().trim().max(200).optional().or(z.literal("")),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
});

function partyPayload(parsed: z.infer<typeof partySchema>) {
  return {
    name: parsed.name,
    partnerName: parsed.partnerName || null,
    phone: parsed.phone || null,
    email: parsed.email || null,
    address: parsed.address || null,
    source: parsed.source || null,
    notes: parsed.notes || null,
  };
}

export async function createParty(_prev: FormState, formData: FormData): Promise<FormState> {
  // Entering contact PII — admin only.
  await requireAdmin();
  const parsed = partySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message, values: formValues(formData) };
  }
  const id = db
    .insert(interestedParties)
    .values(partyPayload(parsed.data))
    .returning({ id: interestedParties.id })
    .get().id;
  revalidatePath("/parties");
  redirect(`/parties/${id}`);
}

export async function updateParty(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const id = z.coerce.number().int().positive().safeParse(formData.get("id"));
  if (!id.success) return { error: "Invalid party" };
  const existing = db
    .select()
    .from(interestedParties)
    .where(eq(interestedParties.id, id.data))
    .get();
  if (!existing) return { error: "Party not found" };

  const parsed = partySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message, values: formValues(formData) };
  }
  db.update(interestedParties)
    .set(partyPayload(parsed.data))
    .where(eq(interestedParties.id, id.data))
    .run();
  revalidatePath("/parties");
  revalidatePath(`/parties/${id.data}`);
  redirect(`/parties/${id.data}`);
}

const statusChangeSchema = z.object({
  partyId: z.coerce.number().int().positive(),
  toStatus: z.enum(PARTY_STATUSES),
});

export async function changePartyStatus(_prev: FormState, formData: FormData): Promise<FormState> {
  // Status changes are operational, not PII entry — any signed-in user.
  await requireUser();
  const parsed = statusChangeSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { partyId, toStatus } = parsed.data;

  // Reaching "adopted" links kitten(s) and writes the adopter record — that runs
  // through adoptParty, never as a bare status change.
  if (toStatus === "adopted") {
    return { error: "Use the adoption step to link the kitten(s) being adopted." };
  }

  const party = db.select().from(interestedParties).where(eq(interestedParties.id, partyId)).get();
  if (!party) return { error: "Party not found" };
  if (party.status === toStatus) return { error: "Party already has this status" };
  if (!isPartyTransitionAllowed(party.status, toStatus)) {
    return { error: "That status change isn't allowed from the current stage." };
  }

  db.update(interestedParties)
    .set({ status: toStatus })
    .where(eq(interestedParties.id, partyId))
    .run();
  revalidatePath("/parties");
  revalidatePath(`/parties/${partyId}`);
  return null;
}

const adoptSchema = z.object({
  partyId: z.coerce.number().int().positive(),
  adoptionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Adoption date is required"),
  shelterReference: z.string().trim().max(100).optional().or(z.literal("")),
  adopterNote: z.string().trim().max(2000).optional().or(z.literal("")),
});

export async function adoptParty(_prev: FormState, formData: FormData): Promise<FormState> {
  // Writes the adopter PII record — admin only, matching changeKittenStatus.
  await requireAdmin();
  const parsed = adoptSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message, values: formValues(formData) };
  }
  const kittenIds = formData
    .getAll("kittenId")
    .map((v) => Number(v))
    .filter((n) => Number.isInteger(n) && n > 0);
  if (kittenIds.length === 0) {
    return { error: "Select at least one kitten to adopt.", values: formValues(formData) };
  }

  const party = db
    .select()
    .from(interestedParties)
    .where(eq(interestedParties.id, parsed.data.partyId))
    .get();
  if (!party) return { error: "Party not found" };

  // Reuse the party's contact details as the adopter record-of-truth.
  const adopter: AdopterInput = {
    adopterName: party.partnerName ? `${party.name} & ${party.partnerName}` : party.name,
    adopterPhone: party.phone ?? "",
    adopterEmail: party.email ?? "",
    adopterAddress: party.address ?? "",
    adoptionDate: parsed.data.adoptionDate,
    shelterReference: parsed.data.shelterReference ?? "",
    adopterNote: parsed.data.adopterNote ?? "",
  };

  // Guard every kitten before writing anything — no silent double-adopt.
  const targets: (typeof kittens.$inferSelect)[] = [];
  for (const kittenId of kittenIds) {
    const kitten = db.select().from(kittens).where(eq(kittens.id, kittenId)).get();
    if (!kitten) return { error: `Kitten #${kittenId} not found.`, values: formValues(formData) };
    if (kitten.status === "adopted" || kitten.status === "deceased") {
      return {
        error: `${kitten.name} is already ${kitten.status} and can't be adopted again.`,
        values: formValues(formData),
      };
    }
    targets.push(kitten);
  }

  db.transaction((tx) => {
    for (const kitten of targets) {
      markKittenAdopted(tx, kitten.id, adopter, `Adopted by ${adopter.adopterName}`);
    }
    tx.update(interestedParties)
      .set({ status: "adopted" })
      .where(eq(interestedParties.id, party.id))
      .run();
  });

  revalidatePath("/parties");
  revalidatePath(`/parties/${party.id}`);
  revalidatePath("/kittens");
  for (const kitten of targets) revalidatePath(`/kittens/${kitten.id}`);
  return null;
}
