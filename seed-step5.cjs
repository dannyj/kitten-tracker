// Seeds deterministic data for the step-5 e2e: medical history (incl. a locked
// entry and accent chars), schedule due/overdue states, weights for growth
// summary, and an adopted kitten with adopter PII for the export opt-in.
const Database = require("better-sqlite3");

const db = new Database(process.env.DATABASE_PATH || "./data/kittens.db");

const nowSec = Math.floor(Date.now() / 1000);
const daysAgo = (d) => nowSec - Math.round(d * 86400);
const isoDaysAgo = (d) => new Date(Date.now() - d * 86400000).toISOString().slice(0, 10);

const insMother = db.prepare(
  "INSERT INTO mothers (name, status, created_at) VALUES (?, 'in_care', ?)",
);
const insLitter = db.prepare(
  "INSERT INTO litters (mother_id, birth_date, birth_date_estimated, notes) VALUES (?, ?, 0, ?)",
);
const insKitten = db.prepare(
  `INSERT INTO kittens (litter_id, name, shelter_number, sex, birth_date, hand_feeding, feeding_interval_minutes, status, created_at)
   VALUES (?, ?, ?, ?, ?, 0, 120, ?, ?)`,
);
const insHistory = db.prepare(
  "INSERT INTO status_history (kitten_id, status, changed_at, note) VALUES (?, ?, ?, ?)",
);
const insWeight = db.prepare(
  "INSERT INTO weight_entries (kitten_id, weighed_at, weight_grams, note, created_at) VALUES (?, ?, ?, NULL, ?)",
);
const insVacc = db.prepare(
  `INSERT INTO vaccinations (kitten_id, type, given_at, batch_number, administered_by, next_due_date, note, corrects_id, created_at)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
);
const insAdopter = db.prepare(
  `INSERT INTO adopters (kitten_id, name, phone, email, address, adoption_date, shelter_reference, note)
   VALUES (?, ?, ?, ?, ?, ?, ?, NULL)`,
);

db.transaction(() => {
  const mama = insMother.run("Mama", nowSec).lastInsertRowid;
  const litter = insLitter.run(mama, isoDaysAgo(63), "medical litter").lastInsertRowid; // 9 weeks old

  // Muis: 9wk, has weights + a locked FVRCP (with accents in administered_by),
  // 1 deworming given -> deworming overdue (2,4,6,8wk milestones), FVRCP next ~10wk.
  const muis = insKitten.run(
    litter,
    "Muis",
    "K-2026-001",
    "female",
    isoDaysAgo(63),
    "in_care",
    daysAgo(63),
  ).lastInsertRowid;
  insHistory.run(muis, "intake", daysAgo(63), "Registered");
  insWeight.run(muis, daysAgo(63), 110, daysAgo(63));
  insWeight.run(muis, daysAgo(0), 640, daysAgo(0));
  // Locked FVRCP given 5 days ago (created 5 days ago -> outside 15-min window)
  insVacc.run(
    muis,
    "FVRCP",
    isoDaysAgo(5),
    "FV-77-Ä",
    "Dr. Groothuis (Kliniek Zuid)",
    isoDaysAgo(-16),
    "First FVRCP — kitten tolerated it well; recheck noted as ï/ë test.",
    null,
    daysAgo(5),
  );
  // One deworming at 2wk; next deworming (4wk) overdue at 9wk
  insVacc.run(muis, "deworming", isoDaysAgo(49), "DW-12", "self", null, null, null, daysAgo(49));

  // Pip: 9wk, no vaccinations at all -> deworming + FVRCP overdue. No weights.
  const pip = insKitten.run(
    litter,
    "Pip",
    "K-2026-002",
    "male",
    isoDaysAgo(63),
    "in_care",
    daysAgo(63),
  ).lastInsertRowid;
  insHistory.run(pip, "intake", daysAgo(63), "Registered");

  // Bram: adopted, with adopter PII (for export opt-in test). Some weights.
  const bram = insKitten.run(
    litter,
    "Bram",
    "K-2026-003",
    "male",
    isoDaysAgo(63),
    "adopted",
    daysAgo(63),
  ).lastInsertRowid;
  insHistory.run(bram, "intake", daysAgo(63), "Registered");
  insHistory.run(bram, "adopted", daysAgo(2), null);
  insWeight.run(bram, daysAgo(40), 300, daysAgo(40));
  insWeight.run(bram, daysAgo(0), 700, daysAgo(0));
  insVacc.run(
    bram,
    "FVRCP",
    isoDaysAgo(10),
    "FV-80",
    "Dr. Groothuis",
    isoDaysAgo(-11),
    null,
    null,
    daysAgo(10),
  );
  insAdopter.run(
    bram,
    "Familie de Wit",
    "06 12345678",
    "dewit@example.nl",
    "Kerkstraat 12, Utrecht",
    isoDaysAgo(2),
    "REF-9001",
  );
}).call(null);

console.log("Seeded step-5 data");
