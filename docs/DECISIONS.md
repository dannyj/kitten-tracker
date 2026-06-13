# Architecture Decision Records

Each ADR captures *why* a significant choice was made, the alternatives weighed, and the
trade-offs accepted. They are point-in-time records; supersede rather than rewrite.

Format: **Status · Context · Decision · Alternatives Considered · Trade-offs**

---

## ADR-001 — SQLite + Drizzle as the datastore

- **Status:** Accepted (2026-06, `drizzle-orm` 0.45, `better-sqlite3` 12)
- **Context:** A single-household / small-shelter tracker self-hosted on a home server.
  Operational simplicity and trivial backups matter far more than horizontal scale.
- **Decision:** Use an embedded SQLite database accessed through Drizzle ORM with the
  synchronous `better-sqlite3` driver. WAL mode on, foreign keys on. The DB is a single file
  on a Docker volume; backups are a file copy via `VACUUM INTO`.
- **Alternatives considered:**
  - *Postgres* — needs a second container, connection pooling, and a backup pipeline; overkill
    for one writer and a handful of users.
  - *Prisma* — heavier runtime and a separate query engine; Drizzle's typed-SQL is lighter and
    keeps the schema as the single source of truth.
- **Trade-offs:** No horizontal scaling and a single writer (see [ADR-005](#adr-005--single-node-single-writer-constraint)).
  In exchange: zero DB ops, instant local setup, and backups that are just files. Drizzle's
  dialect abstraction leaves a Postgres migration path open if ever needed.

---

## ADR-002 — Server Actions + Zod for all mutations

- **Status:** Accepted (2026-06, Next.js 16, Zod 4)
- **Context:** Mutations come from forms across many features and must be validated and
  authorized consistently. We want one place that enforces "auth → validate → write".
- **Decision:** Every mutation is a Server Action following the same pipeline:
  `requireUser()`/`requireAdmin()` → `zod.safeParse` → Drizzle (often a transaction) →
  `revalidatePath()`. Forms use `useActionState` with the shared `FormState` shape so errors
  echo input back. No raw SQL anywhere.
- **Alternatives considered:**
  - *Standalone REST/JSON API + client fetch* — more boilerplate, duplicated validation, and a
    second auth surface.
  - *Client-side validation only* — never trustworthy; validation must be server-side.
- **Trade-offs:** Tightly couples mutations to the Next.js Server Actions model (a customized
  build — see [AGENTS.md](../AGENTS.md)). Worth it for a uniform, auditable mutation path and
  zero client/server schema drift.

---

## ADR-003 — Session cookies with server-side HMAC, Argon2id passwords

- **Status:** Accepted (2026-06)
- **Context:** The app holds adopter PII and may face the internet later. Sessions must
  survive a database leak and authorization must be enforced server-side.
- **Decision:** On login, mint a random 256-bit token; store **only its HMAC** (keyed by
  `SESSION_SECRET`) in the `sessions` table — the raw token lives solely in an
  httpOnly/secure/SameSite=lax cookie. 30-day lifetime with sliding renewal. Passwords hashed
  with Argon2id (`@node-rs/argon2`). Login is rate-limited (5 / 15 min per IP) and logged to
  `audit_log`. Roles (`admin`/`viewer`) enforced in `requireAdmin()`, not just hidden in UI.
- **Alternatives considered:**
  - *Stateless JWTs* — hard to revoke and invite key-handling mistakes; DB-backed sessions
    revoke instantly.
  - *bcrypt* — fine, but Argon2id is the current memory-hard recommendation.
- **Trade-offs:** Every request validating a session does one indexed DB read (cheap with
  better-sqlite3). In return, a stolen database cannot be replayed as sessions, and logout/
  expiry are immediate.

---

## ADR-004 — Re-encode every uploaded photo through sharp

- **Status:** Accepted (2026-06, `sharp` 0.35, `heic-convert`, `exifr`)
- **Context:** Phone photos arrive as JPEG/HEIC carrying EXIF **including GPS**, and uploads
  are an attack surface (embedded payloads, polyglot files).
- **Decision:** Validate uploads by **magic-byte sniffing** (not extension/MIME), cap at
  15 MB, read capture time with `exifr`, then **always re-encode to WebP with sharp**. This
  neutralizes embedded payloads and strips all metadata including GPS. Files get UUID names
  stored outside any static path and are served only through an authenticated route with a
  path-traversal guard. HEIC is decoded via `heic-convert` first.
- **Alternatives considered:**
  - *Store originals as-is* — leaks GPS/EXIF and keeps potential payloads on disk.
  - *Strip EXIF only* — doesn't neutralize malformed/polyglot image bytes the way a full
    re-encode does.
- **Trade-offs:** CPU cost per upload and slight quality loss from re-encoding. Accepted for
  privacy (no GPS leaves the device's photos) and a much smaller upload attack surface.

---

## ADR-005 — Single-node, single-writer constraint

- **Status:** Accepted (constraint, 2026-06)
- **Context:** SQLite with an in-process driver and a singleton connection (`src/db/index.ts`)
  permits exactly one writing process.
- **Decision:** Run as **one container** with no host port, reachable only through Nginx Proxy
  Manager over the `kitten_proxy` network. Accept that the app cannot be horizontally scaled or
  run as multiple replicas against the same database file.
- **Alternatives considered:**
  - *Multi-replica behind a load balancer* — would require Postgres, an external session store,
    and object storage for photos; large complexity for a use case that has one or two
    concurrent users.
- **Trade-offs:** No high availability and no horizontal scale. In exchange: dramatically
  simpler deployment, reasoning, and backups. Durability rests on nightly off-box backups, not
  replication. The escape hatch (Drizzle → Postgres) is documented in
  [ARCHITECTURE.md](ARCHITECTURE.md#scaling-considerations--limitations) should the need arise.
