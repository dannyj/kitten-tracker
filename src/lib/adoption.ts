import "server-only";

import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { adopters, kittens, statusHistory } from "@/db/schema";
import { phoneSchema } from "@/lib/forms";

// One transaction handle, so the shared adoption write can run inside either the
// kitten status pipeline (kittens/actions.ts) or the party→kitten adoption link
// (parties/actions.ts) without each forking its own divergent adopter insert.
export type DbTx = Parameters<Parameters<typeof db.transaction>[0]>[0];

// The adopter record-of-truth. Shared so both entry points capture the exact
// same shape (step-2's "adopted requires adopter details" rule).
export const adopterSchema = z.object({
  adopterName: z.string().trim().min(1, "Adopter name is required").max(200),
  adopterPhone: phoneSchema,
  adopterEmail: z.string().trim().email("Invalid email").max(200).optional().or(z.literal("")),
  adopterAddress: z.string().trim().max(500).optional().or(z.literal("")),
  adoptionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Adoption date is required"),
  shelterReference: z.string().trim().max(100).optional().or(z.literal("")),
  adopterNote: z.string().trim().max(2000).optional().or(z.literal("")),
});
export type AdopterInput = z.infer<typeof adopterSchema>;

/**
 * Move a kitten to `adopted` and write its adopter record, inside the caller's
 * transaction. Writes `status_history` — this IS the step-2 pipeline move, not a
 * bypass of it. Callers must guard that the kitten isn't already
 * adopted/deceased before calling.
 */
export function markKittenAdopted(
  tx: DbTx,
  kittenId: number,
  adopter: AdopterInput,
  note?: string | null,
): void {
  tx.update(kittens).set({ status: "adopted" }).where(eq(kittens.id, kittenId)).run();
  tx.insert(statusHistory)
    .values({ kittenId, status: "adopted", note: note || null })
    .run();
  tx.insert(adopters)
    .values({
      kittenId,
      name: adopter.adopterName,
      phone: adopter.adopterPhone || null,
      email: adopter.adopterEmail || null,
      address: adopter.adopterAddress || null,
      adoptionDate: adopter.adoptionDate,
      shelterReference: adopter.shelterReference || null,
      note: adopter.adopterNote || null,
    })
    .run();
}
