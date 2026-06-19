import { requireAdmin } from "@/lib/auth/guard";
import { PartyForm } from "../party-form";

export const metadata = { title: "Add interested party — Kitten Tracker" };

export default async function NewPartyPage() {
  // Entering contact PII — admin only, matching the create action.
  await requireAdmin();
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <h1 className="text-2xl font-semibold">Add interested party</h1>
      <PartyForm />
    </div>
  );
}
