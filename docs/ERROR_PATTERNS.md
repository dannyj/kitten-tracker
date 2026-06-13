# Error Patterns

Common failures in this stack (Next.js 16 customized build · Drizzle + better-sqlite3 ·
Server Actions · sharp uploads · Docker), with cause, fix, and prevention. For first-time
setup issues see [SETUP.md](SETUP.md#known-gotchas-and-workarounds).

---

### ❌ `Error: SESSION_SECRET must be set (>= 32 chars). See .env.example.`

- **When:** Runtime, on the first request that touches a session.
- **Cause:** `.env` is missing, `SESSION_SECRET` is empty, or it's shorter than 32 chars.
  `src/lib/auth/session.ts` throws to refuse running with a weak/absent key.
- **Solution:** `cp templates/.env.example .env`, then set
  `SESSION_SECRET=$(openssl rand -hex 32)`. Restart the dev server.
- **Prevention:** Keep `.env` out of source control (it's git-ignored) but document the var;
  never default it to a hardcoded value.
- **Debug tip:** `node -e "console.log((process.env.SESSION_SECRET||'').length)"` after
  sourcing `.env` to confirm length ≥ 32.

---

### ❌ Native module error: `invalid ELF header` / `was compiled against a different Node.js version`

- **When:** Dev or build time, usually right after switching Node versions or moving
  `node_modules` between a host and a container.
- **Cause:** `better-sqlite3`, `sharp`, and `@node-rs/argon2` are native addons built against a
  specific Node ABI. The prebuilt binary no longer matches your runtime.
- **Solution:** `rm -rf node_modules package-lock.json` is **not** needed — keep the lockfile;
  run `rm -rf node_modules && npm install` to fetch/rebuild for the current Node.
- **Prevention:** Use **Node 22** locally (matches `node:22-alpine`). Never copy `node_modules`
  into the Docker image — the Dockerfile installs them inside the build stage.
- **Debug tip:** `node -p "process.versions.modules"` shows the ABI version; compare host vs
  container.

---

### ❌ Schema change has no effect / `no such column` at runtime

- **When:** Dev time, after editing `src/db/schema.ts`.
- **Cause:** Drizzle does not auto-sync the schema. The running DB still has the old shape
  because no migration was generated/applied. Migrations apply on **boot**, not on file save.
- **Solution:** `npm run db:generate` to create a migration in `drizzle/`, then restart
  `npm run dev` (boot runs `migrateAndSeed()`). For a throwaway local DB, delete
  `./data/kittens.db*` and reboot.
- **Prevention:** Treat `schema.ts` edit → `db:generate` → restart as one ritual. Commit the
  generated SQL alongside the schema change.
- **Debug tip:** Inspect applied migrations:
  `sqlite3 data/kittens.db "select * from __drizzle_migrations;"`.

---

### ❌ `UNIQUE constraint failed: kittens.shelter_number`

- **When:** Runtime, creating/editing a kitten (also applies to `users.username`,
  `schedule_templates.vaccine_type`, `alert_settings.key`).
- **Cause:** A unique index rejects a duplicate value. better-sqlite3 surfaces it as a thrown
  `Error` with that message — it is *expected* user-input contention, not a bug.
- **Solution:** Catch it in the action and return a friendly `FormState` error rather than
  letting it 500. The kitten action already does this via `isUniqueShelterNumberError()`.
- **Prevention:** Wrap inserts/updates that hit unique columns in `try/catch` and map the
  constraint to a field-level message.
- **Debug tip:** `grep -n "UNIQUE constraint" src` to see which paths already handle it.

---

### ❌ Photo upload rejected or 500s during processing

- **When:** Runtime, on upload.
- **Cause:** One of: file isn't actually an image (magic-byte sniff fails — extension is
  ignored), exceeds the 15 MB cap, is a HEIC that failed to decode, or `PHOTOS_PATH` isn't
  writable.
- **Solution:** Confirm the file is a real JPEG/PNG/WebP/HEIC and under 15 MB. Ensure
  `PHOTOS_PATH` (and its parent) exists and is writable; in Docker that's the `/photos` volume.
- **Prevention:** Surface the validation reason to the user; keep the `/photos` volume mounted
  and owned by the runtime user (uid 1000 in the image).
- **Debug tip:** Re-encode failures usually originate in `src/lib/photo-storage.ts`; log the
  `sharp`/`heic-convert` error there. Check disk space with `df -h`.

---

### ❌ Redirected to `/login` immediately, or `/api/*` returns `401 Unauthorized`

- **When:** Runtime, accessing a protected page or API route.
- **Cause:** No `kitten_session` cookie present, so `src/proxy.ts` redirects pages to `/login`
  and answers API routes with 401. Or the cookie exists but its token no longer validates
  (expired/invalidated session) → `requireUser()` redirects.
- **Solution:** Log in again. If it happens right after login, your `SESSION_SECRET` likely
  **changed between requests** — changing it invalidates every existing session's HMAC.
- **Prevention:** Keep `SESSION_SECRET` stable across restarts and environments (set it once in
  `.env`/compose). Don't regenerate it casually.
- **Debug tip:** Check the cookie in DevTools → Application → Cookies for `kitten_session`.
  Inspect sessions: `sqlite3 data/kittens.db "select id, expires_at from sessions;"`.

---

### ❌ Login returns "Too many attempts" unexpectedly

- **When:** Runtime, during development/testing of the login flow.
- **Cause:** The per-IP rate limit (5 attempts / 15 min) in `src/lib/auth/rate-limit.ts`
  tripped — often from repeated test logins or an e2e run.
- **Solution:** Wait out the window, or in dev clear the limiter state (restart the server if
  it's in-memory). Each attempt is also in `audit_log` for inspection.
- **Prevention:** In e2e/dev seeds, use the correct password first time; don't loop bad logins.
- **Debug tip:**
  `sqlite3 data/kittens.db "select at,action,username,ip from audit_log where action like 'login%' order by id desc limit 20;"`.

---

### ❌ Following public Next.js docs leads to wrong APIs

- **When:** Dev time, writing routing/data-fetching/config code.
- **Cause:** This repo uses a **customized Next.js build** with breaking changes from the
  public release (see [AGENTS.md](../AGENTS.md)).
- **Solution:** Read the bundled guide in `node_modules/next/dist/docs/` for the feature you're
  touching before writing code; heed deprecation notices.
- **Prevention:** Default to the in-repo docs over training-data/Stack-Overflow memory for
  anything Next.js-specific.
- **Debug tip:** `ls node_modules/next/dist/docs/` to find the relevant guide.
