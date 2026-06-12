# Claude Code Handoff — Kitten Tracker, Step 1: Scaffold & Foundation

## Objective

Stand up a runnable, secure foundation for the kitten foster tracker: Next.js app with auth, SQLite via Drizzle, full schema migrated, Dockerized behind Nginx Proxy Manager on the home server. No feature UI yet beyond login and an empty authenticated dashboard shell. "Done" means: I browse to https://kittens.local-domain on my LAN, get a valid TLS connection through NPM, log in, and see an empty dashboard.

## Environment

- Target host: Ubuntu server at 192.168.80.125, Docker + Docker Compose installed
- Development happens in this repo; deployment is `docker compose up -d` on the server
- LAN: 192.168.80.0/24. No internet exposure in this step.
- An Nginx Proxy Manager container may already exist on this host — check for one before creating a second; if present, reuse it and only add the proxy host entry.

## Stack (fixed — do not substitute)

- Next.js (latest stable, App Router) + TypeScript, strict mode
- Drizzle ORM + better-sqlite3, DB file at `/data/kittens.db` (Docker volume)
- Zod for all API/server-action input validation
- Auth: session-based (Lucia or Auth.js credentials provider), Argon2id hashing
- Tailwind + shadcn/ui
- node:22-alpine base image, app runs as non-root user

## Tasks

### 1. Repo scaffold

- Next.js + TypeScript + Tailwind + shadcn/ui initialized
- ESLint + Prettier, sensible defaults
- `.env.example` with all required vars (SESSION_SECRET, DATABASE_PATH, etc.); `.env` gitignored
- README with dev-run and deploy instructions

### 2. Database schema (full schema now, even though UI comes later)

Implement the agreed schema as Drizzle tables + an initial migration:
`mothers, mother_health_logs, litters, kittens, weight_entries, feedings, vaccinations, photos, status_history, adopters, viewings, viewing_kittens, alert_settings, users`

Details that matter:

- `kittens.shelter_number` UNIQUE; `kittens.feeding_interval_minutes` default 120; `kittens.hand_feeding` default false
- `kittens.status` enum: intake | in_care | ready | adopted | returned | deceased
- `photos.subject_type` enum kitten|mother, `taken_at_source` enum exif|manual|upload
- Seed `alert_settings` with: `min_daily_gain_g=7`, `target_daily_gain_g=10`, `loss_pct_urgent=5`, `no_gain_hours_urgent=24`
- Migration runs automatically on container start (idempotent)

### 3. Auth

- Login page, session cookie (httpOnly, secure, sameSite=lax), logout
- Argon2id password hashing
- Rate limiting on the login endpoint (in-memory is fine, e.g. 5 attempts / 15 min per IP)
- CLI seed script to create the first admin user: `npm run create-user -- --username lieke --role admin` (prompts for password, never accepts it as an argument)
- Middleware: every route except `/login` requires a session; API routes return 401, pages redirect

### 4. App shell

- Authenticated layout: sidebar/topbar with placeholder nav (Dashboard, Kittens, Mothers, Viewings, Settings), logout button
- Empty dashboard page with a "no kittens yet" empty state
- Mobile-friendly — this will mostly be used on a phone

### 5. Security baseline

- Security headers in `next.config`: CSP (no unsafe-inline where avoidable), X-Content-Type-Options, Referrer-Policy, frame-ancestors 'none'. HSTS commented out with a note to enable once certs are stable.
- All server actions / API handlers validate input with Zod before touching the DB
- No raw SQL anywhere

### 6. Docker & deploy

- Multi-stage Dockerfile (deps → build → minimal runtime), non-root user, only `/data` and `/photos` writable
- `docker-compose.yml`:
  - `kitten-app`: no published host ports, volumes `kitten-db:/data` and `kitten-photos:/photos`, env from `.env`, internal network shared with NPM
  - NPM service only if not already running on the host (see Environment)
- Healthcheck endpoint `/api/health` (checks DB reachable) wired into compose healthcheck
- Deploy notes in README: NPM proxy host config (force SSL, HTTP/2, websocket support off), and the ufw rules:
  ```
  ufw allow from 192.168.80.0/24 to any port 443 proto tcp
  ufw allow from <admin-ip> to any port 81 proto tcp
  ufw default deny incoming
  ```

## Acceptance criteria

1. `docker compose up -d` on a clean host brings up app (and NPM if needed); app is unreachable directly (no published port), reachable only via NPM over HTTPS
2. Fresh container creates/migrates the SQLite DB automatically; all 14 tables present; alert_settings seeded
3. Unauthenticated requests to any page redirect to `/login`; to any API route return 401
4. Admin user created via seed script can log in and out; 6th failed login within 15 min is rejected
5. Security headers present on every response (verify with curl)
6. `npm audit` clean (no high/critical), TypeScript strict passes, lint passes
7. Container restart loses no data (volumes verified)

## Out of scope for this step

Kitten/mother CRUD, weight charts, alerts logic, feeding module, photo upload/EXIF, vaccinations, viewings/adoption, exports. Schema for all of these is in — UI and logic come in steps 2–7 per the project plan.

## Reference

Full project plan: `kitten-tracker-plan.md` (feature list, data model, build order).
