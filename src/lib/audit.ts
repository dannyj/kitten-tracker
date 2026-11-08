import "server-only";

import { sql } from "drizzle-orm";
import { RejectionAudit, auditCutoff } from "./audit-summary";
import { db } from "@/db";
import { auditLog } from "@/db/schema";

export type AuditAction =
  | "login.success"
  | "login.failure"
  | "login.rate_limited"
  | "logout"
  | "export.kitten"
  | "export.litter"
  | "export.mother"
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
    retainAudit();
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

// One initial event and one summary per active minute, independent of identities.
// Pending counts can be lost on an abrupt process exit; the initial event remains.
const state = globalThis as unknown as {
  __rejectedLoginAudit?: RejectionAudit;
  __auditPruneAt?: number;
};
const rejected = (state.__rejectedLoginAudit ??= new RejectionAudit(
  (detail) => audit("login.rate_limited", { detail }),
  (flush) => {
    const timer = setTimeout(flush, 60_000);
    timer.unref();
  },
));
export function auditLoginRejection(): void {
  rejected.add();
}

/** At most hourly, also invoked by ordinary authenticated audit activity. */
function retainAudit(): void {
  const now = Date.now();
  if ((state.__auditPruneAt ?? 0) > now) return;
  state.__auditPruneAt = now + 3_600_000;
  db.run(sql`DELETE FROM audit_log WHERE at < ${auditCutoff(now)}`);
}
