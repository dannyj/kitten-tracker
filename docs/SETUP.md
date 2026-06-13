# Setup

Get the Kitten Foster Tracker running locally for development. For production deploy,
backups, and the security runbook, see the root [README.md](../README.md).

## Prerequisites

| Requirement | Version / notes |
|---|---|
| **Node.js** | **22.x** (matches the Docker `node:22-alpine` runtime). Use `nvm install 22`. |
| **npm** | Ships with Node 22. |
| **OS** | macOS or Linux. Native modules (`better-sqlite3`, `sharp`, `@node-rs/argon2`) build via prebuilds; a C toolchain is the fallback. |
| **System packages** | Usually none — prebuilt binaries cover macOS/Linux. If a native build is triggered: macOS needs Xcode CLT (`xcode-select --install`); Debian/Ubuntu needs `build-essential python3`. |
| **Docker** (optional) | Only for running the production image locally or deploying. |

> ⚠️ This repo uses a **customized Next.js build**. Before writing code, read the relevant
> guide in `node_modules/next/dist/docs/` — APIs and conventions may differ from public
> Next.js. See [AGENTS.md](../AGENTS.md).

## Installation steps (in order)

```bash
# 1. Clone and enter the repo
git clone <repo-url> kitten_app && cd kitten_app

# 2. Create your environment file from the template
cp templates/.env.example .env

# 3. Generate a session secret and put it in .env
openssl rand -hex 32
#    → copy the output into SESSION_SECRET=... in .env

# 4. Install dependencies (compiles/fetches native modules)
npm install

# 5. Start the dev server — the SQLite DB is created and migrated automatically
npm run dev                       # http://localhost:3000

# 6. Create your first user (prompts for a password; never pass it as an argument)
npm run create-user -- --username admin --role admin
```

Step 5 triggers `src/instrumentation.ts` → `migrateAndSeed()`, which applies all migrations
in `drizzle/` and seeds default alert thresholds and schedule templates. **There is no
separate migrate command for local dev** — booting the app is enough.

## Environment variables

Copy `templates/.env.example` to `.env` and fill it in. `.env` is git-ignored — never commit it.

| Variable | Required | Example | Purpose |
|---|---|---|---|
| `SESSION_SECRET` | **Yes** | `a1b2…` (64 hex chars) | HMAC key for session tokens. **Must be ≥ 32 chars** or the app throws on first session. Generate with `openssl rand -hex 32`. |
| `DATABASE_PATH` | No (defaults `./data/kittens.db`) | `./data/kittens.db` | SQLite file location. Docker uses `/data/kittens.db`. |
| `PHOTOS_PATH` | No (defaults `./data/photos`) | `./data/photos` | Directory for uploaded (re-encoded) photos. Docker uses `/photos`. |

`NODE_ENV` and `NEXT_RUNTIME` are set by the framework — don't set them yourself.

## Verify your setup

```bash
npm run typecheck      # tsc --noEmit — should report no errors
npm run lint           # eslint
npm run test           # pure-logic unit tests (alerts, feeding, schedule)
curl localhost:3000/api/health   # → {"status":"ok"} when DB is reachable
```

Then open `http://localhost:3000`, log in with the user from step 6, and confirm the
Dashboard renders. A full smoke test: **Mothers → Add mother → Add litter → Add kitten**,
then record a weight on the kitten's page.

## Known gotchas and workarounds

| Gotcha | Fix |
|---|---|
| `SESSION_SECRET must be set (>= 32 chars)` on first request | Your `.env` is missing or the secret is too short. Regenerate with `openssl rand -hex 32`. |
| Native module errors after a **Node version switch** | `rm -rf node_modules && npm install` to rebuild `better-sqlite3` / `sharp` against the new ABI. |
| Edits to `src/db/schema.ts` don't take effect | Run `npm run db:generate` to create a migration, then restart `npm run dev` (migrations apply on boot). |
| Want a clean database | Stop the server and delete `./data/kittens.db` (and `-wal`/`-shm` files); it's recreated on next boot. |
| Photos won't upload | Ensure `PHOTOS_PATH`'s parent directory is writable. Non-image bytes are rejected by magic-byte sniffing, not extension. |
| Reading public Next.js docs leads you astray | This is a customized Next.js — consult `node_modules/next/dist/docs/` instead. |

## Troubleshooting

See [ERROR_PATTERNS.md](ERROR_PATTERNS.md) for detailed problem → cause → solution →
prevention entries covering both development-time and runtime errors.
