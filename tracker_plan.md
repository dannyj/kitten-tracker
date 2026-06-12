# Kitten Foster Tracker — Project Plan

Web app for tracking foster kittens from intake to adoption. Runs in Docker on the home server (192.168.80.125), LAN-only for now, built so it can safely face the internet later.

---

## 1. Feature List

### Kitten profiles (core entity)

- Name, shelter tracking number, sex, color/markings, birth date (or estimated birth date flag)
- Auto-calculated current age (days/weeks) shown everywhere
- Link to mother (optional — orphan litters exist)
- Hand-feeding toggle per kitten (unlocks the feeding module)
- Foster status pipeline: `intake → in care → ready for adoption → adopted` (plus `returned to shelter`, `deceased` — sadly necessary for fosters)

### Weight & growth tracking

- Quick weight entry (grams, timestamped) — optimized for fast mobile input, since you're weighing with one hand and holding a kitten with the other
- Growth chart per kitten: weight over time with a reference band for expected growth
- Litter overview chart: all siblings on one chart to spot the one falling behind
- **Alert rules (defaults, editable):**
  - Target gain: ~10 g/day (acceptable range 7–15 g/day for neonates)
  - ⚠️ Warning: average gain < 7 g/day over 48h
  - 🔴 Urgent: no gain in 24h, or any weight _loss_ ≥ 5%
- **Built-in hints when an alert fires**, e.g.:
  - Weigh before/after feeds to verify actual intake
  - Warm formula to ~38 °C, check nipple flow rate
  - Smaller, more frequent feeds; try a different nipple or syringe feeding
  - Check for dehydration (skin tent) and body temp — a cold kitten won't eat
  - Escalation note: contact shelter/vet after 2 consecutive missed-gain days

### Hand-feeding module (per kitten, when toggled on)

- Feeding log: timestamp, amount (ml), formula type, how it went (good latch / slow / refused), notes
- Configurable feeding interval, **default 2 hours**
- "Next feed due" countdown + overdue indicator on the dashboard
- Daily intake total vs. target (based on weight: ~8 ml per 30 g body weight per feed as a guide)

### Vaccinations & medical

- Inoculation log per kitten: vaccine type, date given, batch/lot number, administered by, next due date
- Default schedule templates (editable): FVRCP from ~6–8 weeks, boosters every 3–4 weeks until ~16 weeks; deworming at 2/4/6/8 weeks; flea treatment
- Upcoming/overdue medical items on the dashboard
- **Exportable medical summary per kitten** (PDF or print view) to hand back to the shelter

### Photos

- Upload photos per kitten (and per mother)
- Birth date + photo date → **age-at-photo automatically displayed** ("Muis, 3 weeks 2 days")
- Photo date taken from EXIF when available, with manual override; falls back to upload date
- Gallery view per kitten, sorted chronologically — effectively a visual growth timeline

### Mother (queen) profiles

- Name, shelter number, photos, general notes
- Health log: free-form dated entries (eating, behaviour, nursing quality, discharge, temperature, etc.)
- Behavioural notes field (important handoff info for the shelter)
- Linked litter view: all her kittens at a glance

### Adoption & viewings

- Viewing log: date, visitor name(s), phone, email, which kitten(s) viewed, impression/notes
- On status → `adopted`: capture adopter name, phone, email, address, adoption date, shelter paperwork reference
- History is retained — you can always look back at who viewed/adopted which kitten

### Dashboard & alerts

- One landing page: active kittens with age, last weight, gain trend arrow (↑ → ↓), feeding countdowns, medical due items
- Alert center listing all active warnings, sorted by severity

---

## 2. Data Model

Relational, kitten-centered. SQLite-friendly (see tech stack).

```
mothers
  id PK, name, shelter_number, intake_date, notes_behaviour, status, created_at

mother_health_logs
  id PK, mother_id FK, logged_at, category (eating|behaviour|medical|other), entry TEXT

litters                      -- optional grouping; even a single orphan gets a litter row
  id PK, mother_id FK NULL, birth_date, birth_date_estimated BOOL, notes

kittens
  id PK, litter_id FK, shelter_number UNIQUE, name, sex, color,
  birth_date,                -- denormalized from litter for per-kitten overrides
  hand_feeding BOOL DEFAULT false,
  feeding_interval_minutes INT DEFAULT 120,
  status (intake|in_care|ready|adopted|returned|deceased),
  created_at

weight_entries
  id PK, kitten_id FK, weighed_at, weight_grams INT, note

feedings
  id PK, kitten_id FK, fed_at, amount_ml DECIMAL, formula, quality (good|slow|refused), note

vaccinations
  id PK, kitten_id FK, type, given_at, batch_number, administered_by, next_due_date, note

photos
  id PK, subject_type (kitten|mother), subject_id, file_path,
  taken_at,                  -- from EXIF, manual override allowed
  taken_at_source (exif|manual|upload), caption, created_at

status_history
  id PK, kitten_id FK, status, changed_at, note   -- full audit trail of the pipeline

adopters
  id PK, kitten_id FK, name, phone, email, address, adoption_date, shelter_reference, note

viewings
  id PK, visited_at, visitor_name, phone, email, notes
viewing_kittens
  viewing_id FK, kitten_id FK              -- one viewing can cover multiple kittens

alert_settings                              -- global defaults, overridable per kitten later
  id PK, key, value          -- e.g. min_daily_gain_g=7, loss_pct_urgent=5

users
  id PK, username, password_hash (argon2), role (admin|viewer), created_at
```

