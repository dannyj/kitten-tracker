import Link from "next/link";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/guard";
import { KittenForm } from "../kitten-form";
import { litterOptionList } from "../litter-options";

export const metadata = { title: "Add kitten — Kitten Tracker" };

export default async function NewKittenPage({
  searchParams,
}: {
  searchParams: Promise<{ litter?: string }>;
}) {
  await requireUser();
  const litterParam = z.coerce
    .number()
    .int()
    .positive()
    .safeParse((await searchParams).litter);
  const litterOptions = litterOptionList();

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <h1 className="text-2xl font-semibold">Add kitten</h1>
      {litterOptions.length === 0 ? (
        <div className="flex flex-col items-start gap-3 rounded-lg border border-dashed p-6">
          <p className="text-sm">Every kitten belongs to a litter — create one first.</p>
          <Button asChild>
            <Link href="/litters/new">Add litter</Link>
          </Button>
        </div>
      ) : (
        <KittenForm
          litterOptions={litterOptions}
          preselectedLitterId={litterParam.success ? litterParam.data : undefined}
        />
      )}
    </div>
  );
}
