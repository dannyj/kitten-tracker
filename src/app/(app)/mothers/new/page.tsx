import { requireUser } from "@/lib/auth/guard";
import { MotherForm } from "../mother-form";

export const metadata = { title: "Add mother — Kitten Tracker" };

export default async function NewMotherPage() {
  await requireUser();
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <h1 className="text-2xl font-semibold">Add mother</h1>
      <MotherForm />
    </div>
  );
}
