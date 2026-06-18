import "server-only";

import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  adopters,
  kittens,
  litters,
  motherHealthLogs,
  mothers,
  type MedicalSubjectType,
  vaccinations,
  weightEntries,
} from "@/db/schema";
import { formatAge } from "@/lib/dates";
import { buildKittenGrowthSeries, type GrowthChartPoint } from "@/lib/growth";
import { getAlertSettings } from "@/lib/settings";
import { STATUS_LABELS } from "@/lib/status";

export type ExportVaccination = {
  type: string;
  givenAtIso: string;
  batchNumber: string | null;
  administeredBy: string | null;
  nextDueDateIso: string | null;
  note: string | null;
  correctsOfDateIso: string | null;
};

export type ExportHealthNote = { dateIso: string; category: string; entry: string };

export type ExportGrowth = {
  birthWeightG: number;
  birthWeighedAtIso: string;
  latestWeightG: number;
  latestWeighedAtIso: string;
  avgGainPerDay: number | null;
};

export type ExportAdopter = {
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  adoptionDateIso: string | null;
  shelterReference: string | null;
};

export type ExportWeight = { dateIso: string; grams: number; note: string | null };

export type KittenExport = {
  id: number;
  name: string;
  shelterNumber: string | null;
  sex: string;
  birthDateIso: string | null;
  birthDateEstimated: boolean;
  ageText: string | null;
  statusLabel: string;
  vaccinations: ExportVaccination[];
  growth: ExportGrowth | null;
  /** Full weight history (chronological) for the data table. */
  weights: ExportWeight[];
  /** Chart series with the expected-growth band, for the rendered chart. */
  growthSeries: GrowthChartPoint[];
  adopter: ExportAdopter | null;
};

const SEX_LABELS: Record<string, string> = { male: "Male", female: "Female", unknown: "Unknown" };

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function buildGrowth(kittenId: number): ExportGrowth | null {
  const rows = db
    .select({ weighedAt: weightEntries.weighedAt, weightGrams: weightEntries.weightGrams })
    .from(weightEntries)
    .where(eq(weightEntries.kittenId, kittenId))
    .orderBy(asc(weightEntries.weighedAt), asc(weightEntries.id))
    .all();
  if (rows.length === 0) return null;
  const first = rows[0];
  const last = rows[rows.length - 1];
  const days = (last.weighedAt.getTime() - first.weighedAt.getTime()) / 86_400_000;
  return {
    birthWeightG: first.weightGrams,
    birthWeighedAtIso: isoDate(first.weighedAt),
    latestWeightG: last.weightGrams,
    latestWeighedAtIso: isoDate(last.weighedAt),
    avgGainPerDay:
      days > 0 ? Math.round(((last.weightGrams - first.weightGrams) / days) * 10) / 10 : null,
  };
}

function buildMedical(subjectType: MedicalSubjectType, subjectId: number): ExportVaccination[] {
  const rows = db
    .select()
    .from(vaccinations)
    .where(and(eq(vaccinations.subjectType, subjectType), eq(vaccinations.subjectId, subjectId)))
    .orderBy(asc(vaccinations.givenAt), asc(vaccinations.id))
    .all();
  const givenAtById = new Map(rows.map((r) => [r.id, r.givenAt]));
  return rows.map((r) => ({
    type: r.type,
    givenAtIso: r.givenAt,
    batchNumber: r.batchNumber,
    administeredBy: r.administeredBy,
    nextDueDateIso: r.nextDueDate,
    note: r.note,
    correctsOfDateIso: r.correctsId ? (givenAtById.get(r.correctsId) ?? null) : null,
  }));
}

function buildAdopter(kittenId: number): ExportAdopter | null {
  const row = db
    .select()
    .from(adopters)
    .where(eq(adopters.kittenId, kittenId))
    .orderBy(asc(adopters.id))
    .all()
    .at(-1);
  if (!row) return null;
  return {
    name: row.name,
    phone: row.phone,
    email: row.email,
    address: row.address,
    adoptionDateIso: row.adoptionDate,
    shelterReference: row.shelterReference,
  };
}

