Claude Code Handoff — Kitten Tracker, Step 5: Vaccinations & Shelter Export
Objective
Build the inoculation/medical record per kitten plus an exportable medical summary to hand back to the shelter. "Done" means: I can log each vaccination and deworming with batch numbers, see what's upcoming or overdue per kitten and across the litter, and generate a clean per-kitten (or whole-litter) medical summary as a PDF/print view that the shelter can file.
Prerequisites
Steps 1–4 complete: auth, schema, CRUD, status pipeline, weights/charts/alerts, feeding module. The vaccinations table exists (type, given_at, batch_number, administered_by, next_due_date, note). The kitten detail page has a "coming soon" vaccinations placeholder — replace it.
Tasks

1. Vaccination / medical log (per kitten)
   • Quick-add on the kitten detail page: type, date given (default today), batch/lot number, administered by (free text — vet name or "self"), next due date (optional), note
   • type as a selectable list with free-text fallback, seeded with common entries: FVRCP, deworming, flea treatment, rabies, FeLV, vet check, other
   • Entries listed newest-first, grouped or filterable by type
   • Same append-only + 15-minute edit window as other logs; this is a medical record going back to the shelter, so integrity matters — corrections after the window are new entries with a visible "corrects entry of [date]" note rather than silent edits
2. Schedule templates & due tracking
   • Editable default schedule templates (store as config, seed sensible defaults; do not hardcode in components):
   ◦ FVRCP: first ~6–8 weeks, boosters every 3–4 weeks until ~16 weeks
   ◦ Deworming: ~2, 4, 6, 8 weeks
   ◦ Flea treatment: per product, age-dependent
   • These templates suggest next-due dates when logging (prefill the next_due_date) and drive the "upcoming/overdue" view — they do not auto-create records. The foster always confirms what actually happened.
   • Per-kitten medical timeline: what's been given, what's suggested next based on age + template, what's overdue
   • Frame templates as general guidance, with a clear line that the shelter's/vet's actual protocol takes precedence over the app's defaults
3. Dashboard medical panel
   • "Medical due" section: active kittens with vaccinations/deworming upcoming (e.g. within 7 days) or overdue, overdue pinned and in warning color
   • Each row: kitten, item, due date / days overdue, one-tap to log it
   • Sits alongside the feeding-due and alert panels from steps 3–4
4. Shelter medical export (the key deliverable)
   • Generate a clean medical summary, per kitten and per litter (one document covering all siblings)
   • Contents per kitten: name, shelter number, sex, birth date, current age, status; full vaccination/deworming history with dates + batch numbers + administered by; current weight and a small growth summary (birth weight → latest, avg gain); any flagged medical notes
   • Two output paths:
   ◦ Print view: a clean, print-stylesheet HTML page (works everywhere, no dependency risk)
   ◦ PDF: server-side generated. Use a well-maintained library; plain fonts only, no emoji glyphs (emoji in standard PDF fonts cause rendering failures — avoid them entirely in the export)
   • Export is generated on demand from live data — no stored/stale copies. Header includes generation date and the foster's identity.
   • Exports may contain adopter PII only if explicitly included; default the medical export to kitten medical data only, no adopter contact details, with adopter info as an opt-in section (admin role only) to avoid handing PII around unnecessarily.
5. Validation & security
   • Batch number is free text but length-bounded and trimmed; dates validated (given_at not in the future beyond today; next_due_date after given_at)
   • All mutations Zod-validated server-side; export routes require a session; the adopter-PII opt-in section is admin-only and logged
   • PDF generation must not interpolate unescaped user input into any markup/template that could execute — treat all fields as untrusted text
   Acceptance criteria
   1 A vaccination logs with batch number and administered-by; appears newest-first in the kitten's medical log
   2 Logging an FVRCP prefills a sensible next-due date from the template; editing templates in settings changes future suggestions
   3 Per-kitten medical timeline shows given/suggested/overdue correctly against the kitten's age
   4 Dashboard medical panel lists due/overdue items for active kittens, overdue pinned, one-tap log works
   5 Per-kitten export and per-litter export both generate; print view and PDF both render correctly with batch numbers and growth summary present
   6 Export contains NO adopter contact details by default; the opt-in adopter section is admin-only
   7 PDF renders with plain fonts and no emoji-related failures; a field containing odd characters (quotes, accents like ë, ï) renders correctly, not corrupted
   8 Corrections after the 15-min window create a new entry referencing the original rather than editing it
   9 Phone viewport 390px: logging usable; export triggerable (PDF opens/downloads)
   10 TypeScript strict + lint pass; npm audit clean
   Out of scope
   Photos/EXIF (step 6), viewings/adoption capture (done in step 2 — adopter data is reused here read-only), the final dashboard polish pass (step 8), internet exposure. No direct send-to-shelter integration (email/API) — export produces a file the foster sends through their existing channel; an integration is a separate later piece if ever wanted.
   Reference
   • Project plan: tracker_plan.md
   • Step 1–4 handoffs
   A note on the export and medical framing
   This export is the artifact the shelter actually relies on, so two things matter more than features: integrity (append-only records with visible corrections, not silent edits) and not over-claiming. The schedule templates are convenience defaults reflecting commonly cited kitten vaccination/deworming timing — they are not a veterinary protocol, and the app should say so where they appear. The real authority is the shelter's own schedule and the vet; the app's job is accurate record-keeping and a tidy handoff, not deciding what a kitten should receive.
