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
//  - 0008: replace the kittens.hand_feeding boolean with a feeding_method enum
//    (mother|hand|weaned). It ALTERs in place (kittens has cascading children),
//    so the hand-fed rows must backfill to 'hand', everything else to 'mother',
//    and child rows (weight_entries/feedings) must survive untouched.
//  - 0009: add the kitten_care_logs table (purely additive CREATE TABLE). No
//    data transform, so this just proves it applies under FKs-ON in one txn,
//    leaves kittens untouched, accepts inserts, and cascades on kitten delete.
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

  // ===========================================================================
  // 0008 — feeding_method enum replacing hand_feeding, applied on top of 0007.
  // ===========================================================================
  // Seed a hand-fed kitten (must backfill to 'hand') and give it a weight entry
  // (a cascading child that must survive the in-place ALTER). k1/k2 default to
  // hand_feeding=0 and must become 'mother'.
  const handKitten = db3
    .prepare(
      "INSERT INTO kittens (litter_id, name, sex, birth_date, hand_feeding, feeding_interval_minutes, status) VALUES (?, 'Bottle', 'unknown', '2026-04-01', 1, 90, 'in_care')",
    )
    .run(litter).lastInsertRowid;
  db3
    .prepare("INSERT INTO weight_entries (kitten_id, weight_grams) VALUES (?, 95)")
    .run(handKitten);

  const kittensBefore = db3.prepare("SELECT COUNT(*) n FROM kittens").get().n;
  const weightsBefore = db3.prepare("SELECT COUNT(*) n FROM weight_entries").get().n;
  db3.close();

  const db4 = new Database(dbPath);
  db4.pragma("journal_mode = WAL");
  db4.pragma("foreign_keys = ON");
  const sql0008 = fs.readFileSync(path.join("drizzle", "0008_feeding_method.sql"), "utf8");
  const stmts0008 = sql0008.split("--> statement-breakpoint").map((s) => s.trim()).filter(Boolean);
  db4.exec("BEGIN");
  try {
    for (const stmt of stmts0008) db4.exec(stmt);
    db4.exec("COMMIT");
  } catch (e) {
    db4.exec("ROLLBACK");
    throw e;
  }

  const kCols = db4.prepare("PRAGMA table_info(kittens)").all().map((c) => c.name);
  check(
    "hand_feeding dropped, feeding_method added",
    !kCols.includes("hand_feeding") && kCols.includes("feeding_method"),
  );

  const kittensAfter = db4.prepare("SELECT COUNT(*) n FROM kittens").get().n;
  check("kitten count unchanged", kittensAfter === kittensBefore, `${kittensBefore} -> ${kittensAfter}`);
  const weightsAfter = db4.prepare("SELECT COUNT(*) n FROM weight_entries").get().n;
  check(
    "weight_entries (cascading child) survived the in-place ALTER",
    weightsAfter === weightsBefore,
    `${weightsBefore} -> ${weightsAfter}`,
  );

  const handRow = db4.prepare("SELECT feeding_method FROM kittens WHERE id = ?").get(handKitten);
  check("hand-fed kitten backfilled to 'hand'", handRow.feeding_method === "hand", handRow.feeding_method);
  const motherRows = db4
    .prepare("SELECT feeding_method FROM kittens WHERE id IN (?, ?)")
    .all(k1, k2);
  check(
    "non-hand-fed kittens backfilled to 'mother'",
    motherRows.every((r) => r.feeding_method === "mother"),
  );

  let weanedInsertOk = true;
  try {
    db4
      .prepare(
        "INSERT INTO kittens (litter_id, name, sex, feeding_method, status) VALUES (?, 'Solid', 'unknown', 'weaned', 'in_care')",
      )
      .run(litter);
  } catch (e) {
    weanedInsertOk = false;
    console.log("  insert error:", e.message);
  }
  check("can insert a kitten with feeding_method='weaned'", weanedInsertOk);

  // ===========================================================================
  // 0009 — add kitten_care_logs, applied on top of 0008.
  // ===========================================================================
  const kittensBefore9 = db4.prepare("SELECT COUNT(*) n FROM kittens").get().n;
  db4.close();

  const db5 = new Database(dbPath);
  db5.pragma("journal_mode = WAL");
  db5.pragma("foreign_keys = ON");
  const sql0009 = fs.readFileSync(path.join("drizzle", "0009_kitten_care_log.sql"), "utf8");
  const stmts0009 = sql0009.split("--> statement-breakpoint").map((s) => s.trim()).filter(Boolean);
  db5.exec("BEGIN");
  try {
    for (const stmt of stmts0009) db5.exec(stmt);
    db5.exec("COMMIT");
  } catch (e) {
    db5.exec("ROLLBACK");
    throw e;
  }

  const careTable = db5
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='kitten_care_logs'")
    .get();
  check("kitten_care_logs table created", !!careTable);
  const kittensAfter9 = db5.prepare("SELECT COUNT(*) n FROM kittens").get().n;
  check("kitten count unchanged by additive migration", kittensAfter9 === kittensBefore9, `${kittensBefore9} -> ${kittensAfter9}`);

  // Insert works, default category applies, and the FK cascades on kitten delete.
  let careInsertOk = true;
  let cascadeOk = false;
  try {
    const throwaway = db5
      .prepare("INSERT INTO kittens (litter_id, name, sex, feeding_method, status) VALUES (?, 'Temp', 'unknown', 'mother', 'in_care')")
      .run(litter).lastInsertRowid;
    db5
      .prepare("INSERT INTO kitten_care_logs (kitten_id, category, entry) VALUES (?, 'milestone', 'Eyes opened')")
      .run(k1);
    db5
      .prepare("INSERT INTO kitten_care_logs (kitten_id, entry) VALUES (?, 'Default category')")
      .run(throwaway);
    const def = db5
      .prepare("SELECT category FROM kitten_care_logs WHERE kitten_id = ?")
      .get(throwaway);
    careInsertOk = def && def.category === "other";
    db5.prepare("DELETE FROM kittens WHERE id = ?").run(throwaway);
    const orphans = db5
      .prepare("SELECT COUNT(*) n FROM kitten_care_logs WHERE kitten_id = ?")
      .get(throwaway).n;
    cascadeOk = orphans === 0;
  } catch (e) {
    careInsertOk = false;
    console.log("  insert error:", e.message);
  }
  check("care log inserts, default category 'other' applies", careInsertOk);
  check("care logs cascade-delete with their kitten", cascadeOk);

  db5.close();
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}

console.log(failures === 0 ? "\nMIGRATION OK" : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