function buildWeights(kittenId: number): { weights: ExportWeight[]; series: GrowthChartPoint[] } {
  const rows = db
    .select({
      weighedAt: weightEntries.weighedAt,
      weightGrams: weightEntries.weightGrams,
      note: weightEntries.note,
    })
    .from(weightEntries)
    .where(eq(weightEntries.kittenId, kittenId))
    .orderBy(asc(weightEntries.weighedAt), asc(weightEntries.id))
    .all();
  const settings = getAlertSettings();
  const series = buildKittenGrowthSeries(
    rows.map((r) => ({ weighedAtMs: r.weighedAt.getTime(), weightGrams: r.weightGrams })),
    { minDailyGainG: settings.minDailyGainG, targetDailyGainG: settings.targetDailyGainG },
  );
  return {
    weights: rows.map((r) => ({
      dateIso: isoDate(r.weighedAt),
      grams: r.weightGrams,
      note: r.note,
    })),
    series,
  };
}

function buildKitten(kitten: typeof kittens.$inferSelect, includeAdopter: boolean): KittenExport {
  const { weights, series } = buildWeights(kitten.id);
  return {
    id: kitten.id,
    name: kitten.name,
    shelterNumber: kitten.shelterNumber,
    sex: SEX_LABELS[kitten.sex] ?? kitten.sex,
    birthDateIso: kitten.birthDate,
    birthDateEstimated: kitten.birthDateEstimated,
    ageText: formatAge(kitten.birthDate, { estimated: kitten.birthDateEstimated }),
    statusLabel: STATUS_LABELS[kitten.status],
    vaccinations: buildMedical("kitten", kitten.id),
    growth: buildGrowth(kitten.id),
    weights,
    growthSeries: series,
    adopter: includeAdopter ? buildAdopter(kitten.id) : null,
  };
}

export function getKittenExport(kittenId: number, includeAdopter: boolean): KittenExport | null {
  const kitten = db.select().from(kittens).where(eq(kittens.id, kittenId)).get();
  if (!kitten) return null;
  return buildKitten(kitten, includeAdopter);
}

const MOTHER_STATUS_LABELS: Record<string, string> = {
  in_care: "In care",
  returned: "Returned to shelter",
  deceased: "Deceased",
};

export type MotherExport = {
  id: number;
  name: string;
  shelterNumber: string | null;
  intakeDateIso: string | null;
  statusLabel: string;
  /** Structured treatment history (shared code path with kittens). */
  vaccinations: ExportVaccination[];
  /** Free-text health-log observations, newest-first. */
  healthNotes: ExportHealthNote[];
};

function buildHealthNotes(motherId: number): ExportHealthNote[] {
  return db
    .select()
    .from(motherHealthLogs)
    .where(eq(motherHealthLogs.motherId, motherId))
    .orderBy(asc(motherHealthLogs.loggedAt), asc(motherHealthLogs.id))
    .all()
    .map((l) => ({
      dateIso: isoDate(l.loggedAt),
      category: l.category,
      entry: l.entry,
    }));
}

function buildMother(mother: typeof mothers.$inferSelect): MotherExport {
  return {
    id: mother.id,
    name: mother.name,
    shelterNumber: mother.shelterNumber,
    intakeDateIso: mother.intakeDate,
    statusLabel: MOTHER_STATUS_LABELS[mother.status] ?? mother.status,
    // The mother has no growth chart (kitten-specific) — just medical + notes.
    vaccinations: buildMedical("mother", mother.id),
    healthNotes: buildHealthNotes(mother.id),
  };
}

export function getMotherExport(motherId: number): MotherExport | null {
  const mother = db.select().from(mothers).where(eq(mothers.id, motherId)).get();
  if (!mother) return null;
  return buildMother(mother);
}

export type LitterExport = {
  litterId: number;
  title: string;
  birthDateIso: string | null;
  mother: MotherExport | null;
  kittens: KittenExport[];
};

export function getLitterExport(litterId: number, includeAdopter: boolean): LitterExport | null {
  const litter = db.select().from(litters).where(eq(litters.id, litterId)).get();
  if (!litter) return null;
  const mother = litter.motherId
    ? db.select().from(mothers).where(eq(mothers.id, litter.motherId)).get()
    : undefined;
  const litterKittens = db
    .select()
    .from(kittens)
    .where(eq(kittens.litterId, litterId))
    .orderBy(asc(kittens.name))
    .all();
  return {
    litterId,
    title: mother ? `${mother.name}'s litter` : "Orphan litter",
    birthDateIso: litter.birthDate,
    mother: mother ? buildMother(mother) : null,
    kittens: litterKittens.map((k) => buildKitten(k, includeAdopter)),
  };
}
