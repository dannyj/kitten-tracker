import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { litters, mothers } from "@/db/schema";
import { formatDate } from "@/lib/dates";

export type LitterWithLabel = {
  id: number;
  label: string;
  birthDate: string | null;
  estimated: boolean;
};

/** Litters labelled for selects: "Saar · born 02-06-2026" / "Orphan litter · born …". */
export function litterOptionList(): LitterWithLabel[] {
  const rows = db
    .select({
      id: litters.id,
      birthDate: litters.birthDate,
      estimated: litters.birthDateEstimated,
      motherName: mothers.name,
    })
    .from(litters)
    .leftJoin(mothers, eq(litters.motherId, mothers.id))
    .orderBy(desc(litters.id))
    .all();

  return rows.map((row) => ({
    id: row.id,
    birthDate: row.birthDate,
    estimated: row.estimated,
    label: `${row.motherName ?? "Orphan litter"} · born ${formatDate(row.birthDate)}${row.estimated ? " (est.)" : ""}`,
  }));
}
