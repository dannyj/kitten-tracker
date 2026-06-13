# Glossary

Domain and technical terms used across the codebase and docs. Cross-references point to
related terms and docs.

## Domain terms

**Mother** — A queen (adult female cat) whose litter is being fostered. Has a health log of
free-text entries categorized as eating / behaviour / medical / other. See
[Litter](#litter), [Kitten](#kitten).

**Litter** — A group of kittens born together, optionally linked to a [Mother](#mother). Every
[Kitten](#kitten) belongs to exactly one litter. Supports a batch "weigh litter" flow.

**Kitten** — The central entity: one fostered kitten, tracked through the
[Status pipeline](#status-pipeline) from intake to adoption.

**Status pipeline** — The lifecycle a kitten moves through:
`intake → in_care → ready → adopted`, with `returned` and `deceased` as terminal branches.
Forward transitions are validated; each change is recorded in `status_history`.

**Hand-feeding** — A per-kitten flag for orphaned/underweight kittens needing bottle feeding
at a set interval (`feedingIntervalMinutes`, default 120). Enabling it surfaces the
[Feeding log](#feeding) and a [Feeding countdown](#feeding-countdown).

**Feeding** — A logged bottle-feed: amount in ml, optional formula, and a
[Feeding quality](#feeding-quality). `fedAt` may be backdated; the
[Edit window](#edit-window) runs from `createdAt`.

**Feeding quality** — How the feed went: `good`, `slow`, or `refused`. A refused feed is a
clinical warning sign.

**Feeding countdown** — The derived "next feed due" timer for a hand-fed kitten, computed from
the last feeding and the kitten's interval. Not stored — see [Derive-on-read](#derive-on-read).

**Weight entry** — A weighing in grams. Hard bounds 50–8000 g reject typos; a soft range
(70–2000 g) triggers a confirm rather than a reject. `weighedAt` may be backdated.

**Growth alert** — A per-kitten verdict (`urgent` / `warning` / `ok` / `insufficient`)
produced by the pure engine in `src/lib/alerts.ts` from recent weights and live
[Alert settings](#alert-settings). Monitoring decision support, **not** a medical diagnosis.

**Alert settings** — Admin-tunable thresholds driving alerts: minimum daily gain, target
daily gain, urgent loss %, and no-gain hours. Stored in `alert_settings`, seeded with
defaults, editable in Settings.

**Schedule template** — A convenience default for vaccination/deworming timing
(first / every / until, in weeks). Editable in Settings. **Not a veterinary protocol** —
guidance only. Stored in `schedule_templates`.

**Vaccination / medical record** — An **append-only** medical event. After the
[Edit window](#edit-window), a correction is a *new* row pointing at the original via
`correctsId` — records are never silently rewritten.

**Adopter** — A person adopting a kitten; holds PII (name, phone, email, address). Visible
only to [admins](#role), and PII access is written to the [Audit log](#audit-log).

**Viewing** — A visit where prospective adopters meet one or more kittens
(`viewings` ↔ `viewing_kittens` join).

**Age-at-photo** — A photo's [Taken-at](#taken-at-source) time minus the kitten's birth date,
shown in the gallery so you can see how old the kitten was in each picture.

## Technical terms

**Edit window** — The 15-minute period after a log entry's `createdAt` during which it can be
edited or deleted; afterward it locks. Runs from `createdAt` (not the backdatable event time)
so backdated entries are still correctable right after entry. Constants in `src/lib/constants.ts`.

**Derive-on-read** — The pattern of computing alerts, growth slopes, and feeding-due times at
render time from raw rows instead of storing them. A settings change instantly re-colors every
kitten with no migration. See [ARCHITECTURE.md](ARCHITECTURE.md).

**Server Action** — A Next.js `"use server"` function invoked from a form. The app's standard
mutation path: guard → Zod → Drizzle → revalidate. See
[TYPES_AND_INTERFACES.md](TYPES_AND_INTERFACES.md).

**Optimistic auth gate** — The cheap cookie-presence check in `src/proxy.ts` that runs before
Node code (no DB). Real validation happens later in `requireUser()`. See [Two-layer auth](#two-layer-auth).

**Two-layer auth** — Optimistic cookie check at the proxy + real HMAC validation
(`getCurrentSession`) inside every page loader and action.

**Role** — `admin` (sees adopter PII, edits Settings) or `viewer` (cannot). Enforced
server-side in `requireAdmin()`, not merely hidden in the UI.

**Audit log** — The durable `audit_log` table recording logins (success/failure/rate-limited),
adopter-PII access, and exports.

**Taken-at source** — How a photo's capture time was set: `exif` (read from the file),
`manual` (entered), or `upload` (fallback to upload time).

## Acronyms

| Acronym | Expansion / meaning |
|---|---|
| **ADR** | Architecture Decision Record — see [DECISIONS.md](DECISIONS.md). |
| **CSP** | Content-Security-Policy — nonce-based, set in `src/proxy.ts`. |
| **HMAC** | Hash-based Message Authentication Code — keys the stored session token hash. |
| **WAL** | Write-Ahead Logging — the SQLite journal mode enabling concurrent reads. |
| **RSC** | React Server Component — server-rendered page component. |
| **ORM** | Object-Relational Mapper — Drizzle, here. |
| **PII** | Personally Identifiable Information — adopter contact details. |
| **EXIF** | Exchangeable Image File Format — photo metadata (incl. GPS), stripped on upload. |
| **HEIC** | High-Efficiency Image Container — Apple photo format, decoded via `heic-convert`. |
| **NPM** | Nginx Proxy Manager — the reverse proxy / HTTPS terminator (not npm the package manager). |
| **WebP** | The image format every upload is re-encoded to. |
