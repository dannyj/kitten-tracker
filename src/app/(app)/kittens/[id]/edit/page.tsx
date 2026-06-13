import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { kittens } from "@/db/schema";
import { requireUser } from "@/lib/auth/guard";
import { KittenForm } from "../../kitten-form";
import { litterOptionList } from "../../litter-options";

export const metadata = { title: "Edit kitten — Kitten Tracker" };

export default async function EditKittenPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const idParse = z.coerce
    .number()
    .int()
    .positive()
    .safeParse((await params).id);
  if (!idParse.success) notFound();
  const kitten = db.select().from(kittens).where(eq(kittens.id, idParse.data)).get();
  if (!kitten) notFound();

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <h1 className="text-2xl font-semibold">Edit {kitten.name}</h1>
      <KittenForm kitten={kitten} litterOptions={litterOptionList()} />
    </div>
  );
}
