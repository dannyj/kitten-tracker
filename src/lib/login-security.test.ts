import assert from "node:assert/strict";
import { test } from "node:test";
import { LoginLimits, RequestLimit } from "./auth/login-limits.ts";
import { RejectionSummary, RejectionAudit, auditCutoff } from "./audit-summary.ts";

test("account limits persist until expiry", () => {
  const limiter = new LoginLimits();
  for (let i = 0; i < 5; i++) {
    const release = limiter.acquire("admin", 0);
    assert.ok(release);
    release();
  }
  assert.equal(limiter.acquire("admin", 0), null);
  assert.ok(limiter.acquire("admin", 900_000));
});

test("total attempts cannot reset through successful releases or new identities", () => {
  const limiter = new LoginLimits();
  for (let i = 0; i < 50; i++) {
    const release = limiter.acquire(`user${i}`, 0);
    assert.ok(release);
    release();
  }
  assert.equal(limiter.acquire("new", 0), null);
  assert.ok(limiter.acquire("new", 900_000));
});

test("concurrent verification is bounded and release is idempotent", () => {
  const limiter = new LoginLimits();
  const one = limiter.acquire("one", 0)!;
  const two = limiter.acquire("two", 0)!;
  assert.equal(limiter.acquire("three", 0), null);
  one();
  one();
  assert.ok(limiter.acquire("three", 0));
  assert.equal(limiter.acquire("four", 0), null);
  two();
});

test("full account storage refuses new keys without evicting live limits", () => {
  const limiter = new LoginLimits(2);
  limiter.acquire("one", 0)!();
  limiter.acquire("two", 0)!();
  assert.equal(limiter.acquire("three", 0), null);
  assert.equal(limiter.size, 2);
  assert.ok(limiter.acquire("three", 900_000));
  assert.equal(limiter.size, 1);
});

test("login POST gate bounds requests each minute", () => {
  const gate = new RequestLimit();
  for (let i = 0; i < 120; i++) assert.equal(gate.consume(0), true);
  for (let i = 0; i < 1000; i++) assert.equal(gate.consume(0), false);
  assert.equal(gate.consume(60_000), true);
});

test("rejection summaries retain exact counts with constant storage", () => {
  const summary = new RejectionSummary();
  for (let i = 0; i < 100_000; i++) summary.add();
  assert.equal(summary.drain(), 100_000);
  assert.equal(summary.drain(), 0);
});

test("retention deletes only expired audit records at the 90 day boundary", async () => {
  const { default: Database } = await import("better-sqlite3");
  const db = new Database(":memory:");
  try {
    const cutoff = auditCutoff(Date.UTC(2026, 10, 8));
    db.exec("CREATE TABLE audit_log (at INTEGER)");
    const insert = db.prepare("INSERT INTO audit_log VALUES (?)");
    for (const at of [cutoff - 1, cutoff, cutoff + 1]) insert.run(at);
    const { maintainAudit } = await import("../../scripts/audit-maintenance.cjs");
    const result = maintainAudit(db, Date.UTC(2026, 10, 8));
    assert.equal(result.removed, 1);
    assert.equal(result.auditRows, 2);
    assert.deepEqual(db.prepare("SELECT at FROM audit_log ORDER BY at").all(), [
      { at: cutoff },
      { at: cutoff + 1 },
    ]);
  } finally {
    db.close();
  }
});

test("burst aggregation bounds writes, preserves count, and survives writer failure", () => {
  const writes: string[] = [];
  let flush: (() => void) | undefined;
  const audit = new RejectionAudit(
    (detail) => {
      writes.push(detail);
    },
    (callback) => {
      flush = callback;
    },
  );
  for (let i = 0; i < 100_000; i++) audit.add();
  assert.equal(writes.length, 1);
  flush!();
  assert.equal(writes.length, 2);
  assert.equal(JSON.parse(writes[1]).rejectedRequests, 100_000);
  audit.add();
  assert.equal(writes.length, 3);
  const broken = new RejectionAudit(
    () => {
      throw new Error("disk full");
    },
    (callback) => {
      flush = callback;
    },
  );
  assert.doesNotThrow(() => broken.add());
  assert.doesNotThrow(() => flush!());
});
