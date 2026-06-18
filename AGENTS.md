<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

<!-- END:nextjs-agent-rules -->

# Test against prod-parity before deploying

Production is a Docker standalone build on the Ubuntu host at **192.168.80.125**
(`docker compose up -d --build`; full runbook in [README.md](README.md#deploy-19216880125)).
It serves real foster data, including adopter PII.

**Do not deploy a change to 192.168.80.125 without first verifying it against a
prod-parity build locally.** Plain `next dev` hides a whole class of bugs because
it runs the server and browser in the same timezone — that is exactly how the
datetime-local "can't be in the future" regression shipped.

Run before any deploy:

```bash
./verify-prod.sh all   # standalone build, server in UTC, browser in a non-UTC zone
```

It builds the standalone output (same as the container), boots it in UTC, drives
the e2e suite with the browser in another zone, and uses **synthetic** seed data
in a throwaway DB — never the production database. Green there, then deploy.

Conventions this enforces, which any change should preserve:

- **Never copy prod data into a test/staging environment** — it holds PII. Use
  the `seed-step*.cjs` synthetic seeds.
- **Parity over persistence:** match production's _config_ (the standalone image,
  `TZ=UTC`, env) rather than standing up a long-lived second server. Anything
  timezone-, locale-, or env-sensitive must be exercised under that config.
- New time-bearing inputs or server actions need an e2e that runs under
  `verify-prod.sh` (server/browser timezones differ), or the regression is invisible.
- A new e2e target = a `seed-<target>.cjs` (or reuse one) + an `e2e-<target>.mjs`,
  both registered in `verify-prod.sh` (`seed_for` + `ALL_TARGETS`). `rev3` is the
  mother-medical suite; `step5` is the kitten-medical suite.

# Schema, migrations, and seeds

Drizzle ORM over better-sqlite3. The connection runs with `foreign_keys = ON`
(`src/db/index.ts`), and drizzle's migrator wraps **all** statements of a
migration in one `BEGIN…COMMIT`. SQLite ignores `PRAGMA foreign_keys` inside a
transaction, so the `PRAGMA foreign_keys=OFF` lines drizzle emits are **no-ops at
runtime** — FK enforcement stays ON through the whole migration.

- **Table-recreation migrations must be FK-safe under enforced FKs.** Dropping a
  table that anything still references (including a self-FK on the `__new_…`
  copy) raises a constraint violation mid-migration. The fix used for the medical
  table: the recreated table carries **no foreign keys at all** (the subject
  model below is already FK-less), so the `DROP`/`RENAME` is safe.
- **Hand-write structural migrations.** `drizzle-kit generate` prompts
  interactively for column renames/restructures (can't run here) and won't
  backfill a renamed/derived column, so it can't produce a data-preserving
  migration on its own. When you hand-write a `drizzle/NNNN_*.sql`, also append
  the journal entry (`drizzle/meta/_journal.json`) and write the matching
  `drizzle/meta/NNNN_snapshot.json`, or the next `drizzle-kit generate` diffs
  against stale state. The runtime migrator only reads the journal + `.sql`.
- **Prove data-preserving migrations before deploying.** `scripts/verify-migration.cjs`
  builds the pre-migration schema, seeds old-shape rows, applies the new
  migration _the way the migrator does_ (one txn, FKs ON), and asserts counts +
  references survive. Extend it for any future destructive/restructuring migration.
- **Seeds (`seed-*.cjs`) issue raw SQL and break silently when a column changes** —
  `verify-prod.sh` surfaces it as a `SQLITE_ERROR` during the seed step, not an
  obvious test failure. Update every seed that touches a changed table.

# Medical records are subject-keyed (kittens _and_ mothers)

The `vaccinations` table keeps its name for history but now holds structured
medical/treatment records for **both** subjects via `subject_type`
(`kitten`|`mother`) + `subject_id` — the same FK-less subject pattern as
`photos` (no DB-level FK; subject existence is checked in the server actions).
`corrects_id` is a plain column (append-only correction flow), not a DB FK.

- `schedule_templates` are also keyed by `subject_type` (composite unique with
  `vaccine_type`, since `deworming`/`flea`/`FVRCP` exist for both). Kitten
  templates are birth-date driven (`first/every/until` weeks); adult-cat
  templates are **record driven** — only `everyWeeks` matters and `0` means
  one-off (never auto-due). `getScheduleTemplates(subjectType)` filters.
- Mother "due" is computed from the latest record per type's `next_due_date`
  (`motherDueBySubject` in `src/lib/medical-data.ts`), not from birth milestones.
- The medical UI (`MedicalCard`, `VaccinationQuickAdd`), actions
  (`vaccination-actions.ts`), and vet export (`export-data.ts` / `export-pdf.ts`
  / `export-view.tsx`) are all subject-generic — extend the shared code, don't
  fork a parallel mother version. Exports stay plain Helvetica, no emoji, and
  omit adopter PII unless the admin opt-in is set (mothers have no adopter).