Notes:

- `status_history` gives you the "look back and feed back to the shelter" requirement for free.
- Photos stored on disk in a Docker volume; DB stores paths only. Filenames randomized (UUID), originals re-encoded server-side.
- Alert evaluation is computed on read (a simple query over the last 48h of `weight_entries`) — no background job needed at this scale.

---

## 3. Tech Stack Recommendation

Keep it to **one app container + one proxy container**. At foster-family scale, anything more is overhead.

| Layer          | Choice                                                                      | Why                                                                                                                            |
| -------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Framework      | **Next.js (App Router) + TypeScript**                                       | One codebase for UI + API, fast to build, huge well-audited ecosystem                                                          |
| Database       | **SQLite via Drizzle ORM**                                                  | Zero-ops, file lives in a Docker volume, parameterized queries by default. Trivial to migrate to Postgres later if ever needed |
| Validation     | **Zod** on every API input                                                  | Security-first: nothing unvalidated touches the DB                                                                             |
| Auth           | **Session-based login** (Auth.js or Lucia), Argon2 password hashing         | Required even on LAN, since internet exposure is planned                                                                       |
| Charts         | **Recharts**                                                                | Clean, simple line charts with reference bands — matches "trends, not complicated"                                             |
| UI             | **Tailwind + shadcn/ui**                                                    | Modern/sleek out of the box, mobile-friendly (you'll use this one-handed at 03:00 feeds)                                       |
| Image handling | **sharp** (re-encode uploads) + **exifr** (read EXIF date before stripping) | Re-encoding kills embedded payloads; EXIF read first for age-at-photo                                                          |
| Proxy / TLS    | **Nginx Proxy Manager** (you already planned this)                          | Terminates HTTPS; app container is never directly exposed                                                                      |

### Docker layout (on 192.168.80.125)

```yaml
services:
  kitten-app:
    build: .
    volumes:
      - kitten-db:/data # SQLite file
      - kitten-photos:/photos
    networks: [internal] # NOT published to host
    environment:
      - SESSION_SECRET=... # from .env, never committed

  npm:
    image: jc21/nginx-proxy-manager
    ports:
      - "443:443"
      - "81:81" # NPM admin — LAN only, firewall this
    networks: [internal]
```

Key point: the app publishes **no host port**. Only NPM can reach it over the internal Docker network, so HTTPS-only is enforced structurally, not by convention.

For HTTPS on a LAN-only hostname: use a DNS-01 Let's Encrypt challenge in NPM with a real domain you own (e.g. `kittens.yourdomain.nl` resolving internally) — gives you valid certs with nothing exposed. Self-signed works too but causes browser nagging on phones.

### Firewall rules (server-side, e.g. ufw)

```bash
# HTTPS to the proxy, LAN only
ufw allow from 192.168.80.0/24 to any port 443 proto tcp

# NPM admin UI — ideally only from your own machine
ufw allow from <your-laptop-ip> to any port 81 proto tcp

# No port 80 rule at all (no plain HTTP), default deny inbound
ufw default deny incoming
```

When you later expose it to the internet: forward only 443 on the router to the server, keep 81 LAN-only, add rate limiting in NPM, and consider putting it behind your existing reverse-proxy/auth setup or a VPN first.

### Security-first checklist (build-time)

- All inputs validated with Zod; ORM only (no raw SQL string building)
- Argon2id password hashing, rate-limited login, secure/httpOnly/sameSite cookies
- Upload hardening: max size, MIME sniffing (not extension trust), re-encode via sharp, UUID filenames, stored outside web root, served through an authenticated route
- Security headers via Next.js config: CSP, HSTS (once certs are stable), X-Content-Type-Options, frame-ancestors 'none'
- Dependencies pinned, `npm audit` in CI, minimal base image (node:22-alpine), container runs as non-root
- Nightly backup: copy SQLite file + photos volume (SQLite makes this a one-line cron job)

---

## 4. Suggested build order (for the Claude Code handoff)

1. Scaffold Next.js + Drizzle + SQLite + auth, Docker Compose with NPM
2. Mothers + litters + kittens CRUD with status pipeline
3. Weight entries + growth charts + alert logic and hints
4. Hand-feeding module with interval countdown
5. Vaccinations + shelter export view
6. Photo upload with EXIF age calculation + galleries
7. Viewings + adoption capture
8. Dashboard tying it together, then security hardening pass
