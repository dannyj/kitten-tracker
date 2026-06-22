// Seeds deterministic data for the rev4 e2e: the viewings & adoption workflow.
// A litter of adoptable kittens, plus interested parties at different pipeline
// stages with viewings (past + future) linking them to kittens:
//   - Familie Bakker (+ partner): approved, a past viewing for Pixel + Dot.
//   - Sophie Visser: viewing_booked, a future viewing for Bean.
//   - Tom: withdrew (off-ramp) — hidden by the default active filter.
//   - Familie Klaassen: approved, a past viewing for Dot (shares Dot with
//     Bakker, so once Bakker adopts Dot the double-adopt guard is exercised).
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
  `INSERT INTO kittens (litter_id, name, shelter_number, sex, birth_date, feeding_method, feeding_interval_minutes, status, created_at)
   VALUES (?, ?, ?, ?, ?, 'mother', 120, ?, ?)`,
);
const insHistory = db.prepare(
  "INSERT INTO status_history (kitten_id, status, changed_at, note) VALUES (?, ?, ?, ?)",
);
const insParty = db.prepare(
  `INSERT INTO interested_parties (name, partner_name, phone, email, address, source, status, notes, created_at)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
);
const insViewing = db.prepare(
  "INSERT INTO viewings (interested_party_id, visited_at, location, notes) VALUES (?, ?, ?, ?)",
);
const insVK = db.prepare("INSERT INTO viewing_kittens (viewing_id, kitten_id) VALUES (?, ?)");

db.transaction(() => {
  const mist = insMother.run("Mist", "M-2026-040", isoDaysAgo(70), daysAgo(70)).lastInsertRowid;
  const litter = insLitter.run(mist, isoDaysAgo(56), "rev4 litter").lastInsertRowid;

  function kitten(name, shelter, sex, status) {
    const id = insKitten.run(
      litter,
      name,
      shelter,
      sex,
      isoDaysAgo(56),
      status,
      daysAgo(56),
    ).lastInsertRowid;
    insHistory.run(id, "intake", daysAgo(56), "Registered");
    if (status !== "intake") insHistory.run(id, status, daysAgo(40), null);
    return id;
  }
  const pixel = kitten("Pixel", "K-2026-401", "female", "ready");
  const dot = kitten("Dot", "K-2026-402", "male", "ready");
  const bean = kitten("Bean", "K-2026-403", "female", "in_care");

  // Party A — approved, past viewing for Pixel + Dot.
  const bakker = insParty.run(
    "Familie Bakker",
    "Jan",
    "06 55510100",
    "bakker@example.nl",
    "Kanaalweg 5, Utrecht",
    "shelter listing",
    "approved",
    "Keen, experienced with cats.",
    daysAgo(20),
  ).lastInsertRowid;
  const vA = insViewing.run(
    bakker,
    daysAgo(5),
    "Foster home",
    "Lovely home with a garden; one calm older cat already.",
  ).lastInsertRowid;
  insVK.run(vA, pixel);
  insVK.run(vA, dot);

  // Party B — viewing_booked, future viewing for Bean.
  const sophie = insParty.run(
    "Sophie Visser",
    null,
    "06 55510200",
    "sophie@example.nl",
    null,
    "Instagram",
    "viewing_booked",
    null,
    daysAgo(8),
  ).lastInsertRowid;
  const vB = insViewing.run(sophie, daysAgo(-3), "Shelter", "First visit booked.").lastInsertRowid;
  insVK.run(vB, bean);

  // Party C — withdrew (off-ramp); hidden by the default active filter.
  insParty.run(
    "Tom Pruim",
    null,
    "06 55510300",
    "tom@example.nl",
    null,
    "word of mouth",
    "withdrew",
    "Decided the timing wasn't right.",
    daysAgo(15),
  );

  // Party D — approved, past viewing for Dot (shared with Bakker).
  const klaassen = insParty.run(
    "Familie Klaassen",
    null,
    "06 55510400",
    "klaassen@example.nl",
    "Lindelaan 12, Amersfoort",
    "shelter listing",
    "approved",
    null,
    daysAgo(18),
  ).lastInsertRowid;
  const vD = insViewing.run(klaassen, daysAgo(4), "Shelter", "Interested in Dot.").lastInsertRowid;
  insVK.run(vD, dot);
}).call(null);

console.log("Seeded rev4 data");
