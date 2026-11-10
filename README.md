# Kitten Foster Tracker

Web app for tracking foster kittens from intake to adoption: mothers & litters, the foster status pipeline, weights with growth charts and alerts, hand-feeding schedules, vaccinations with a shelter PDF/print export, and photo galleries with age-at-photo. Runs in Docker behind Nginx Proxy Manager on the home server, LAN-only (built so it can safely face the internet later).

Project plan: [`tracker_plan.md`](tracker_plan.md). Build handoffs: `step1_handoff.md` … `step7_handoff.md`.

## Architecture

- **Next.js** (App Router, TypeScript strict) — one codebase for UI + API. Server Components + server actions; route handlers for uploads, image serving, health, and exports.
- **SQLite via Drizzle ORM** (better-sqlite3). DB file in a Docker volume. Migrations in `drizzle/` apply automatically on every start (idempotent) via `src/instrumentation.ts`, which also seeds `alert_settings` and `schedule_templates`.
- **Zod** validates every mutation server-side. **Auth**: session cookie (random token, only its HMAC stored), Argon2id password hashing.
- **Tailwind + shadcn/ui**, **Recharts** (growth charts), **sharp** + **heic-convert** + **exifr** (photo pipeline), **pdfkit** (shelter export).
- **Docker**: multi-stage `node:22-alpine`, non-root, read-only root filesystem except the `/data` and `/photos` volumes. The app publishes **no host port** — only Nginx Proxy Manager reaches it over the shared `kitten_proxy` network, so HTTPS-only is structural.

Key directories: `src/app/(app)` (authenticated pages), `src/app/api` (upload/serve/health), `src/app/export` (print + PDF), `src/lib` (pure logic: alerts, growth, feeding, schedule, photo-storage), `src/db` (schema + migrations).

## First run

1. Create the admin user (prompts for a password — never passed as an argument):
   ```bash
   docker exec -it kitten-app node scripts/create-user.cjs --username danny --role admin
   ```
2. Log in → **Mothers → Add mother** → on her page **Add litter** → **Add kitten** (one per kitten).
3. Start logging: open a kitten and record weights; toggle **hand-feeding** to get the feeding log + countdown; log vaccinations; add photos.
4. The **Dashboard** is the at-a-glance view: who needs attention (weight alerts), feeding due, medical due, and every active kitten.

## Development

```bash
cp .env.example .env        # then set SESSION_SECRET (openssl rand -hex 32)
npm install
npm run dev                 # http://localhost:3000 — DB created/migrated on start
npm run create-user -- --username danny --role admin   # prompts for password
```

Scripts: `npm run typecheck`, `npm run lint`, `npm run test` (pure-logic unit tests), `npm run format`, `npm run db:generate` (new migration after a schema change). End-to-end suites are `e2e-step*.mjs` (Playwright against the standalone build on port 3100).

## Admin tasks

- **Create a user**: `docker exec -it kitten-app node scripts/create-user.cjs --username NAME --role admin|viewer` (prompts for password).
- **Alert thresholds & schedule templates**: Settings page (admin only). Growth thresholds (warning floor, target gain, urgent loss %, no-gain hours) and vaccination/deworming templates are editable; both have "reset to defaults".
- **Roles**: `admin` can see adopter PII and change settings; `viewer` cannot (enforced server-side, not just hidden).
- **Audit log**: logins (success/failure/rate-limited), adopter-PII access, and exports are recorded in the `audit_log` table. Inspect with
  `docker exec kitten-app node -e "const d=require('better-sqlite3')(process.env.DATABASE_PATH); console.table(d.prepare('select at,action,username,detail from audit_log order by id desc limit 50').all())"`.

## Deploy (192.168.80.125)

```bash
rsync -a --delete --exclude node_modules --exclude .next --exclude data --exclude .git --exclude .env \
  ./ danny@192.168.80.125:~/Documents/repos/kitten_app/
ssh danny@192.168.80.125
cd ~/Documents/repos/kitten_app
cp .env.example .env && openssl rand -hex 32   # paste as SESSION_SECRET in .env
docker compose up -d --build
docker network connect kitten_proxy npm        # once; lets NPM reach the app
docker exec -it kitten-app node scripts/create-user.cjs --username danny --role admin
```

The app publishes **no host port**; only NPM can reach it over the shared `kitten_proxy` network. If the `npm` container is recreated, re-run the `docker network connect` line.

