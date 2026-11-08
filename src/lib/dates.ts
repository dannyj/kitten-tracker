/** Date-only fields use the shelter's calendar, independent of server/browser TZ. */
export const CALENDAR_TIME_ZONE = "Europe/Amsterdam";
const calendarDate = new Intl.DateTimeFormat("en-CA", {
  timeZone: CALENDAR_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}-${m}-${y}`;
}

export function formatDateTime(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(date.getDate())}-${pad(date.getMonth() + 1)}-${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function todayIso(now = new Date()): string {
  const parts = calendarDate.formatToParts(now);
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)!.value;
  return `${value("year")}-${value("month")}-${value("day")}`;
}

/** Format a Date for an <input type="datetime-local"> (local time, no seconds). */
export function toDatetimeLocal(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/**
 * Convert a datetime-local string ("YYYY-MM-DDTHH:mm", browser wall-clock) into
 * an absolute ISO instant. Run this on the client: the browser interprets the
 * naive string in its own timezone, pinning the instant before it reaches the
 * server — which would otherwise re-parse the naive string in the server's
 * timezone (UTC in production) and read the time as hours off.
 */
export function datetimeLocalToIso(value: string): string {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toISOString();
}

/** In place, replace a datetime-local form field with an absolute ISO instant. */
export function pinDatetimeField(formData: FormData, field: string): void {
  const v = formData.get(field);
  if (typeof v === "string" && v) formData.set(field, datetimeLocalToIso(v));
}

/**
 * Age in "3w 2d" format from an ISO birth date, optionally frozen at `until`
 * (deceased kittens). Returns null when the birth date is missing/invalid or
 * in the future. `estimated` adds a "~" prefix.
 */
export function formatAge(
  birthDate: string | null | undefined,
  options: { estimated?: boolean; until?: Date } = {},
): string | null {
  if (!birthDate) return null;
  const birth = new Date(`${birthDate}T00:00:00Z`);
  if (Number.isNaN(birth.getTime()) || birth.toISOString().slice(0, 10) !== birthDate) return null;
  const end = options.until ?? new Date();
  if (Number.isNaN(end.getTime())) return null;
  // Count calendar days, rather than elapsed 24-hour periods across DST.
  const endDay = new Date(`${todayIso(end)}T00:00:00Z`);
  const days = (endDay.getTime() - birth.getTime()) / 86_400_000;
  if (days < 0) return null;
  const weeks = Math.floor(days / 7);
  const rest = days % 7;
  const text = weeks > 0 ? `${weeks}w ${rest}d` : `${rest}d`;
  return options.estimated ? `~${text}` : text;
}
