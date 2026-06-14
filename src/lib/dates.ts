/** Dates are stored as ISO strings (yyyy-mm-dd, what <input type="date"> emits). */

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

export function todayIso(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
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
  const birth = new Date(`${birthDate}T00:00:00`);
  if (Number.isNaN(birth.getTime())) return null;
  const end = options.until ?? new Date();
  const days = Math.floor((end.getTime() - birth.getTime()) / 86_400_000);
  if (days < 0) return null;
  const weeks = Math.floor(days / 7);
  const rest = days % 7;
  const text = weeks > 0 ? `${weeks}w ${rest}d` : `${rest}d`;
  return options.estimated ? `~${text}` : text;
}
