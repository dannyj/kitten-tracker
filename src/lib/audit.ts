import "server-only";

import { db } from "@/db";
import { auditLog } from "@/db/schema";

export type AuditAction =
  | "login.success"
  | "login.failure"
  | "login.rate_limited"
  | "logout"
  | "export.kitten"
  | "export.litter"
  | "adopter_pii.access";

/**
 * Append a durable audit entry. Never throws into the caller — a logging
 * failure must not break the action being logged.
 */
export function audit(
  action: AuditAction,
  opts: { username?: string | null; ip?: string | null; detail?: string } = {},
): void {
  try {
    db.insert(auditLog)
      .values({
        action,
        username: opts.username ?? null,
        ip: opts.ip ?? null,
        detail: opts.detail ?? null,
      })
      .run();
  } catch {
    // best-effort
  }
}
