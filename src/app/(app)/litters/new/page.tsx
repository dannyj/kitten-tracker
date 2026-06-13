import { asc } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { mothers } from "@/db/schema";
import { requireUser } from "@/lib/auth/guard";
import { LitterForm } from "../litter-form";

export const metadata = { title: "Add litter — Kitten Tracker" };

export default async function NewLitterPage({
  searchParams,
}: {
  searchParams: Promise<{ mother?: string }>;
}) {
  await requireUser();
  const motherParam = z.coerce
    .number()
    .int()
    .positive()
    .safeParse((await searchParams).mother);
  const motherRows = db
    .select({ id: mothers.id, name: mothers.name })
    .from(mothers)
    .orderBy(asc(mothers.name))
    .all();

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <h1 className="text-2xl font-semibold">Add litter</h1>
      <LitterForm
        mothers={motherRows}
        preselectedMotherId={motherParam.success ? motherParam.data : undefined}
      />
    </div>
  );
}
