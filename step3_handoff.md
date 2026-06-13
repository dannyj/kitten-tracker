Claude Code Handoff — Kitten Tracker, Step 3: Weights, Growth Charts & Alerts
Objective
Add weight tracking, growth visualization, and the alert engine that flags kittens not gaining properly — with actionable hints when an alert fires. "Done" means: I can record weights in seconds on my phone, see each kitten's growth trend and the whole litter on one chart, and get a clear warning (plus what to do about it) when a kitten stalls or loses weight.
Prerequisites
Steps 1–2 complete: auth, schema, mothers/litters/kittens CRUD, status pipeline. The kitten detail page already has a "coming soon" weights placeholder — replace it. alert_settings is already seeded (min_daily_gain_g=7, target_daily_gain_g=10, loss_pct_urgent=5, no_gain_hours_urgent=24).
Tasks

1. Weight entry (optimize for speed — used one-handed at 3am)
   • Quick-add on the kitten detail page: weight in grams, timestamp defaulting to now (editable), optional note. One tap to submit.
   • Even faster path: a "weigh litter" mode that walks through each active kitten in a litter in sequence, so a full-litter weigh-in is one flow, not N page visits.
   • Weights are append-only with the same 15-minute edit window as health logs; corrections after that are new entries. Allow delete-within-window for fat-finger duplicates.
   • Validate: positive integer grams, sane bounds (e.g. 50–8000 g) with a soft confirm if outside typical neonate range rather than a hard reject.
2. Growth chart — per kitten
   • Line chart (Recharts), weight over time, clean and uncluttered
   • Overlay an expected-growth reference band: neonates gain roughly 10 g/day from birth weight. Compute the band from birth date + first recorded weight using target_daily_gain_g, shown as a faint shaded area, not a hard line.
   • Trend indicator near the chart: ↑ / → / ↓ based on average daily gain over the last 48h, with the actual g/day number
   • Empty/low-data states: with <2 weights, show "need more data for a trend" rather than a broken chart
3. Growth chart — litter overview
   • All active siblings on one chart, one line per kitten, legend by name
   • This is the "spot the one falling behind" view — the laggard should be visually obvious
   • Toggle between absolute weight and % gain from birth weight (siblings start at different weights, so % can be clearer)
4. Alert engine
   Evaluate on read (query last 48h of weight_entries per kitten — no background job). Severity levels:
   • 🔴 Urgent — any of: weight loss ≥ loss_pct_urgent% vs previous entry; no gain (net ≤ 0 g) over no_gain_hours_urgenth
   • ⚠️ Warning — average daily gain < min_daily_gain_g g/day over the last 48h (but not urgent)
   • ✅ OK — gain ≥ min, trending fine
   • ⓘ Insufficient data — fewer than 2 weights in window, or kitten <24h on record
   Rules:
   • Only evaluate active kittens (in_care/intake/ready); skip adopted/returned/deceased
   • Settings come from alert_settings, read live so editing them re-evaluates
   • Surface alerts in three places: a badge on the kitten in list views, a banner on the kitten detail page, and an alert center (a filtered list of all kittens with active warnings, sorted urgent-first)
5. Hints when an alert fires
   When a kitten is Warning or Urgent, show a contextual hints panel. Static, curated content (no AI call) — a checklist the foster can act on:
   • Weigh consistently (same scale, before feeds) to confirm it's real, not measurement noise
   • Warm formula to ~38°C; check nipple flow — too slow tires them out, too fast risks aspiration
   • Smaller, more frequent feeds; consider shortening the feeding interval
   • Check hydration (skin tent at scruff) and warmth — a cold kitten (<36°C) won't digest and shouldn't be fed until warmed
   • Stimulate toileting before/after feeds
   • Escalation line for Urgent or 2 consecutive warning days: contact the shelter/vet — this is the threshold where a kitten can decline fast
   Keep the medical framing factual and cautious; this is decision support for the foster, not a substitute for the vet. Make that explicit in the panel.
6. Alert settings UI
   • Settings page section to edit the four thresholds, with the defaults shown and a "reset to defaults" button
   • Per-kitten override is out of scope for now — global only (schema already allows extending later)
   Acceptance criteria
   1 A weight can be added from the kitten detail page in one form, timestamp defaulting to now; litter weigh-in flow records all active siblings in sequence
   2 Per-kitten chart renders weight over time with the reference band; trend arrow + g/day matches a hand calculation
   3 Litter chart shows all active siblings; % -gain toggle works; a deliberately underweight kitten is visually the lowest line
   4 Alert engine: seed test data producing each state (urgent loss, urgent no-gain, warning, ok, insufficient) and confirm correct classification
   5 Editing a threshold in settings immediately changes evaluations on next load
   6 Hints panel appears only for warning/urgent and includes the escalation line
   7 <2 weights shows the insufficient-data state, never a crash or misleading trend
   8 Adopted/deceased kittens are excluded from alerts and the alert center
   9 Phone viewport: weight entry and charts are usable at 390px; charts don't overflow
   10 TypeScript strict + lint pass; npm audit clean
   Out of scope
   Hand-feeding log + interval countdown (step 4 — note the hint "shorten the interval" just points there), vaccinations (step 5), photos (step 6), viewings/adoption already done in step 2, exports, internet exposure.
   Reference
   • Project plan: tracker_plan.md.md
   • Step 1 & 2 handoffs
   A note on the alert thresholds
   Defaults (7 g/day warning floor, 10 g/day target, 5% loss = urgent) reflect commonly cited neonatal kitten guidance, but healthy gain varies with age and birth weight, and a single low reading is often just scale noise or a pre-feed weigh. The engine intentionally averages over 48h to avoid crying wolf. This is a monitoring aid — for an actually declining kitten the real instruction is the escalation line: get the shelter or a vet involved early.
