# Dependency security review

Date: 2026-11-08. Tracking: [GitHub issue #1](https://github.com/dannyj/kitten-tracker/issues/1).

This review covers the source dependencies and the production image definition. It does not include an attack test against production.

## Changes

The dependency updates include Next.js and `eslint-config-next` 16.4.5, Sharp 0.35.5, Zod 4.6.7, and shadcn 4.23.0. The PostCSS override now selects 8.5.32. Compatible transitive updates include `brace-expansion` 1.1.21 and `js-yaml` 4.3.2.

Next.js 16.4.5 fixes the applicable Server Actions denial of service advisory. This application uses App Router and Server Actions. The [vendor advisory](https://github.com/vercel/next.js/security/advisories/GHSA-p3m5-59mp-jv5r) describes the affected request path.

The lockfile resolves the direct Sharp dependency and the Next.js Sharp dependency to 0.35.5. The lockfile no longer contains the affected Next.js or Sharp versions.

## Production reachability

The [SVG image advisory](https://github.com/vercel/next.js/security/advisories/GHSA-2464-fhr4-w9xw) specifies glibc-based Linux as a condition for remote code execution. The production Dockerfile uses `node:22-alpine` in all stages. Alpine uses musl, so this image does not meet that platform condition. This conclusion comes from the image definition, not an inspection of the production host.

The dependency updates remove the affected versions regardless of this platform difference. Other advisories, including the Server Actions advisory, do not depend on glibc.

## Remaining audit findings

The initial `npm audit` reported 32 affected packages: 2 critical, 13 high, 16 moderate, and 1 low. After the updates, it reports 13 affected packages: 11 moderate and 2 low. These packages share two advisory roots. The counts do not represent 13 separate application flaws.

| Advisory root                                                                                 | Dependency path                                                                                               | Impact assessment                                                                                                                                                                             |
| --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`minimatch` glob amplification](https://github.com/advisories/GHSA-g3hv-75wg-m249), moderate | `eslint-config-next` → TypeScript ESLint → `minimatch` 10.2.6. Also shadcn → `ts-morph` → `minimatch` 10.2.6. | These tools process source files and glob patterns. The application source does not import these tools into request handlers. Untrusted tool inputs remain a possible denial of service risk. |
| [`deepmerge` prototype poisoning](https://github.com/advisories/GHSA-gcqx-w48m-w2h4), low     | shadcn and `@shadcn/registry` → `deepmerge` 4.3.1.                                                            | The application imports `shadcn/tailwind.css` in `src/app/globals.css`. It does not import the CLI or registry JavaScript. Untrusted registry input remains a risk for CLI use.               |

The remaining shadcn packages appear in the production dependency tree because shadcn supplies the CSS import. Their presence does not establish a reachable HTTP request path. This assessment covers the current source imports.

The patched `minimatch` release requires major version 11, outside the parent dependency constraints. An override across that major version needs separate compatibility checks. The latest `deepmerge` release remains 4.3.1 and has no patched release.

The audit suggests forced downgrades to shadcn 1.0.0 and `eslint-config-next` 15.5.29. Those changes break the current major versions and do not provide a suitable framework update.

## Follow-up

Use trusted source files and registry inputs for the affected tools. Reassess these findings after the parent tools publish compatible fixes.

Before deployment, do `./verify-prod.sh all` with synthetic data. A passing development server does not replace this required production parity check.

## Verification results

Checks used an isolated temporary source copy and a fresh installation of the lockfile. The original installation stalled during operating system file reads. No production data was used.

- Standalone build: passed with Next.js 16.4.5.
- Type checking: passed.
- Unit tests: all 40 passed, including eight login/audit tests and four calendar tests.
- Backup permissions and archive-error test: passed with a Docker substitute and synthetic files. A real Docker backup and restore remains untested.
- Full lint: passed with three existing unused-variable warnings in `style_guide/build-style-guide.js`. The configuration permits CommonJS in that standalone Node.js script.
- Production parity: all 11 suites passed with server UTC and browser Europe/Amsterdam: `step2`, `step3`, `step4`, `step5`, `step6`, `step7`, `rev1`, `rev3`, `rev4`, `security`, and `calendar`.
- The `security` suite tests changing forwarding headers and alternate Server Action paths.
- The `calendar` suite fixes the clocks at 23:30 UTC, when Amsterdam is already on the next date. It checks age and medical dates for kittens and mothers. Local today succeeds; tomorrow remains rejected by the server.

Date-only values and ages now use the Amsterdam calendar on both server and browser. Age counts calendar days across daylight-saving changes. Photo age warnings use the same rule. Tests wait for initialized fields and completed actions before checking their results.

The browser default now uses Europe/Amsterdam. Europe/London shares the server's UTC offset in winter and can hide timezone errors.

Production still needs the documented NPM request limit and daily audit-maintenance schedule. Existing backup permissions also need the documented operator checks. These host changes were not applied.
