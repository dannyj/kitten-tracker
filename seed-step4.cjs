// Seeds deterministic data for the step-4 e2e: hand-feeding states (overdue,
// upcoming, no-feeds, not-hand-fed) plus weights for intake targets.
const Database = require("better-sqlite3");

const db = new Database(process.env.DATABASE_PATH || "./data/kittens.db");

const nowSec = Math.floor(Date.now() / 1000);
const minutesAgo = (m) => nowSec - Math.round(m * 60);
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
  `INSERT INTO kittens (litter_id, name, shelter_number, sex, birth_date, hand_feeding, feeding_interval_minutes, status, created_at)
   VALUES (?, ?, ?, 'unknown', ?, ?, ?, 'in_care', ?)`,
);
const insHistory = db.prepare(
  "INSERT INTO status_history (kitten_id, status, changed_at, note) VALUES (?, ?, ?, ?)",
);
const insWeight = db.prepare(
  "INSERT INTO weight_entries (kitten_id, weighed_at, weight_grams, note, created_at) VALUES (?, ?, ?, NULL, ?)",
);
const insFeed = db.prepare(
  "INSERT INTO feedings (kitten_id, fed_at, amount_ml, formula, quality, note, created_at) VALUES (?, ?, ?, ?, ?, NULL, ?)",
);

function kitten(litterId, name, shelter, { handFed, interval = 120, weights = [], feeds = [] }) {
  const id = insKitten.run(
    litterId,
    name,
    shelter,
    isoDaysAgo(18),
    handFed ? 1 : 0,
    interval,
    daysAgo(18),
  ).lastInsertRowid;
  insHistory.run(id, "intake", daysAgo(18), "Registered");
  for (const [at, g] of weights) insWeight.run(id, at, g, at);
  for (const [at, ml, formula, quality] of feeds) insFeed.run(id, at, ml, formula, quality, at);
  return id;
}

db.transaction(() => {
  const mama = insMother.run("Mama", nowSec).lastInsertRowid;
  const litter = insLitter.run(mama, isoDaysAgo(18), "feeding litter").lastInsertRowid;

  // Overdue: last feed 150 min ago, interval 120 -> overdue by ~30 min. Has weight.
  kitten(litter, "Hidde", "F-OVERDUE", {
    handFed: true,
    interval: 120,
    weights: [[hoursAgo(10), 90]],
    feeds: [
      [minutesAgo(390), 8, "KMR", "good"],
      [minutesAgo(270), 7.5, "KMR", "good"],
      [minutesAgo(150), 8, "KMR", "slow"],
    ],
  });

  // Upcoming: last feed 30 min ago, interval 180 -> due in ~150 min. No weight (nudge).
  kitten(litter, "Mauw", "F-UPCOMING", {
    handFed: true,
    interval: 180,
    feeds: [[minutesAgo(30), 8, "KMR", "good"]],
  });

  // Hand-fed, no feeds yet -> empty state.
  kitten(litter, "Bonk", "F-NOFEEDS", { handFed: true, interval: 120 });

  // Not hand-fed -> feeding section hidden.
  kitten(litter, "Stil", "F-NOTHANDFED", { handFed: false });
}).call(null);

console.log("Seeded step-4 data");
