/**
 * Pure schedule-template math for vaccinations/deworming. No runtime imports so
 * it stays portable and testable.
 *
 * Templates are convenience defaults, NOT a veterinary protocol — the shelter's
 * and vet's actual schedule takes precedence. This only suggests dates and flags
 * what looks due; it never decides what a kitten should receive.
 */

export type MedicalSubjectType = "kitten" | "mother";

export type ScheduleTemplate = {
  subjectType: MedicalSubjectType;
  vaccineType: string;
  label: string;
  firstWeeks: number;
  everyWeeks: number;
  untilWeeks: number;
};

/**
 * Seeded kitten defaults — convenience values reflecting commonly cited kitten
 * timing, NOT a vet protocol. Driven from birth date (first/every/until weeks).
 */
export const DEFAULT_KITTEN_SCHEDULE_TEMPLATES: ScheduleTemplate[] = [
  { subjectType: "kitten", vaccineType: "FVRCP", label: "FVRCP", firstWeeks: 7, everyWeeks: 3, untilWeeks: 16 },
  { subjectType: "kitten", vaccineType: "deworming", label: "Deworming", firstWeeks: 2, everyWeeks: 2, untilWeeks: 8 },
  {
    subjectType: "kitten",
    vaccineType: "flea treatment",
    label: "Flea treatment",
    firstWeeks: 8,
    everyWeeks: 4,
    untilWeeks: 24,
  },
];

/**
 * Seeded adult-cat (mother) defaults — convenience intervals reflecting commonly
 * cited adult-cat care timing, NOT a vet protocol. Adults have no birth-based
 * milestone schedule, so only `everyWeeks` is meaningful: it prefills the
 * next-due when a treatment is logged. `everyWeeks: 0` means one-off / not
 * routinely recurring (microchip is a one-off; rabies isn't routine for
 * indoor-only NL cats; FeLV is recorded as status), so nothing is auto-due.
 */
export const DEFAULT_MOTHER_SCHEDULE_TEMPLATES: ScheduleTemplate[] = [
  { subjectType: "mother", vaccineType: "microchip", label: "Microchip", firstWeeks: 0, everyWeeks: 0, untilWeeks: 0 },
  { subjectType: "mother", vaccineType: "deworming", label: "Deworming", firstWeeks: 0, everyWeeks: 13, untilWeeks: 0 },
  { subjectType: "mother", vaccineType: "flea treatment", label: "Flea treatment", firstWeeks: 0, everyWeeks: 4, untilWeeks: 0 },
  { subjectType: "mother", vaccineType: "FVRCP", label: "FVRCP", firstWeeks: 0, everyWeeks: 52, untilWeeks: 0 },
  { subjectType: "mother", vaccineType: "rabies", label: "Rabies", firstWeeks: 0, everyWeeks: 0, untilWeeks: 0 },
  { subjectType: "mother", vaccineType: "FeLV", label: "FeLV", firstWeeks: 0, everyWeeks: 0, untilWeeks: 0 },
];

/** All seeded defaults across both subjects (migration seed + settings reset). */
export const DEFAULT_SCHEDULE_TEMPLATES: ScheduleTemplate[] = [
  ...DEFAULT_KITTEN_SCHEDULE_TEMPLATES,
  ...DEFAULT_MOTHER_SCHEDULE_TEMPLATES,
];

/** Selectable kitten medical types; "other" allows free text. */
export const VACCINE_TYPES = [
  "FVRCP",
  "deworming",
  "flea treatment",
  "rabies",
  "FeLV",
  "vet check",
  "other",
] as const;

/** Selectable adult-cat (mother) medical types; "other" allows free text. */
export const MOTHER_VACCINE_TYPES = [
  "microchip",
  "deworming",
  "flea treatment",
  "FVRCP",
  "rabies",
  "FeLV",
  "vet check",
  "other",
] as const;

const DAY_MS = 86_400_000;

function isoToUtc(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

function utcToIso(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

export function addDaysIso(iso: string, days: number): string {
  return utcToIso(isoToUtc(iso) + Math.round(days) * DAY_MS);
}

/** All suggested milestone dates for a template, from the kitten's birth date. */
export function milestoneDates(birthDateIso: string, tpl: ScheduleTemplate): string[] {
  if (tpl.everyWeeks <= 0) return [addDaysIso(birthDateIso, tpl.firstWeeks * 7)];
  const dates: string[] = [];
  for (let w = tpl.firstWeeks; w <= tpl.untilWeeks + 1e-9; w += tpl.everyWeeks) {
    dates.push(addDaysIso(birthDateIso, w * 7));
  }
  return dates;
}

export type DueItem = {
  vaccineType: string;
  label: string;
  dueDateIso: string;
  overdue: boolean;
};

/**
 * The next suggested dose for a template given how many have already been
 * administered (count originals, not corrections). null once the schedule for
 * that template is complete.
 */
export function nextDueForType(
  birthDateIso: string,
  tpl: ScheduleTemplate,
  givenCount: number,
  todayIso: string,
): DueItem | null {
  const dates = milestoneDates(birthDateIso, tpl);
  if (givenCount >= dates.length) return null;
  const dueDateIso = dates[givenCount];
  return {
    vaccineType: tpl.vaccineType,
    label: tpl.label,
    dueDateIso,
    overdue: dueDateIso < todayIso,
  };
}

/** Next suggested item per template (skips completed schedules). */
export function nextDueAll(
  birthDateIso: string,
  templates: ScheduleTemplate[],
  givenCountByType: Record<string, number>,
  todayIso: string,
): DueItem[] {
  const out: DueItem[] = [];
  for (const tpl of templates) {
    const item = nextDueForType(
      birthDateIso,
      tpl,
      givenCountByType[tpl.vaccineType] ?? 0,
      todayIso,
    );
    if (item) out.push(item);
  }
  return out;
}

/** Days from today to an ISO date (negative = overdue). */
export function daysUntil(dueDateIso: string, todayIso: string): number {
  return Math.round((isoToUtc(dueDateIso) - isoToUtc(todayIso)) / DAY_MS);
}

/** Prefill for the next_due_date field when logging: given date + booster interval. */
export function suggestNextDueDate(givenAtIso: string, tpl: ScheduleTemplate): string | null {
  if (tpl.everyWeeks <= 0) return null;
  return addDaysIso(givenAtIso, tpl.everyWeeks * 7);
}
