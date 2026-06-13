# Claude Code Handoff — Kitten Tracker, Step 2: Mothers, Litters & Kittens

## Objective

Build the core record-keeping: CRUD for mothers, litters, and kittens, plus the foster status pipeline with full audit trail. "Done" means: I can register a mother, create her litter, add each kitten with shelter number and birth date, see calculated ages everywhere, log health notes on the mother, and move kittens through statuses — with every change recorded in history.

## Prerequisites

Step 1 complete and deployed: auth works, schema migrated, app shell with nav exists. This step fills in the Kittens and Mothers nav sections. Do not modify the schema except via new migrations, and only if a genuine gap is found (flag it in the summary if so).

## Tasks

### 1. Mothers

- List page: cards/table with name, shelter number, status, litter count, latest health log date
- Create/edit form: name, shelter number, intake date, behaviour notes (textarea), status
- Detail page with three sections:
  - Profile + behaviour notes
  - **Health log**: dated entries with category (eating | behaviour | medical | other), newest first, quick-add form inline at the top. Entries are append-only — editable for 15 minutes after creation (typo window), then locked; corrections become new entries.
  - **Litters & kittens**: linked litters with their kittens, each showing name, age, status
- No photo upload yet (step 6) — leave a placeholder slot in the layout

### 2. Litters

- Created from a mother's detail page ("Add litter") or standalone for orphan litters (mother = none)
- Fields: birth date, `birth_date_estimated` checkbox, notes
- A litter view showing all kittens with status at a glance; this can live inside the mother detail page rather than a separate top-level nav item

### 3. Kittens

- List page: all kittens, filterable by status and litter, default filter = active (not adopted/returned/deceased). Each row: name, shelter number, sex, **age (auto-calculated, "3w 2d" format)**, status badge, hand-feeding icon if enabled
- Create form (from a litter or standalone): name, shelter number (validated unique, clear error if taken), sex, color/markings, birth date (pre-filled from litter, overridable), hand-feeding toggle, feeding interval (visible only when hand-feeding on, default 120 min)
- Detail page:
  - Header: name, shelter number, age, status badge, hand-feeding indicator
  - Profile section (editable)
  - **Status history timeline** (read-only, from `status_history`)
  - Placeholder sections for weights, feedings, vaccinations, photos (steps 3–6) — visible but marked "coming soon" so the page structure is final now

### 4. Status pipeline

- Status changes via an explicit control on the kitten detail page (not a free dropdown in the edit form)
- Allowed transitions: intake → in_care → ready → adopted; in_care/ready → returned; any → deceased. Backwards moves (e.g. ready → in_care) allowed with a required note.
- Every change writes a `status_history` row (status, changed_at, optional note)
- Choosing **adopted** opens a dialog requiring adopter details: name, phone, email, address, adoption date (default today), shelter reference, note → writes to `adopters`
- Adopted kittens show adopter info on their detail page (visible to admin role only)
- Age display stops advancing for deceased kittens (show age at date of death = last status change)

### 5. Dutch-friendly details

- Dates displayed as dd-mm-yyyy throughout; date inputs use the browser-native picker
- Phone field accepts and stores `+31`/`06` formats without forcing a mask; light validation only (don't reject valid input)

### 6. Validation & security (carried forward)

- Every mutation: Zod schema, server-side, before DB
- Authorization check on every server action (session required; adopter PII routes admin-only)
- IDs in URLs are validated; unknown IDs → 404, not errors

## Acceptance criteria

1. Full flow works end-to-end: create mother → litter (birth date) → 4 kittens → ages display correctly and match birth date math
2. Duplicate shelter number is rejected with a readable error, form state preserved
3. Orphan litter (no mother) can be created and kittens added to it
4. Status pipeline enforces transitions; backwards move without a note is rejected; every change appears in the kitten's history timeline
5. Marking a kitten adopted without completing adopter details is impossible; adopter info appears on detail page afterwards
6. Mother health log: entries can be added, are ordered newest-first, and cannot be edited after the 15-minute window
7. Kitten list default filter hides adopted/returned/deceased; filters work
8. All forms usable on a phone-width viewport (test at 390px)
9. TypeScript strict + lint pass; no new high/critical in `npm audit`

## Out of scope

Weights/charts/alerts (step 3), feeding logs (step 4), vaccinations (step 5), photos/EXIF (step 6), viewings (step 7), exports, internet exposure.

## Reference

- Project plan: `kitten-tracker-plan.md`
- Step 1 handoff: `kitten-tracker-step1-handoff.md`
