/**
 * Pure schedule-template math for vaccinations/deworming. No runtime imports so
 * it stays portable and testable.
 *
 * Templates are convenience defaults, NOT a veterinary protocol — the shelter's
 * and vet's actual schedule takes precedence. This only suggests dates and flags
 * what looks due; it never decides what a kitten should receive.
 */

export type ScheduleTemplate = {
  vaccineType: string;
  label: string;
  firstWeeks: number;
  everyWeeks: number;
  untilWeeks: number;
};

/**
 * Seeded defaults — convenience values reflecting commonly cited kitten timing,
 * NOT a vet protocol. Shared by the migration seed and the settings "reset".
 */
export const DEFAULT_SCHEDULE_TEMPLATES: ScheduleTemplate[] = [
  { vaccineType: "FVRCP", label: "FVRCP", firstWeeks: 7, everyWeeks: 3, untilWeeks: 16 },
  { vaccineType: "deworming", label: "Deworming", firstWeeks: 2, everyWeeks: 2, untilWeeks: 8 },
  {
    vaccineType: "flea treatment",
    label: "Flea treatment",
    firstWeeks: 8,
    everyWeeks: 4,
    untilWeeks: 24,
  },
];

/** Selectable vaccination/medical types; "other" allows free text. */
export const VACCINE_TYPES = [
  "FVRCP",
  "deworming",
  "flea treatment",
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
