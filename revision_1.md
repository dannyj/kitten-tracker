# Claude Code Handoff — Kitten Tracker, Revision Round 1: UI Fixes & Polish

## Objective

A round of fixes and refinements based on real use of the app. Six items: one bug, three UX improvements, one export enhancement, and a styling pass. None of these change the data model — they're behavioural and presentational.

## Prerequisites

App is built and running (steps 1–7). This is iterative refinement on the existing codebase, not new feature scaffolding.

---

## Item 1 — Bug: kitten row not opening reliably (priority)

**Symptom:** From the Kittens tab, clicking a kitten in the list often doesn't open its detail page. It takes several clicks, and only clicking toward the left-hand side of the row seems to register. Looks like a minor GUI/hit-target issue.

**Likely cause to investigate:** the clickable area probably isn't the full row — only part of it (e.g. the name cell or an inner element) carries the navigation handler, or an overlay/element is intercepting clicks across the rest of the row. Possibly an `<a>` wrapping only the text while the row padding is dead space, or a z-index/pointer-events conflict.

**Fix:** make the **entire row** a single, reliable click/tap target that navigates to the kitten detail page. The whole row should be one consistent hit area — no dead zones, works on first click anywhere along the row. Keep any per-row action controls (if present) as explicit buttons that stop propagation, so they don't fight the row navigation.

**Acceptance:** clicking/tapping anywhere on a kitten row opens that kitten on the first click, on both desktop and a 390px phone viewport.

---

## Item 2 — Cover photo in kitten detail view

When viewing an individual kitten, show that kitten's **cover photo** (the one selected in step 6) prominently in the detail header — alongside name, age, status badge, etc.

- Use the cover photo; fall back to most-recent photo if no cover is set; show a tasteful placeholder (e.g. a paw/silhouette) if the kitten has no photos yet
- Purpose is twofold: quick visual identification of which kitten you're looking at, and it personalizes/warms up the page
- Served through the existing authenticated image route (step 6) — don't introduce a public image path
- Use the thumbnail/appropriately-sized version, not the full-resolution image, for header performance

**Acceptance:** kitten detail header shows the cover photo (or fallback), loads from the authenticated route, looks good at 390px and desktop.

---

## Item 3 — Hide weight edit/delete controls behind a dedicated view

In the kitten detail view, the per-entry edit and delete buttons on weights are visual clutter — correcting or deleting a weight is rare.

- On the kitten detail page, the weights section should be **read-focused**: the chart, the trend, and the recent entries, plus the quick-add (logging is frequent, so keep that fast and visible). No per-row edit/delete buttons here.
- Move edit/delete into a **separate "manage weights" view** (e.g. a "Manage entries" link/button from the weights section) that lists all entries with the edit/delete controls. The existing 15-minute edit window rule still applies there.
- This pattern is worth applying consistently if cheap: feeding and vaccination logs have the same "log often, edit rarely" shape. Apply the same treatment to those if it's low-effort; if not, weights only for this round and note it.

**Acceptance:** kitten detail weights section shows chart + entries + quick-add but no inline edit/delete; a dedicated manage view exposes edit/delete and honors the edit-window rule.

---

## Item 4 — Vet export: include graphs and full weight data

The shelter/vet medical export (step 5) should also carry the growth picture, not just the vaccination summary.

- Add to the export: the **growth chart** (weight over time with the reference band) as an image in the PDF, and a **full weight data table** (every entry: date, weight, note) so the vet has the raw numbers
- Per-litter export: include each kitten's chart + weight table in their section
- Rendering the chart into the PDF: render server-side to a static image (PNG/SVG→PNG) and embed it — don't rely on a browser. Keep the **plain-fonts / no-emoji** rule from step 5 intact for any chart labels.
- Keep the existing default: medical data only, **no adopter PII** unless the admin-only opt-in is selected

**Acceptance:** per-kitten and per-litter exports include a readable growth chart image and a complete weight table; PDF renders without font/emoji failures; no adopter PII by default.

---

## Item 5 — Styling pass: more colour, academic-professional vibe

The app should keep its professional feel but carry **more colour** and a more distinctive, academic/stylish character — something that stands out rather than looking like a default template.

- **More colour, used with restraint:** introduce a richer accent palette beyond the current neutrals — but keep semantic colours (OK / warning / urgent) clearly reserved and unambiguous, never competing with decorative colour. Decorative accent ≠ status colour.
- **Direction:** "academic / professional but stylish" — think a considered editorial or scholarly feel. A serif for headings paired with a clean sans for UI/body tends to read academic without looking stuffy.
- **Typography:** the user likes the Anthropic/Claude typographic feel. Those exact faces (Styrene / Tiempos) are proprietary and can't be bundled. Use freely-licensable substitutes that evoke the same character:
  - Body/UI sans: **Inter** (clean, neutral, close to the Anthropic UI feel)
  - Heading serif: **Source Serif 4** or **Lora** for the academic/editorial note
  - Self-host the font files (don't hotlink Google Fonts) so this stays consistent and works when the app is offline/internal. If the user later supplies licensed font files, they can be swapped in.
- Apply consistently via the existing design tokens/system from step 7 — update the palette and type scale centrally, not per-component
- Preserve accessibility: contrast ratios stay compliant, status is never colour-only (icon/label remains)

**Acceptance:** the app reads as more colourful and distinctive while staying professional; serif headings + Inter body applied app-wide via tokens; fonts self-hosted; semantic status colours still unambiguous; contrast remains accessible.

---

## Out of scope

No data-model changes, no new entities, no internet-exposure changes. If any item turns out to need a schema tweak (shouldn't), flag it rather than improvising.

## Reference

- Project plan: `tracker_plan.md`
- Step 1–7 handoffs (esp. step 5 for export, step 6 for photos/cover, step 7 for design tokens)
