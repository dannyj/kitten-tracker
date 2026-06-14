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
- **Parity over persistence:** match production's *config* (the standalone image,
  `TZ=UTC`, env) rather than standing up a long-lived second server. Anything
  timezone-, locale-, or env-sensitive must be exercised under that config.
- New time-bearing inputs or server actions need an e2e that runs under
  `verify-prod.sh` (server/browser timezones differ), or the regression is invisible.
