# Mobile release: agent task briefs

These briefs implement [the release specification](MOBILE_RELEASE_SPEC.md). They do not authorize deployment.

## Shared instructions

Read `AGENTS.md` and the release specification before work.

This repo uses a customized Next.js build. Read the relevant guide in `node_modules/next/dist/docs/` before implementation.

Use synthetic data only. Preserve server access checks, validation, timezone behavior, and existing medical and adoption rules.

Do not add dependencies without a concrete requirement and lead review. Do not add notifications, offline writes, or a mobile API.

Before edits, fetch remote refs and establish repository freshness. If the branch is behind and dirty, ask before pulling.

Do not stash, reset, or discard existing changes. Report baseline failures separately from new failures.

The lead assigns a separate branch and worktree to each task agent. All worktrees start from the same recorded base revision.

Use these suggested branch names:

- Lead: `mobile/release-1`
- Installation: `mobile/installation`
- Mobile interface: `mobile/interface`
- Verification: `mobile/verification`

The file scopes in this document are proposals. The lead records exact ownership before implementation starts.

If another agent owns a required file, send the lead a proposed change. Do not edit that file directly.

Do not run concurrent builds or verification servers on the same port. The production harness uses port 3100 and shared temporary logs.

Each handoff must include:

- Base revision and result revision, or an exact changed-file list for uncommitted work.
- Changed behavior and file paths.
- Acceptance IDs covered.
- Commands run, results, and baseline failures.
- Pending device checks and known limitations.
- Shared-file requests and integration dependencies.

## Brief 1: Lead agent

### Task

Coordinate release 1 and deliver one reviewed change that satisfies M01 through M13.

### Ownership

- These two planning documents and the release report.
- `src/proxy.ts` and `next.config.ts` for required integration changes.
- Shared-file conflicts, branch integration, and final acceptance decisions.
- `AGENTS.md` only when an implemented change triggers its update rules.

### Procedure

1. Record the base revision and existing local changes.
2. Create isolated worktrees without copying user changes or private data.
3. Assign exact file ownership and send each agent its brief.
4. Record the manifest URL and public asset paths with the installation agent.
5. Apply exact public-path exceptions in the proxy.
6. Review connection behavior and private response headers.
7. Combine task branches sequentially.
8. Resolve conflicts through file owners without discarding unrelated changes.
9. Run the integrated checks from the release specification.
10. Complete the device matrix with the verification agent.
11. Write `docs/MOBILE_RELEASE_REPORT.md` with evidence and remaining limitations.

### Completion

All acceptance IDs have evidence. No device result relies only on browser emulation.

The release report identifies the combined revision and gives an explicit ready or incomplete result.

Do not deploy as part of this brief.

## Brief 2: Installation agent

### Task

Make the existing web app installable with the correct identity and standalone display.

### Proposed file scope

- New `src/app/manifest.ts`.
- `src/app/layout.tsx` for metadata and viewport settings.
- New installation icons under `public/` or the supported Next.js metadata conventions.
- New `docs/MOBILE_INSTALL.md` for user instructions.

The lead owns proxy and header changes. The mobile interface agent owns application navigation.

### Procedure

1. Read the local PWA and manifest guides from the release specification.
2. Reuse the existing Kitten Tracker brand assets.
3. Define the app name, stable identity, start URL, scope, colors, and standalone display.
4. Supply appropriate raster icons, including an Apple touch icon and an Android maskable icon.
5. Preserve user zoom and accessible viewport behavior.
6. Send exact manifest and asset paths to the lead.
7. Write installation and removal instructions for both phone types.
8. Explain the server connection and VPN requirements.
9. Record the metadata and HTTP checks.

Do not add a service worker or an application-managed cache.

### Completion

Provide evidence for M01 and the automated part of M02. Support real-device M02 and M03 checks.

The manifest and icons remain available before login. Protected pages remain protected.

Installation instructions explain online use without promising offline startup or store distribution.

## Brief 3: Mobile interface agent

### Task

Make existing care workflows usable in the installed phone interface.

### Proposed file scope

- `src/components/app-shell.tsx` and `src/components/app-nav.tsx`.
- `src/app/globals.css`.
- New connection-status component under `src/components/`.
- Specific presentation components that the lead assigns after the initial review.

The installation agent owns `src/app/layout.tsx`. Server Actions, database files, and application rules remain outside this task.

### Procedure

1. Review the existing interface at 360px and 390px viewport widths.
2. Record specific problems before changing components.
3. Request ownership of additional presentation files from the lead.
4. Correct navigation, touch controls, overflow, and safe-area spacing.
5. Preserve chart data and existing form contracts.
6. Add an accessible connection message for connection loss during an open session.
7. Keep form success messages dependent on server results.
8. Prevent automatic resubmission after a connection error.
9. Send required action-error changes to the lead.
10. Record keyboard and device checks that require a real phone.

The browser connection flag does not prove server reachability. Do not label pending writes as saved.

### Completion

Provide evidence for M04, M06, M09, and M10. Support M05, M07, and M08 checks.

The interface preserves desktop use and keyboard access. It does not add local record storage or queued submissions.

## Brief 4: Verification agent

### Task

Prove installation, phone workflows, access controls, and production behavior through recorded evidence.

### Proposed file scope

- New `e2e-mobile.mjs`.
- New `seed-mobile.cjs`, or reuse documented existing synthetic seeds.
- `verify-prod.sh` for the mobile target and seed mapping.
- New `docs/MOBILE_TEST_MATRIX.md`.

Application fixes belong to their file owners. Send reproducible failures to the lead.

### Procedure

1. Prepare cases for M01 through M13 before interface integration.
2. Use the current e2e scripts and seeds as the implementation pattern.
3. Cover representative successful writes for weights, feeds, and both medical subject types.
4. Assert persisted results, rather than only success messages.
5. Cover login, logout, viewer restrictions, and anonymous manifest access.
6. Cover connection loss and submission uncertainty without automatic retries.
7. Add the mobile target to `seed_for` and `ALL_TARGETS`.
8. Run the mobile target against the integrated standalone build.
9. Give the lead the test results for the final full-suite run.
10. Record installation, keyboard, safe-area, photo, and PDF results from real devices.

### Device matrix

| Environment                                    | Required checks                                            | Initial status |
| ---------------------------------------------- | ---------------------------------------------------------- | -------------- |
| Browser, 360px and 390px widths                | Forms, navigation, charts, access, connection errors       | Pending        |
| Real iPhone, Safari and home-screen app        | Installation, sessions, keyboard, photos, PDFs, safe areas | Pending        |
| Real Android phone, Chrome and home-screen app | Installation, sessions, keyboard, photos, PDFs, safe areas | Pending        |
| Desktop browser                                | Existing workflows and layout                              | Pending        |
| Standalone server in UTC                       | Full production suite with a different browser timezone    | Pending        |

Record OS versions, browser versions, revision, synthetic fixtures, and results in `docs/MOBILE_TEST_MATRIX.md`.

If devices are unavailable, report the missing checks to the lead. Keep their status pending.

### Completion

The mobile target runs through the production harness. The test matrix distinguishes automated evidence from real-device evidence.

Every failed case includes reproduction steps. The verification agent does not mark the release ready independently.
