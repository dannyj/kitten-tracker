// Seeds deterministic data for the step-3 e2e: alert states + a litter for the
// overview chart and weigh-in flow. Run against a fresh DB before the e2e.
const Database = require("better-sqlite3");

const dbPath = process.env.DATABASE_PATH || "./data/kittens.db";
const db = new Database(dbPath);

const nowSec = Math.floor(Date.now() / 1000);
const hoursAgo = (h) => nowSec - Math.round(h * 3600);
const daysAgo = (d) => nowSec - Math.round(d * 86400);
const isoDaysAgo = (d) => new Date(Date.now() - d * 86400000).toISOString().slice(0, 10);

const insMother = db.prepare(
  "INSERT INTO mothers (name, status, created_at) VALUES (?, 'in_care', ?)",
);
const insLitter = db.prepare(
  "INSERT INTO litters (mother_id, birth_date, birth_date_estimated, notes) VALUES (?, ?, 0, ?)",
);
const insKitten = db.prepare(
  `INSERT INTO kittens (litter_id, name, shelter_number, sex, birth_date, feeding_method, feeding_interval_minutes, status, created_at)
   VALUES (?, ?, ?, 'unknown', ?, 'mother', 120, ?, ?)`,
);
const insHistory = db.prepare(
  "INSERT INTO status_history (kitten_id, status, changed_at, note) VALUES (?, ?, ?, ?)",
);
const insWeight = db.prepare(
  "INSERT INTO weight_entries (kitten_id, weighed_at, weight_grams, note, created_at) VALUES (?, ?, ?, NULL, ?)",
);

function kitten(litterId, name, shelter, status, birthDaysAgo, weights) {
  const id = insKitten.run(
    litterId,
    name,
    shelter,
    isoDaysAgo(birthDaysAgo),
    status,
    daysAgo(birthDaysAgo),
  ).lastInsertRowid;
  insHistory.run(id, "intake", daysAgo(birthDaysAgo), "Registered");
  if (status !== "intake" && status !== "in_care") {
    insHistory.run(id, status, hoursAgo(1), null);
  }
  for (const [hAgo, grams] of weights) {
    const at = hoursAgo(hAgo);
    insWeight.run(id, at, grams, at); // createdAt = weighedAt -> locked (seeded)
  }
  return id;
}

const tx = db.transaction(() => {
  // --- Litter A: alert states ---
  const saar = insMother.run("Saar", nowSec).lastInsertRowid;
  const litterA = insLitter.run(saar, isoDaysAgo(20), "alert-state litter").lastInsertRowid;

  // OK: ~10.9 g/day (180 -> 200 across 44h). Kept inside the 48h window so it
  // doesn't collapse to a single point as time elapses after seeding.
  kitten(litterA, "Okkie", "K-OK", "in_care", 20, [
    [44, 180],
    [0, 200],
  ]);
  // Warning: ~3 g/day, net positive over 24h, no >=5% dip
  kitten(litterA, "Pip", "K-WARN", "in_care", 20, [
    [48, 200],
    [24, 203],
    [0, 206],
  ]);
  // Urgent (loss): last weighing drops >5% (210 -> 196 = -6.7%)
  kitten(litterA, "Bram", "K-LOSS", "in_care", 20, [
    [48, 205],
    [24, 210],
    [0, 196],
  ]);
  // Urgent (no gain over 24h): net <= 0 across >=24h, no single >=5% dip
  kitten(litterA, "Fleur", "K-NOGAIN", "in_care", 20, [
    [36, 210],
    [24, 209],
    [0, 208],
  ]);
  // Insufficient: a single weighing
  kitten(litterA, "Stip", "K-INSUF", "in_care", 20, [[2, 180]]);
  // Excluded: adopted, with data that would otherwise be urgent
  kitten(litterA, "Weg", "K-ADOPT", "adopted", 40, [
    [48, 300],
    [0, 270],
  ]);
  // Excluded: deceased, with data that would otherwise be urgent
  kitten(litterA, "Mortje", "K-DEC", "deceased", 20, [
    [48, 150],
    [0, 140],
  ]);
  // Active, no weights — used for quick-add / edit / delete window in the UI
  kitten(litterA, "Vlek", "K-FRESH", "in_care", 10, []);

  // --- Litter B: overview chart + weigh-in flow (orphan) ---
  const litterB = insLitter.run(null, isoDaysAgo(15), "overview litter").lastInsertRowid;
  // Three healthy siblings gaining ~12 g/day from ~120g
  for (const [name, shelter, start] of [
    ["Een", "B-1", 120],
    ["Twee", "B-2", 125],
    ["Drie", "B-3", 118],
  ]) {
    kitten(litterB, name, shelter, "in_care", 15, [
      [96, start],
      [72, start + 12],
      [48, start + 24],
      [24, start + 36],
      [0, start + 48],
    ]);
  }
  // Vier: deliberately underweight / lagging (lowest line)
  kitten(litterB, "Vier", "B-4", "in_care", 15, [
    [96, 100],
    [72, 104],
    [48, 108],
    [24, 112],
    [0, 116],
  ]);
});

tx();
console.log("Seeded step-3 data into", dbPath);
