# Kitten Foster Tracker

Web app for tracking foster kittens from intake to adoption: weights and growth alerts, hand-feeding schedules, vaccinations, photos, viewings and adoption records. Runs in Docker behind Nginx Proxy Manager on the home server, LAN-only.

Project plan: [`tracker_plan.md`](tracker_plan.md) · Current step: [`step1_handoff.md`](step1_handoff.md) (scaffold & foundation).

## Stack

Next.js (App Router, TypeScript strict) · SQLite via Drizzle ORM (better-sqlite3) · Zod validation · session auth with Argon2id · Tailwind + shadcn/ui · Docker (node:22-alpine, non-root).

## Development

```bash
cp .env.example .env        # then set SESSION_SECRET (openssl rand -hex 32)
npm install
npm run dev                 # http://localhost:3000 — DB is created/migrated on start
npm run create-user -- --username danny --role admin   # prompts for password
```

Useful scripts: `npm run typecheck`, `npm run lint`, `npm run format`, `npm run db:generate` (new migration after schema changes).

The SQLite DB lives at `DATABASE_PATH` (default `./data/kittens.db`). Migrations in `drizzle/` are applied automatically on every server start (idempotent) and `alert_settings` is seeded with defaults.

## Deploy (192.168.80.125)

```bash
rsync -a --exclude node_modules --exclude .next --exclude data --exclude .git \
  ./ danny@192.168.80.125:~/Documents/repos/kitten_app/
ssh danny@192.168.80.125
cd ~/Documents/repos/kitten_app
cp .env.example .env && openssl rand -hex 32   # paste as SESSION_SECRET in .env
docker compose up -d --build
docker network connect kitten_proxy npm        # once; lets NPM reach the app
docker exec -it kitten-app node scripts/create-user.cjs --username danny --role admin
```

The app publishes **no host port**. It is only reachable through NPM over the shared `kitten_proxy` Docker network. If the `npm` container is ever recreated, re-run the `docker network connect` line (or add `kitten_proxy` as an external network in NPM's own compose file).

### Nginx Proxy Manager proxy host

- Domain: `kittens.danny-hall.net`
- Scheme `http`, Forward Hostname `kitten-app`, Forward Port `3000`
- Websockets support: **off** · Block common exploits: on
- SSL: request a certificate via **DNS-01 / Cloudflare**, Force SSL: on, HTTP/2: on
- Make `kittens.danny-hall.net` resolve to the NPM LAN IP (`192.168.80.68`) — e.g. a Pi-hole local DNS record or a Cloudflare A record pointing at the private IP.

### Firewall (on the server)

```bash
ufw allow from 192.168.80.0/24 to any port 443 proto tcp
ufw allow from <admin-ip> to any port 81 proto tcp   # NPM admin UI
ufw default deny incoming
```

### Health & data

- Healthcheck: `GET /api/health` (checks the DB; the only unauthenticated route).
- Data lives in the `kitten-db` (SQLite) and `kitten-photos` volumes; container restarts and rebuilds lose nothing.
- Backups: copy the SQLite file + photos volume nightly, e.g. `docker run --rm -v kitten-db:/data -v /backup:/backup alpine cp /data/kittens.db /backup/`.

## Security notes

- Sessions: random 256-bit token in an httpOnly/secure/sameSite=lax cookie; only an HMAC of the token is stored server-side. 30-day lifetime, sliding renewal.
- Login rate limit: 5 attempts per 15 minutes per IP (in-memory).
- All inputs validated with Zod; Drizzle only, no raw SQL string building.
- CSP is nonce-based (no `unsafe-inline` scripts), set in `src/proxy.ts`; other headers in `next.config.ts`. HSTS is commented out there — enable once the cert setup has been stable.
- Container: non-root user, read-only root filesystem (only `/data`, `/photos`, tmpfs writable), `no-new-privileges`.
