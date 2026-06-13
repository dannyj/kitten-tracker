# Handoff Template

A fill-in prompt for handing a task to an AI coding agent (e.g. Claude Code) working on this
repo. Copy the template, replace every `[BRACKETED]` value, and delete sections that don't
apply. A worked example follows.

> **Always include this line:** *"This repo uses a customized Next.js build — read the
> relevant guide in `node_modules/next/dist/docs/` before writing routing/config/data-fetching
> code. See AGENTS.md."*

---

## Template

```markdown
## Task
[ONE_SENTENCE_GOAL]. [WHY_IT_MATTERS / USER-FACING_OUTCOME].

## Project overview
Kitten Foster Tracker — Next.js 16 (customized) · React 19 · Drizzle + SQLite ·
Server Actions · Tailwind/shadcn. See docs/README.md and docs/ARCHITECTURE.md.
⚠️ Customized Next.js: consult node_modules/next/dist/docs/ before Next-specific code.

## Files in scope
- [PATH/TO/FILE.tsx] — [its role / what to change]
- [PATH/TO/actions.ts] — [the server action(s) involved]
- [PATH/TO/lib-or-schema] — [pure logic / schema touched]
(Out of scope: [ANYTHING_EXPLICITLY_OFF_LIMITS])

## Relevant types & contracts
- [Type or function]: [where defined, e.g. src/db/types.ts / src/lib/forms.ts]
- Mutation contract: Server Action `(prev: FormState, formData: FormData) => Promise<FormState>`
  following guard → Zod → Drizzle → revalidatePath. See docs/TYPES_AND_INTERFACES.md.

## Architectural decisions / constraints to respect
- [e.g. All mutations go through requireUser()/requireAdmin() — see docs/DECISIONS.md ADR-002/003.]
- [e.g. Derive-on-read: do not persist computed alerts/feeding-due — docs/ARCHITECTURE.md.]
- [e.g. Single-writer SQLite — no background workers — ADR-005.]
- [ANY_DOMAIN_RULE, e.g. medical records are append-only via correctsId.]

## Error / current behavior context
- Symptom: [WHAT_HAPPENS_NOW, incl. exact error text].
- Suspected cause: [HYPOTHESIS, or "unknown"]. See docs/ERROR_PATTERNS.md if it matches a pattern.
- Repro: [STEPS or COMMAND].

## Definition of done
- [ ] [OBSERVABLE_OUTCOME].
- [ ] `npm run typecheck && npm run lint && npm run test` pass.
- [ ] [E2E_OR_MANUAL_CHECK if relevant].
```

---

## Example (populated)

```markdown
## Task
Add an optional "weaned" boolean to kittens and show a "Weaned" badge on the kitten detail
page, so foster carers can tell at a glance which kittens no longer need bottle feeding.

## Project overview
Kitten Foster Tracker — Next.js 16 (customized) · React 19 · Drizzle + SQLite ·
Server Actions · Tailwind/shadcn. See docs/README.md and docs/ARCHITECTURE.md.
⚠️ Customized Next.js: consult node_modules/next/dist/docs/ before Next-specific code.

## Files in scope
- src/db/schema.ts — add `weaned` boolean (default false) to the `kittens` table.
- src/app/(app)/kittens/actions.ts — extend kittenSchema + payload to accept `weaned`.
- src/app/(app)/kittens/kitten-form.tsx — add the toggle (reuse ui/switch).
- src/app/(app)/kittens/[id]/page.tsx — render the badge.
- src/components/status-badge.tsx — pattern to mirror for the new badge.
(Out of scope: feeding-interval logic, alert engine.)

## Relevant types & contracts
- Kitten row type: src/db/types.ts (inferred from schema — updates automatically).
- Mutation contract: Server Action (prev: FormState, formData: FormData) => Promise<FormState>,
  guard → Zod → Drizzle → revalidatePath. See docs/TYPES_AND_INTERFACES.md.
- Booleans from forms arrive as "on"/"true"; transform like handFeeding does in actions.ts.

## Architectural decisions / constraints to respect
- Schema is the source of truth: after editing schema.ts run `npm run db:generate`, commit the
  migration, restart (migrations apply on boot). See docs/ERROR_PATTERNS.md.
- All mutations stay admin/user-guarded — match the existing requireUser() call. ADR-002.
- Don't persist derived state; `weaned` is an explicit user-set field, which is fine.

## Error / current behavior context
- Symptom: none — this is a new feature, not a bug.
- Repro: open any kitten at /kittens/[id]; today there is no weaned indicator.

## Definition of done
- [ ] `weaned` toggle saves and round-trips on create + edit.
- [ ] "Weaned" badge shows only when weaned === true.
- [ ] Migration generated and committed.
- [ ] `npm run typecheck && npm run lint && npm run test` pass.
```

---

### Tips for a good handoff

- **Point at docs, don't re-explain them.** Link `docs/ARCHITECTURE.md`, `docs/DECISIONS.md`,
  etc. instead of restating — keeps the prompt short and authoritative.
- **Name exact files and the contract** the change must follow; ambiguity is where agents drift.
- **State the constraints that aren't obvious from the code** (append-only medical records,
  derive-on-read, single-writer) — these are the rules most easily broken.
- **Make "done" observable** and always include the `typecheck / lint / test` gate.
