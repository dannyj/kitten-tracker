// Proves migrations 0006 and 0007 preserve existing data, under the EXACT
// conditions prod uses: a connection with foreign_keys=ON, and the migration
// applied inside a single transaction (drizzle's migrator wraps all statements in
// BEGIN/COMMIT, which makes the PRAGMA foreign_keys lines no-ops — so each
// migration must be FK-safe on its own). Run: node scripts/verify-migration.cjs
//
//  - 0006: generalise the medical table to subject_type/subject_id.
//  - 0007: interested_parties + viewings rework (drop loose contact columns, add
//    interested_party_id FK). The backfill must turn each distinct viewing
//    contact tuple into one party and link every viewing, without dropping the
//    viewing_kittens join (which ON DELETE CASCADEs off viewings).
const Database = require("better-sqlite3");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const PRE_0006 = [
  "0000_flaky_maginty",
  "0001_eminent_ghost_rider",
  "0002_overrated_sway",
  "0003_boring_dazzler",
  "0004_public_mysterio",
  "0005_breezy_scarlet_witch",
];

let failures = 0;
const check = (name, ok, extra = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? ` — ${extra}` : ""}`);
  if (!ok) failures++;
};

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "verify-migration."));
const dbPath = path.join(tmp, "kittens.db");

try {
  const db = new Database(dbPath);
  // Mirror src/db/index.ts exactly.
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  // ---- build the pre-0006 schema (autocommit, breakpoints are SQL comments) --
  for (const tag of PRE_0006) {
    db.exec(fs.readFileSync(path.join("drizzle", `${tag}.sql`), "utf8"));
  }

  // ---- seed old-shape kitten medical history, incl. a correction + accents ---
  const mother = db.prepare("INSERT INTO mothers (name, status) VALUES ('Mama', 'in_care')").run()
    .lastInsertRowid;
  const litter = db
    .prepare("INSERT INTO litters (mother_id, birth_date, birth_date_estimated) VALUES (?, '2026-04-01', 0)")
    .run(mother).lastInsertRowid;
  const k1 = db
    .prepare(
      "INSERT INTO kittens (litter_id, name, sex, birth_date, status) VALUES (?, 'Muis', 'female', '2026-04-01', 'in_care')",
    )
    .run(litter).lastInsertRowid;
  const k2 = db
    .prepare(
      "INSERT INTO kittens (litter_id, name, sex, birth_date, status) VALUES (?, 'Pip', 'male', '2026-04-01', 'in_care')",
    )
    .run(litter).lastInsertRowid;

  const insV = db.prepare(
    "INSERT INTO vaccinations (kitten_id, type, given_at, batch_number, administered_by, next_due_date, note, corrects_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
  );
  const orig = insV.run(k1, "FVRCP", "2026-05-01", "FV-77-Ä", "Dr. Groothuis", "2026-05-22", "ï/ë test", null, 1000)
    .lastInsertRowid;
  insV.run(k1, "FVRCP", "2026-05-02", "FV-77-CORRECTED", "Dr. Groothuis", null, "fix", orig, 1001); // correction
  insV.run(k1, "deworming", "2026-04-15", "DW-1", "self", null, null, null, 1002);
  insV.run(k2, "deworming", "2026-04-15", "DW-2", "self", null, null, null, 1003);

  const beforeCount = db.prepare("SELECT COUNT(*) n FROM vaccinations").get().n;
  const beforeByKitten = db
    .prepare("SELECT kitten_id, COUNT(*) n FROM vaccinations GROUP BY kitten_id ORDER BY kitten_id")
    .all();
  const beforeRows = db.prepare("SELECT * FROM vaccinations ORDER BY id").all();

  db.close();

  // ---- apply 0006 the way drizzle's migrator does: one BEGIN/COMMIT txn -------
  const db2 = new Database(dbPath);
  db2.pragma("journal_mode = WAL");
  db2.pragma("foreign_keys = ON"); // prod has FKs ON; PRAGMA inside the txn is a no-op
  const sql0006 = fs.readFileSync(path.join("drizzle", "0006_mother_medical.sql"), "utf8");
  const statements = sql0006.split("--> statement-breakpoint").map((s) => s.trim()).filter(Boolean);
  db2.exec("BEGIN");
  try {
    for (const stmt of statements) db2.exec(stmt);
    db2.exec("COMMIT");
  } catch (e) {
    db2.exec("ROLLBACK");
    throw e;
  }

  // ---- verify nothing was lost or altered ------------------------------------
  const afterCount = db2.prepare("SELECT COUNT(*) n FROM vaccinations").get().n;
  check("vaccination count unchanged", afterCount === beforeCount, `${beforeCount} -> ${afterCount}`);

  const afterRows = db2.prepare("SELECT * FROM vaccinations ORDER BY id").all();
  check(
    "every migrated row is subject_type='kitten' with subject_id = old kitten_id",
    afterRows.every((r, i) => r.subject_type === "kitten" && r.subject_id === beforeRows[i].kitten_id),
  );
  check(
    "scalar fields intact (type/given_at/batch/admin/next_due/note/created_at)",
    afterRows.every(
      (r, i) =>
        r.type === beforeRows[i].type &&
        r.given_at === beforeRows[i].given_at &&
        r.batch_number === beforeRows[i].batch_number &&
        r.administered_by === beforeRows[i].administered_by &&
        r.next_due_date === beforeRows[i].next_due_date &&
        r.note === beforeRows[i].note &&
        r.created_at === beforeRows[i].created_at,
    ),
  );
  check(
    "accents preserved",
    afterRows.some((r) => r.batch_number === "FV-77-Ä" && r.note === "ï/ë test"),
  );
  check(
    "correction's corrects_id reference preserved",
    afterRows.some((r) => r.batch_number === "FV-77-CORRECTED" && r.corrects_id === orig),
  );
  const afterByKitten = db2
    .prepare("SELECT subject_id, COUNT(*) n FROM vaccinations GROUP BY subject_id ORDER BY subject_id")
    .all();
  check(
    "per-subject counts match per-kitten counts",
    JSON.stringify(afterByKitten.map((r) => r.n)) === JSON.stringify(beforeByKitten.map((r) => r.n)),
  );

  // schedule_templates gained subject_type + the composite unique index.
  const stCols = db2.prepare("PRAGMA table_info(schedule_templates)").all().map((c) => c.name);
  check("schedule_templates has subject_type column", stCols.includes("subject_type"));
  const idx = db2.prepare("PRAGMA index_list(schedule_templates)").all().map((i) => i.name);
  check(
    "composite unique index in place, old one gone",
    idx.includes("schedule_templates_subject_type_unique") &&
      !idx.includes("schedule_templates_type_unique"),
  );

  // New inserts work for both subjects (no NOT NULL kitten_id left to trip on).
  const insNew = db2.prepare(
    "INSERT INTO vaccinations (subject_type, subject_id, type, given_at) VALUES (?, ?, ?, ?)",
  );
  let insertOk = true;
  try {
    insNew.run("mother", Number(mother), "microchip", "2026-06-01");
    insNew.run("kitten", Number(k1), "flea treatment", "2026-06-01");
  } catch (e) {
    insertOk = false;
    console.log("  insert error:", e.message);
  }
  check("can insert new mother + kitten medical records", insertOk);

  // ===========================================================================
  // 0007 — interested_parties + viewings rework, applied on top of 0006.
  // ===========================================================================
  // Seed old-shape viewings: a contact shared across two viewings (must dedup to
  // ONE party), and a null-phone contact, each with viewing_kittens rows.
  const insOldViewing = db2.prepare(
    "INSERT INTO viewings (visited_at, visitor_name, phone, email, notes) VALUES (?, ?, ?, ?, ?)",
  );
  const insVK = db2.prepare("INSERT INTO viewing_kittens (viewing_id, kitten_id) VALUES (?, ?)");
  const vA = insOldViewing.run(1000, "Anna de Vries", "06-1111", "anna@x.nl", "keen on Muis").lastInsertRowid;
  const vB = insOldViewing.run(2000, "Anna de Vries", "06-1111", "anna@x.nl", "second visit").lastInsertRowid; // same contact
  const vC = insOldViewing.run(3000, "Bob", null, null, "walk-in").lastInsertRowid; // null phone/email
  insVK.run(vA, k1);
  insVK.run(vB, k2);
  insVK.run(vC, k1);
  insVK.run(vC, k2);

  const vkBefore = db2.prepare("SELECT COUNT(*) n FROM viewing_kittens").get().n;
  const viewingsBefore = db2.prepare("SELECT COUNT(*) n FROM viewings").get().n;
  db2.close();

  const db3 = new Database(dbPath);
  db3.pragma("journal_mode = WAL");
  db3.pragma("foreign_keys = ON");
  const sql0007 = fs.readFileSync(path.join("drizzle", "0007_interested_parties.sql"), "utf8");
  const stmts0007 = sql0007.split("--> statement-breakpoint").map((s) => s.trim()).filter(Boolean);
  db3.exec("BEGIN");
  try {
    for (const stmt of stmts0007) db3.exec(stmt);
    db3.exec("COMMIT");
  } catch (e) {
    db3.exec("ROLLBACK");
    throw e;
  }

  const partyCount = db3.prepare("SELECT COUNT(*) n FROM interested_parties").get().n;
  check("one party per distinct contact tuple (2 from 3 viewings)", partyCount === 2, `got ${partyCount}`);

  const viewingsAfter = db3.prepare("SELECT COUNT(*) n FROM viewings").get().n;
  check("viewings not lost", viewingsAfter === viewingsBefore, `${viewingsBefore} -> ${viewingsAfter}`);

  const unlinked = db3.prepare("SELECT COUNT(*) n FROM viewings WHERE interested_party_id IS NULL").get().n;
  check("every viewing linked to a party", unlinked === 0, `${unlinked} unlinked`);

  const vRows = db3.prepare("SELECT id, interested_party_id FROM viewings ORDER BY id").all();
  const byId = Object.fromEntries(vRows.map((r) => [r.id, r.interested_party_id]));
  check(
    "shared contact maps both viewings to the same party",
    byId[vA] === byId[vB] && byId[vA] !== byId[vC],
  );

  const annaParty = db3
    .prepare("SELECT * FROM interested_parties WHERE name = 'Anna de Vries'")
    .get();
  check(
    "party carries the migrated contact details",
    annaParty && annaParty.phone === "06-1111" && annaParty.email === "anna@x.nl" && annaParty.status === "enquired",
  );

  const vkAfter = db3.prepare("SELECT COUNT(*) n FROM viewing_kittens").get().n;
  check("viewing_kittens rows survived (not cascade-wiped)", vkAfter === vkBefore, `${vkBefore} -> ${vkAfter}`);

  const vCols = db3.prepare("PRAGMA table_info(viewings)").all().map((c) => c.name);
  check(
    "old contact columns dropped, new columns present",
    !vCols.includes("visitor_name") &&
      !vCols.includes("phone") &&
      !vCols.includes("email") &&
      vCols.includes("interested_party_id") &&
      vCols.includes("location"),
  );

  // New-shape inserts work end-to-end.
  let viewingInsertOk = true;
  try {
    const p = db3
      .prepare("INSERT INTO interested_parties (name, status) VALUES ('Carla', 'enquired')")
      .run().lastInsertRowid;
    const newV = db3
      .prepare("INSERT INTO viewings (interested_party_id, visited_at, location, notes) VALUES (?, 4000, 'Shelter', 'note')")
      .run(p).lastInsertRowid;
    db3.prepare("INSERT INTO viewing_kittens (viewing_id, kitten_id) VALUES (?, ?)").run(newV, k1);
  } catch (e) {
    viewingInsertOk = false;
    console.log("  insert error:", e.message);
  }
  check("can insert a new party + viewing + viewing_kitten", viewingInsertOk);

  db3.close();
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}

console.log(failures === 0 ? "\nMIGRATION OK" : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
