// Seeds deterministic data for the rev3 e2e: a mother (queen) with structured
// medical records — a one-off microchip (never "due"), an overdue deworming, an
// upcoming FVRCP booster (accents in the note), plus a free-text health-log
// entry — and a litter with one kitten so the per-litter export shows the
// mother's own section alongside the kitten. New subject-keyed shape only.
const Database = require("better-sqlite3");

const db = new Database(process.env.DATABASE_PATH || "./data/kittens.db");

const nowSec = Math.floor(Date.now() / 1000);
const daysAgo = (d) => nowSec - Math.round(d * 86400);
const isoDaysAgo = (d) => new Date(Date.now() - d * 86400000).toISOString().slice(0, 10);

const insMother = db.prepare(
  "INSERT INTO mothers (name, shelter_number, intake_date, status, created_at) VALUES (?, ?, ?, 'in_care', ?)",
);
const insLitter = db.prepare(
  "INSERT INTO litters (mother_id, birth_date, birth_date_estimated, notes) VALUES (?, ?, 0, ?)",
);
const insKitten = db.prepare(
  `INSERT INTO kittens (litter_id, name, shelter_number, sex, birth_date, hand_feeding, feeding_interval_minutes, status, created_at)
   VALUES (?, ?, ?, ?, ?, 0, 120, 'in_care', ?)`,
);
const insHistory = db.prepare(
  "INSERT INTO status_history (kitten_id, status, changed_at, note) VALUES (?, 'intake', ?, 'Registered')",
);
const insLog = db.prepare(
  "INSERT INTO mother_health_logs (mother_id, logged_at, category, entry) VALUES (?, ?, ?, ?)",
);
const insMed = db.prepare(
  `INSERT INTO vaccinations (subject_type, subject_id, type, given_at, batch_number, administered_by, next_due_date, note, corrects_id, created_at)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
);

db.transaction(() => {
  const luna = insMother.run("Luna", "M-2026-001", isoDaysAgo(210), daysAgo(210)).lastInsertRowid;

  // Microchip: one-off (no next_due_date) -> must never show as "due". Locked.
  insMed.run(
    "mother",
    luna,
    "microchip",
    isoDaysAgo(200),
    "CHIP-528140004012345",
    "Dr. Visser (Kliniek Noord)",
    null,
    "Microchip implanted at intake.",
    null,
    daysAgo(200),
  );
  // Deworming: next due 8 days ago -> OVERDUE. Locked.
  insMed.run(
    "mother",
    luna,
    "deworming",
    isoDaysAgo(100),
    "DW-AD-7",
    "self",
    isoDaysAgo(8),
    null,
    null,
    daysAgo(100),
  );
  // FVRCP booster: next due in 4 days -> upcoming (within the 7-day window).
  // Accents in the note exercise WinAnsi handling in the export. Locked.
  insMed.run(
    "mother",
    luna,
    "FVRCP",
    isoDaysAgo(30),
    "FV-AD-9",
    "Kliniek Noord",
    isoDaysAgo(-4),
    "Jaarlijkse booster — verdraagt het goed (ë/ï).",
    null,
    daysAgo(30),
  );

  insLog.run(luna, daysAgo(1), "eating", "Eet goed en zoogt alle kittens rustig.");

  // Litter + one kitten so per-litter export carries the mother's section too.
  const litter = insLitter.run(luna, isoDaysAgo(35), "rev3 litter").lastInsertRowid;
  const saar = insKitten.run(
    litter,
    "Saar",
    "K-2026-201",
    "female",
    isoDaysAgo(35),
    daysAgo(35),
  ).lastInsertRowid;
  insHistory.run(saar, daysAgo(35));
  insMed.run(
    "kitten",
    saar,
    "deworming",
    isoDaysAgo(21),
    "DW-K-3",
    "self",
    null,
    null,
    null,
    daysAgo(21),
  );
}).call(null);

console.log("Seeded rev3 data");
