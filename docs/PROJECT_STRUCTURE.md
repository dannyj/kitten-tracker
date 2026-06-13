# Project Structure

A map of the repository for a developer seeing it for the first time. See
[ARCHITECTURE.md](ARCHITECTURE.md) for *how* these pieces interact and
[GLOSSARY.md](GLOSSARY.md) for unfamiliar terms.

## Directory tree

```
kitten_app/
├── src/
│   ├── app/                      # Next.js App Router — routes are folders
│   │   ├── (app)/                # Authenticated app (route group, no URL segment)
│   │   │   ├── kittens/          #   kitten list, detail, edit, sub-logs
│   │   │   ├── litters/          #   litters + batch "weigh litter" flow
│   │   │   ├── mothers/          #   mothers + health log
│   │   │   ├── alerts/           #   cross-kitten alert overview
│   │   │   ├── viewings/         #   adoption viewing visits
│   │   │   ├── settings/         #   alert thresholds + schedule templates (admin)
│   │   │   ├── actions.ts        #   shared server actions
│   │   │   ├── layout.tsx        #   app shell + nav (auth-guarded)
│   │   │   └── page.tsx          #   Dashboard (the at-a-glance home)
│   │   ├── api/                  # Route handlers (non-page HTTP)
│   │   │   ├── health/           #   GET /api/health — DB ping, only public route
│   │   │   └── photos/           #   upload + authenticated image serving
│   │   ├── export/               # Print pages + PDF route handlers (pdfkit)
│   │   ├── login/                # Login page + server action (public)
│   │   ├── layout.tsx            # Root layout (html/body, CSP nonce)
│   │   ├── error.tsx             # Global error boundary (no stack-trace leak)
│   │   └── globals.css           # Tailwind entrypoint
│   ├── components/               # Reusable React components
│   │   └── ui/                   #   shadcn/ui primitives (button, dialog, …)
│   ├── db/                       # Database layer
│   │   ├── schema.ts             #   Drizzle table defs — the source of truth
│   │   ├── index.ts              #   singleton DB connection (WAL, FKs on)
│   │   ├── migrate.ts            #   migrateAndSeed() — runs on every boot
│   │   └── types.ts              #   inferred row types (Kitten, Mother, …)
│   ├── lib/                      # Pure / framework-free domain logic
│   │   ├── auth/                 #   session, guard, password, rate-limit
│   │   ├── alerts.ts             #   neonatal growth alert engine (+ .test.ts)
│   │   ├── feeding.ts            #   feeding-due math (+ .test.ts)
│   │   ├── schedule.ts           #   vaccination schedule templates (+ .test.ts)
│   │   ├── growth.ts             #   growth-curve helpers
│   │   ├── photo-storage.ts      #   sharp re-encode + safe file handling
│   │   ├── export-pdf.ts         #   pdfkit document builder
│   │   ├── audit.ts              #   audit_log writer
│   │   └── constants.ts          #   edit windows, weight/feed bounds
│   ├── types/                    # Ambient .d.ts (e.g. heic-convert)
│   ├── instrumentation.ts        # Next.js boot hook → migrateAndSeed()
│   └── proxy.ts                  # Edge auth gate + Content-Security-Policy
├── drizzle/                      # Generated SQL migrations + snapshots
├── scripts/                      # Ops: backup.sh, restore.sh, create-user.cjs
├── public/                       # Static assets
├── e2e-step*.mjs                 # Playwright end-to-end suites
├── seed-step*.cjs                # Dev data seeders
├── Dockerfile                    # Multi-stage node:22-alpine build
├── docker-compose.yml            # Service + volumes + hardening
├── drizzle.config.ts             # drizzle-kit config
├── next.config.ts                # Next config + security headers
├── AGENTS.md                     # ⚠️ "This is NOT the Next.js you know"
└── templates/.env.example        # Config template (copy to .env)
```

## Why it's organized this way

- **Routes mirror the domain.** Each top-level feature (kittens, litters, mothers) is a
  folder under `src/app/(app)/`, co-locating its pages, server actions, and feature-specific
  components. You rarely jump far to find a feature's code.
- **`src/lib` is framework-free on purpose.** Alert, feeding, and schedule logic have zero
  Next.js or DB imports, so they can be unit-tested with Node's type-stripping (`npm run test`)
  and reused on both server and client. Business rules don't leak into UI files.
- **`src/db/schema.ts` is the single source of truth.** Table definitions, enums, and row
  types all derive from it; migrations are generated from it.

## Key files at a glance

| File | Role |
|---|---|
| `src/db/schema.ts` | Every table, enum, and relationship. Change here, then `npm run db:generate`. |
| `src/proxy.ts` | First code each request hits: optimistic cookie check + CSP header. |
| `src/lib/auth/guard.ts` | `requireUser()` / `requireAdmin()` — gate every action and protected loader. |
| `src/lib/auth/session.ts` | Token generation, HMAC hashing, validation, cookie management. |
| `src/instrumentation.ts` | Applies migrations + seeds defaults on server start. |
| `src/lib/alerts.ts` | Pure growth-alert engine — the clinical-ish heart of the app. |
| `src/lib/constants.ts` | Edit windows and weight/feed validation bounds. |

## Import patterns

The `@/` alias maps to `src/` (see `tsconfig.json`). Use it for cross-directory imports;
relative paths only within the same feature folder.

```typescript
// Database + inferred types
import { db } from "@/db";
import { kittens, KITTEN_STATUSES } from "@/db/schema";
import type { Kitten } from "@/db/types";

// Auth guards (server-only)
import { requireUser, requireAdmin } from "@/lib/auth/guard";

// Pure domain logic
import { evaluateAlert } from "@/lib/alerts";
import { FEEDING_MAX_ML } from "@/lib/constants";

// UI primitives
import { Button } from "@/components/ui/button";

// Within the same feature folder, relative is fine:
import { kittenSchema } from "./actions";
```

Server-only modules (`session.ts`, `guard.ts`) start with `import "server-only";` so a
client component importing them fails the build instead of leaking secrets to the browser.
