// Seeds a kitten (with birth date) and a mother for the step-6 photo e2e.
const Database = require("better-sqlite3");
const db = new Database(process.env.DATABASE_PATH || "./data/kittens.db");

const nowSec = Math.floor(Date.now() / 1000);
const daysAgo = (d) => nowSec - Math.round(d * 86400);

const mama = db
  .prepare("INSERT INTO mothers (name, status, created_at) VALUES ('Mama', 'in_care', ?)")
  .run(nowSec).lastInsertRowid;
const litter = db
  .prepare(
    "INSERT INTO litters (mother_id, birth_date, birth_date_estimated, notes) VALUES (?, '2026-05-01', 0, 'photo litter')",
  )
  .run(mama).lastInsertRowid;

// Birth 2026-05-01; an EXIF photo dated 2026-05-20 => age 2w 5d.
const muis = db
  .prepare(
    `INSERT INTO kittens (litter_id, name, shelter_number, sex, birth_date, feeding_method, feeding_interval_minutes, status, created_at)
     VALUES (?, 'Muis', 'K-2026-001', 'female', '2026-05-01', 'mother', 120, 'in_care', ?)`,
  )
  .run(litter, daysAgo(43)).lastInsertRowid;
db.prepare(
  "INSERT INTO status_history (kitten_id, status, changed_at, note) VALUES (?, 'intake', ?, 'Registered')",
).run(muis, daysAgo(43));

console.log("Seeded step-6 data");
