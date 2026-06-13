Claude Code Handoff — Kitten Tracker, Step 7 (Final): Dashboard Polish & Hardening
Objective
Tie the app together with a polished dashboard, do a full security-hardening pass, and make it genuinely ready to face the internet when you choose to. "Done" means: the dashboard is the one screen that answers "what needs my attention right now" across the whole litter; the visual design is modern and consistent; backups exist; and there's a documented, tested path to exposing the app safely from outside the LAN.
Prerequisites
Steps 1–6 complete: auth, CRUD, status pipeline, weights/charts/alerts, feeding, vaccinations/export, photos. All feature surfaces exist; this step refines and hardens rather than adding new entities.
Tasks
1. Dashboard — the unified "attention" view
Bring the panels built across earlier steps into one coherent landing page, ordered by urgency:
	•	Alert center (step 3): kittens with weight warnings/urgent, urgent pinned
	•	Feeding due (step 4): active hand-fed kittens by soonest-due, overdue pinned
	•	Medical due (step 5): upcoming/overdue vaccinations & deworming
	•	Active litter overview: each active kitten as a card with cover photo (step 6), name, age, last weight + trend arrow, status badge, next feed countdown if hand-fed
	•	Empty states that are friendly, not broken, when there are no active kittens
	•	The whole thing readable at a glance on a phone — this is the screen you'll open most
2. Visual design pass (modern, sleek, professional — per the brief)
	•	Consistent design system: spacing scale, typography, a restrained colour palette with clear semantic colours for OK / warning / urgent (don't rely on colour alone — pair with icon/label for accessibility and colour-blind users)
	•	Charts kept clean and uncluttered (step 3 already aims for this — ensure consistency across all charts)
	•	Consistent component patterns: cards, badges, log lists, quick-add forms should look and behave the same everywhere
	•	Dark mode is a nice-to-have, not required; if trivial with the chosen stack, include it
	•	Polish empty/loading/error states app-wide so nothing looks half-built
3. Security hardening pass (audit everything built so far)
Go back over every step and confirm:
	•	Every mutation Zod-validated server-side; no endpoint trusts client input
	•	Authorization on every route, not just authentication — adopter PII and admin settings are admin-only and that's enforced server-side, not just hidden in UI
	•	Upload pipeline (step 6): content-sniff, re-encode-always, authenticated serving, path-traversal guard, GPS stripped — re-verify
	•	Security headers complete: CSP tightened (no unsafe-inline where avoidable), X-Content-Type-Options, Referrer-Policy, frame-ancestors 'none', Permissions-Policy. HSTS ready to enable once certs are stable.
	•	Session cookies httpOnly/secure/sameSite; login rate-limited; consider lockout/backoff on repeated failures
	•	Errors don't leak stack traces or internals to the client in production
	•	Dependencies: npm audit clean, versions pinned, base image current, container runs non-root with a read-only filesystem except /data and /photos
	•	Add basic security/audit logging: login success/failure, adopter-PII access, exports generated — written somewhere durable
4. Backups & data safety
	•	Documented, automated backup: SQLite file + photos volume. SQLite makes this a copy (use the SQLite online-backup API or VACUUM INTO, not a naive cp of a live DB file) on a cron schedule, plus the photos directory.
	•	Document a tested restore procedure — a backup you haven't restored from isn't a backup
	•	Note retention (e.g. keep N daily, M weekly) and where backups live (ideally off the server)
5. Internet-exposure readiness (document + prepare, don't flip it on)
Produce a clear runbook for when you decide to expose it:
	•	Router: forward only 443 to the server; NPM admin (81) stays LAN-only; no port 80 exposed
	•	NPM: valid cert (DNS-01 Let's Encrypt with your domain so nothing's exposed during issuance), force SSL, HSTS on, HTTP/2
	•	Add rate limiting / brute-force protection at the proxy layer in front of login
	•	ufw rules reviewed: 443 open as needed, 81 restricted to your admin IP, default deny inbound
	•	Strong recommendation documented: put it behind a VPN (e.g. WireGuard/Tailscale) or your existing reverse-proxy auth rather than exposing the login form raw to the internet — for a small personal app holding adopter PII, a VPN is the lower-risk default and costs almost nothing to run. Direct exposure is viable but only with the rate-limiting, strong-password, and monitoring pieces all in place.
	•	A pre-exposure checklist the foster ticks off before opening the port
6. Final acceptance & docs
	•	README updated: architecture, run/deploy, backup/restore, the exposure runbook, and an admin-tasks section (create user, edit alert/schedule settings)
	•	A short "first run" guide: create admin → add mother → litter → kittens → start logging
Acceptance criteria
	1	Dashboard surfaces alerts, feeding-due, medical-due, and the active litter in one screen, urgency-ordered, usable at 390px
	2	Semantic states never rely on colour alone (icon/label present); contrast is accessible
	3	Hardening checklist fully verified: a non-admin session cannot reach adopter PII or settings via direct API call (test it, don't assume)
	4	Upload re-verified: renamed non-image rejected, stored file carries no original EXIF/GPS, image route requires a session
	5	Automated backup runs and a restore into a clean container reproduces all data + photos (actually perform the restore test)
	6	Security headers present and CSP has no avoidable unsafe-inline; production errors show no stack traces
	7	npm audit clean; container runs non-root with read-only FS except volumes
	8	Exposure runbook exists and is accurate against the actual compose/NPM setup; nothing is exposed yet
	9	TypeScript strict + lint pass across the whole project
Out of scope
New entities or features; push notifications; multi-tenant/multi-household support; any send-to-shelter integration. This step is polish, hardening, and operational readiness only.
Reference
	•	Project plan: tracker_plan.md
	•	Step 1–6 handoffs
A note on the exposure decision
The brief wants this internet-reachable eventually, and that's achievable — but the honest recommendation is to reach it through a VPN rather than by publishing the login form to the open web. The app will hold adopter names, phone numbers, and addresses; that's real PII, and a personal-scale app is a soft target for credential-stuffing and bot traffic the moment it's public. A VPN (Tailscale/WireGuard) gives you the same remote access with almost none of that exposure, for near-zero effort. If you do want direct public access, it's defensible — but only with rate limiting, strong unique passwords, monitoring, and the full hardening pass above all in place first, not as a "turn it on now, harden later." Either way, the architecture from step 1 (app behind NPM, no published port) means this is a configuration decision, not a rebuild.
