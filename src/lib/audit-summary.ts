// One counter for all rejected identities; arbitrary usernames cannot grow storage.
export class RejectionSummary {
  private count = 0;
  add(): void {
    this.count = Math.min(Number.MAX_SAFE_INTEGER, this.count + 1);
  }
  drain(): number {
    const count = this.count;
    this.count = 0;
    return count;
  }
}
export const AUDIT_RETENTION_DAYS = 90;
export function auditCutoff(now: number): number {
  return Math.floor(now / 1000) - AUDIT_RETENTION_DAYS * 86_400;
}

export class RejectionAudit {
  private summary = new RejectionSummary();
  private pending = false;
  constructor(
    privateWriter: (detail: string) => void,
    privateSchedule: (flush: () => void) => void,
  ) {
    this.writer = privateWriter;
    this.schedule = privateSchedule;
  }
  private writer: (detail: string) => void;
  private schedule: (flush: () => void) => void;
  private write(detail: string): void {
    try {
      this.writer(detail);
    } catch {
      /* best effort */
    }
  }
  add(): void {
    this.summary.add();
    if (this.pending) return;
    this.pending = true;
    this.write("Rejected login burst started; client identity unavailable.");
    this.schedule(() => {
      const count = this.summary.drain();
      this.pending = false;
      this.write(JSON.stringify({ rejectedRequests: count, intervalSeconds: 60 }));
    });
  }
}
