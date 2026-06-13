import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { mothers } from "@/db/schema";
import { requireUser } from "@/lib/auth/guard";
import { MotherForm } from "../../mother-form";

export const metadata = { title: "Edit mother — Kitten Tracker" };

export default async function EditMotherPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const idParse = z.coerce
    .number()
    .int()
    .positive()
    .safeParse((await params).id);
  if (!idParse.success) notFound();
  const mother = db.select().from(mothers).where(eq(mothers.id, idParse.data)).get();
  if (!mother) notFound();

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <h1 className="text-2xl font-semibold">Edit {mother.name}</h1>
      <MotherForm mother={mother} />
    </div>
  );
}
