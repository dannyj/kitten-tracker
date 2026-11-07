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
- Keep the default test browser in `Europe/Amsterdam`. `Europe/London` has the
  same UTC offset as the server in winter, which hides timezone regressions.
- New time-bearing inputs or server actions need an e2e that runs under
  `verify-prod.sh` (server/browser timezones differ), or the regression is invisible.
- A new e2e target = a `seed-<target>.cjs` (or reuse one) + an `e2e-<target>.mjs`,
  both registered in `verify-prod.sh` (`seed_for` + `ALL_TARGETS`). `rev3` is the
  mother-medical suite; `step5` is the kitten-medical suite; `rev4` is the
  viewings & adoption-workflow suite.

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
- **Prefer `ALTER TABLE ADD/DROP COLUMN` over table recreation when the table has
  children.** better-sqlite3 bundles SQLite ≥3.35, so column add/drop needs no
  `__new_…` copy. The `viewings` rework (0007) used this: recreating `viewings`
  would have implicitly deleted it, and the `ON DELETE CASCADE` from
  `viewing_kittens` would have **wiped the join rows**. Adding `interested_party_id`
  / `location`, backfilling, then dropping the old contact columns sidesteps that
  entirely. (FK columns added via `ADD COLUMN` must be nullable — fine; the app and
  Drizzle treat `viewings.interested_party_id` as `notNull` and always set it.)
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

# Viewings & adoption run through reusable interested parties

`interested_parties` are first-class, reusable contact records (PII). `viewings`
reference one via `interested_party_id` (real FK) and keep the `viewing_kittens`
join, so a party links to many viewings and many kittens without retyping.

- **The party pipeline lives in `src/lib/parties.ts`** (`PARTY_STATUSES`, labels,
  badge classes, allowed transitions) — mirror `src/lib/status.ts`, don't inline
  transition rules. `enquired → viewing_booked → viewed → approved → adopted` with
  `withdrew`/`not_suitable` off-ramps; `adopted` is reachable **only** through the
  link-to-kitten flow, never a bare status change.
- **Adoption is shared, not forked.** `markKittenAdopted` (`src/lib/adoption.ts`)
  does the kitten status move + `status_history` + `adopters` insert inside the
  caller's transaction. Both `changeKittenStatus` (kitten pipeline) and `adoptParty`
  (party→kitten link) call it, so the step-2 "adopted requires adopter details"
  rule is satisfied once. `adoptParty` guards each kitten isn't already
  adopted/deceased before writing — no silent double-adopt.
- **PII gating is server-side.** Party create/edit/adopt actions and the
  `new`/`edit` page loaders use `requireAdmin`; the list and detail pages omit
  contact fields server-side for viewers (they aren't rendered-then-hidden).
  Parties are excluded from the vet export (it's medical-only) and prunable —
  don't retain non-proceeding contacts indefinitely.
- View-models for the calendar/party pages come from `src/lib/viewing-data.ts`
  (`getViewingItems`, `groupViewingsByTime`, `getPartyLinkedKittens`) — fixed-query
  joins, no N+1, and `now` lives there (not in a component) to keep render pure.
  Viewing times are datetime-local inputs pinned with `pinDatetimeField` before
  submit; a viewing is an appointment, so future dates are valid.

# Login limits and audit retention

- Never use forwarding headers as a trusted login identity. NPM and direct Tailscale clients can supply them. Login audit IP is null.
- Login has account and global verification limits, a concurrency limit, and an action-level request limit before validation. Keep the action-level gate: Server Actions can arrive on alternate paths that bypass a path-specific proxy gate.
- Limit state belongs to one standalone process. Use shared storage before adding replicas. Successful login does not reset verification limits.
- Refuse new account keys when limiter storage is full. Never evict a live limit to accept a new key.
- Aggregate rate-limited login audit events with bounded counters and timed summaries. Never write one database row per rejected request.
- Audit timestamps use Unix seconds. Retain 90 days; maintenance removes only rows strictly older than the cutoff. Audit failures must not alter login limits.