After the stack is up, apply the network lockdown (see [Host network lockdown](#host-network-lockdown-lateral-movement-controls)):

```bash
sudo ./scripts/host-firewall.sh apply           # block app->npm:81 and app->LAN
```

The `ts-kitten` tailnet node must be tagged and constrained too — apply
`docs/tailscale-policy.hujson` in the Tailscale admin console **before** the node
first authenticates (see [Tailnet lockdown](#host-network-lockdown-lateral-movement-controls)).

### Nginx Proxy Manager proxy host

- Domain `kittens.danny-hall.net`; Scheme `http`, Forward Hostname `kitten-app`, Forward Port `3000`.
- Websockets: off · Block common exploits: on.
- SSL: certificate via **DNS-01 / Cloudflare**, Force SSL on, HTTP/2 on. Enable **HSTS** once the cert has been stable for a while.
- Resolve `kittens.danny-hall.net` to NPM's LAN IP (`192.168.80.68`) via a Pi-hole local DNS record.

### Login ingress limits and audit retention

The application does not trust `X-Forwarded-For` or `X-Real-IP` as client identity.
Keep account and global verification limits enabled on every access route.
The application request gate also covers login actions submitted to another path.
These application limits do not replace a network ingress limit.

For NPM, create `/data/nginx/custom/http_top.conf` in the NPM container volume:

```nginx
limit_req_zone $binary_remote_addr zone=kitten_requests:10m rate=5r/s;
```

Add this line to the kittens proxy host **Advanced** configuration:

```nginx
limit_req zone=kitten_requests burst=20 nodelay;
limit_req_status 429;
```

Test the configuration with `nginx -t` inside NPM before reload.
This limit covers all requests to this proxy host, including alternate action paths.
Direct Tailscale access bypasses NPM; the application limits still apply.
These NPM changes require a separate operator action on the host.

Rejected login bursts produce one start event and one summary per active minute.
The summary includes the rejected request count. An abrupt restart can lose pending counts.
Ordinary password failures remain individually logged within the global verification limit.
Audit write errors do not bypass limits or prevent login.

Audit retention is 90 days. An audit write triggers cleanup at most once per hour.
Schedule daily maintenance so retention also applies when no audit activity occurs:

```cron
15 3 * * * docker exec kitten-app node scripts/audit-maintenance.cjs
```

Monitor scheduler exit status. The command reports database bytes and audit row count.
It exits nonzero at 1 GiB or one million audit rows. Adjust these thresholds for host capacity.
Retention makes expired SQLite pages reusable; it does not shrink the database file.

### Health

- `GET /api/health` checks DB reachability (the only unauthenticated route) and is wired into the compose healthcheck.

## Backups & restore

Automated, online-safe (uses SQLite `VACUUM INTO`, not a naive copy of a live file) — DB + photos volume.

```bash
scripts/backup.sh                     # writes ~/kitten-backups/kittens-TS.db + photos-TS.tgz
```

Schedule nightly via cron on the host:

Create the private directory before cron opens its log file:

```bash
install -d -m 700 "$HOME/kitten-backups"
```

```cron
0 3 * * * umask 077; /home/danny/Documents/repos/kitten_app/scripts/backup.sh >> /home/danny/kitten-backups/backup.log 2>&1
```

The script restricts the backup directory to its owner (`700`) and backup files to owner read/write (`600`).
Docker creates the photo archive with the host user's UID and GID and a private umask.
Run the script as the intended backup owner. That user must have Docker access and read access to the photos.

Restrict existing backups and logs before the next scheduled backup. Run these commands as their owner:

```bash
chmod 700 "$HOME/kitten-backups"
find "$HOME/kitten-backups" -type f -exec chmod 600 {} +
```

If Docker created old files as root, an administrator must first transfer ownership to the intended backup owner.
These commands restrict ordinary mode bits. Remove any additional ACL grants from the backup directory and files.

Retention: last 14 days (`RETAIN_DAYS`). Copy backups to another machine over SSH (rsync/scp).
Create the destination directory with mode `700` and restrict copied files to `600`.
Do not use a shared account, public bucket, or publicly accessible folder for these copies.
Encrypt off-host storage and restrict its access to the backup owner and authorized recovery administrators.
Backups contain contact details, password hashes, and photos. Apply the same access restrictions to backup logs and temporary restore copies.

**Restore** (replaces current data — verify the files first):

```bash
scripts/restore.sh ~/kitten-backups/kittens-TS.db ~/kitten-backups/photos-TS.tgz
```

**Tested restore procedure** (verify a backup into a _throwaway_ set of volumes, no risk to live data):

```bash
docker run --rm -v rt_db:/data -v ~/kitten-backups:/in alpine cp /in/kittens-TS.db /data/kittens.db
docker run --rm -v rt_photos:/photos -v ~/kitten-backups:/in alpine sh -c 'tar xzf /in/photos-TS.tgz -C /photos'
docker run --rm -v rt_db:/data -e DATABASE_PATH=/data/kittens.db kitten_app-kitten-app \
  node -e "const d=require('better-sqlite3')(process.env.DATABASE_PATH); console.log('kittens', d.prepare('select count(*) c from kittens').get().c, 'photos', d.prepare('select count(*) c from photos').get().c)"
docker volume rm rt_db rt_photos
```

The full backup→wipe→restore cycle is verified to reproduce all rows and photo files.

## Internet-exposure runbook (prepared, not enabled)

The app holds adopter PII (names, phones, addresses). **Recommended: reach it over a VPN** (Tailscale/WireGuard) rather than publishing the login form — same remote access, almost none of the credential-stuffing/bot exposure, near-zero effort. Direct public exposure is defensible _only_ with the whole checklist below in place first.

Pre-exposure checklist:

- [ ] Router forwards **only 443** to the server; **no port 80**; NPM admin (81) stays LAN-only.
- [ ] NPM: valid DNS-01 Let's Encrypt cert, **Force SSL**, **HSTS on**, HTTP/2 on.
- [ ] Brute-force protection in front of login at the proxy layer (NPM access list / rate limiting), in addition to the app's account and global login limits.
- [ ] `ufw`: `allow from <admin-ip> to any port 81`; `allow 443` as needed; `default deny incoming`.
- [ ] Strong, unique admin password; consider a second factor via the VPN/reverse-proxy auth in front.
- [ ] Backups running and copied off-box; audit log reviewed periodically.
- [ ] Enable HSTS in `next.config.ts` (currently commented) once certs are stable.

Because of the step-1 architecture (app behind NPM, no published port), exposure is a configuration change, not a rebuild.

## Security notes

- Sessions: random 256-bit token in an httpOnly/secure/sameSite=lax cookie; only an HMAC of the token is stored. 30-day lifetime, sliding renewal.
- Login verification limits: 5 attempts per account and 50 total attempts per 15 minutes, with at most 2 concurrent verifications. Success does not reset limits.
- Forwarding headers are untrusted on both NPM and direct Tailscale routes. Login audit IP values are null.
- The login action accepts at most 120 requests per minute before input validation. The proxy also limits login/action POST requests.
- Limit state belongs to one standalone process. A restart clears it. Use shared limits before adding replicas.
- Every mutation Zod-validated; Drizzle only (no raw SQL). Authorization checked server-side on every action; adopter PII and Settings are admin-only.
- Interested-party contact details are PII and admin-only (omitted server-side for viewers, not just hidden in the UI). These are people who may never adopt — the Parties list carries an on-screen reminder to **prune parties who didn't proceed** rather than retaining contact data indefinitely without reason. Parties are excluded from the vet export.
- Upload pipeline: magic-byte content sniffing (not extension/MIME), 15 MB cap, **always re-encoded** with sharp to WebP (neutralises embedded payloads, strips EXIF **and GPS**), UUID filenames outside any static path, served only through an authenticated route with a path-traversal guard.
- Headers: nonce-based CSP (no `unsafe-inline` scripts) in `src/proxy.ts`; `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options: DENY`, `Permissions-Policy` in `next.config.ts`. HSTS ready to enable.
- Production errors show a clean message — no stack traces leak to the client.
- Container runs non-root with a read-only root filesystem (only `/data`, `/photos`, tmpfs writable) and `no-new-privileges`.
- `npm audit` is clean and dependencies are pinned.
- The `ts-kitten` Tailscale sidecar image is pinned by digest (not the floating `:stable` tag) so a rebuild can't silently change a `NET_ADMIN`-capable container.

## Host network lockdown (lateral-movement controls)

If the app container is ever compromised, these limit what it can reach. They live
outside the app (tailnet policy + host firewall) and are applied **on the host**,
not baked into the image.

**1. Tailnet lockdown (`docs/tailscale-policy.hujson`).** `ts-kitten` shares the
app's network namespace, so the WireGuard interface lives inside the app
container — a compromised app could otherwise reach every tailnet peer. The
policy tags the node `tag:kittens` and, because tagged nodes aren't
`autogroup:member`, the node can **receive** on `:3000` but cannot **initiate** to
any peer. Apply it in the Tailscale admin console (Access Controls) **before**
the node first authenticates — `--advertise-tags=tag:kittens` (set in
`docker-compose.yml`) is rejected at login if the tag has no owner yet. Verify:

```bash
docker exec ts-kitten tailscale status      # node should show the "kittens" tag
```

**2 + 3. Host firewall (`scripts/host-firewall.sh`).** Installs DOCKER-USER rules
scoped to the `kitten_proxy` subnet:

- blocks the app from NPM's admin port (`:81`) — admin stays LAN-reachable;
- blocks the app from the LAN and other private networks (host SSH, Pi-hole,
  other Docker bridges) while keeping the `npm`↔app proxy flow and Tailscale's
  internet egress working.

```bash
sudo ./scripts/host-firewall.sh apply     # install/refresh
sudo ./scripts/host-firewall.sh status    # show managed rules
sudo ./scripts/host-firewall.sh clear     # roll back
```

`DOCKER-USER` is recreated empty on **Docker daemon restart**, so re-apply after
one. To persist, add a root crontab entry:

```cron
@reboot sleep 30 && /home/danny/Documents/repos/kitten_app/scripts/host-firewall.sh apply >> /var/log/kitten-fw.log 2>&1
```

**Honest limit:** the firewall stops LAN pivots and reaching other containers, but
a port-based allowlist can't distinguish Tailscale's DERP-on-443 from arbitrary
HTTPS, so it does **not** block internet exfil/C2 over 443. Closing that needs an
egress proxy (out of scope). After `apply`, always confirm `tailscale status`
still connects; if not, `clear` and widen the allowlist.
