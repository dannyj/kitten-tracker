#!/usr/bin/env node
// Run daily in the app container. Only metadata is printed, never audit contents.
function maintainAudit(db, now = Date.now()) {
  const cutoff = Math.floor(now / 1000) - 90 * 86400;
  const removed = db.prepare("DELETE FROM audit_log WHERE at < ?").run(cutoff).changes;
  const rows = db.prepare("SELECT count(*) AS count FROM audit_log").get().count;
  const bytes =
    db.pragma("page_count", { simple: true }) * db.pragma("page_size", { simple: true });
  const freeBytes =
    db.pragma("freelist_count", { simple: true }) * db.pragma("page_size", { simple: true });
  return { removed, auditRows: rows, databaseBytes: bytes, reusableBytes: freeBytes };
}
module.exports = { maintainAudit };
if (require.main === module) {
  const Database = require("better-sqlite3");
  const db = new Database(process.env.DATABASE_PATH || "./data/kittens.db");
  try {
    const result = maintainAudit(db);
    console.log(JSON.stringify(result));
    // Alert through the scheduler on a 1 GiB database or one million audit rows.
    if (result.databaseBytes >= 1024 ** 3 || result.auditRows >= 1_000_000) process.exitCode = 1;
  } finally {
    db.close();
  }
}
