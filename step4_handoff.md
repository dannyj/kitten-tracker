Claude Code Handoff — Kitten Tracker, Step 4: Hand-Feeding Module
Objective
Build the hand-feeding log and the feeding-interval countdown for kittens flagged as hand-fed. "Done" means: for a bottle-fed kitten I can log each feed in seconds, see when the next feed is due (and whether it's overdue) from the dashboard, and review intake against a target — so a 3am feed is one tap and nothing gets missed across a sleep-deprived rotation.
Prerequisites
Steps 1–3 complete: auth, schema, CRUD, status pipeline, weights/charts/alerts. Kittens already have hand_feeding (bool) and feeding_interval_minutes (default 120) on the schema, set in the kitten create/edit form. The kitten detail page has a "coming soon" feedings placeholder — replace it. The step-3 alert hint "shorten the feeding interval" should now link here.
Tasks

1. Feeding log (only for hand_feeding kittens)
   • Quick-add on the kitten detail page: amount (ml), timestamp defaulting to now (editable), formula type, quality (good latch | slow | refused), optional note. Minimize taps — amount + submit should be the fast path, everything else optional.
   • Recent feeds list, newest first, showing time, amount, quality, "time since previous feed"
   • Same append-only + 15-minute edit/delete window as weights and health logs
   • If a kitten is not hand_feeding, this section is hidden (not just disabled). Toggling hand_feeding on in the edit form reveals it; toggling off hides the section but never deletes existing feed history — it stays on record.
2. Interval & "next feed due"
   • Next feed due = last feed timestamp + feeding_interval_minutes
   • Detail page shows a live countdown ("next feed in 47 min") and an overdue state ("overdue by 22 min") in a clear warning color once past due
   • Interval is editable inline from the feeding section (not just the edit form), since you adjust it as the kitten matures — changing it recomputes the countdown immediately
   • A kitten with hand_feeding on but zero feeds logged shows "no feeds yet — start the log" rather than a broken countdown
3. Dashboard feeding panel
   • A "feeding due" section on the dashboard listing all active hand-fed kittens sorted by soonest-due, overdue ones pinned at top in warning color
   • Each row: kitten name, last feed time, next due / overdue countdown, one-tap "log feed" that opens the quick-add prefilled for that kitten
   • This is the at-a-glance "who needs feeding next" view for the whole litter during a rotation
4. Daily intake vs. target
   • Per-kitten daily total (ml) for today, and a simple per-feed target guide based on current weight (~8 ml formula per 30 g body weight per feed is a reasonable starting reference; compute from latest weight entry)
   • Show today's total feeds and total ml against the rough expected daily intake, as a gentle indicator — not a hard alarm. Frame it as guidance.
   • If no recent weight exists, show the intake total without the target and a quiet "add a weight to see intake targets" nudge (ties weights and feeding together)
5. Interaction with the alert engine
   • No new alert severities here. But: a hand-fed kitten that is also weight-Warning/Urgent (from step 3) should show its feeding section prominently, and the step-3 hints panel's "shorten interval" / "smaller more frequent feeds" lines deep-link to this section.
   • Keep the feeding countdown and the weight alerts as separate signals — don't merge them. One is "is it time to feed", the other is "is it growing". Conflating them hides information.
6. Validation & safety framing
   • Amount: positive, sane bound (e.g. 0.1–60 ml) with soft confirm beyond typical, not a hard reject
   • The intake target is explicitly labelled as a rough guide; a short factual note that feeding amounts vary with age/weight and that the shelter/vet guidance takes precedence. No dosing language that implies medical authority.
   • All mutations Zod-validated server-side; session required; ID validation as before
   Acceptance criteria
   1 Feeding section appears only for hand_feeding kittens; toggling the flag off hides it but preserves logged feeds (verify history survives a toggle round-trip)
   2 A feed logs in one quick action with timestamp defaulting to now; recent list shows "time since previous feed" correctly
   3 Countdown computes from last feed + interval; crosses into an overdue state at the right moment; editing the interval inline recomputes immediately
   4 Dashboard feeding panel lists active hand-fed kittens by soonest-due, overdue pinned on top, one-tap log works and prefills the right kitten
   5 Daily intake total is correct for today; per-feed target derives from latest weight; with no weight, target is hidden with the nudge shown
   6 A kitten with hand_feeding on and no feeds shows the empty state, not a broken/negative countdown
   7 Edit/delete honors the 15-minute window; later corrections are new entries
   8 Phone viewport 390px: quick-add and dashboard panel fully usable
   9 TypeScript strict + lint pass; npm audit clean
   Out of scope
   Vaccinations (step 5), photos/EXIF (step 6), viewings/adoption (done in step 2), shelter export (step 5 covers the medical summary; a feeding-history export can fold into that), internet exposure. No push notifications — the dashboard is the surface for "who's due"; a real notification system, if ever wanted, is a later, separately-scoped piece.
   Reference
   • Project plan: tracker_plan.md
   • Step 1–3 handoffs
   A note on scope creep to resist
   The tempting next thing here is automated reminders/push notifications for overdue feeds. Deliberately left out: it pulls in service workers or a notification backend, permissions, and reliability concerns that dwarf the rest of this step, and the dashboard already answers "who's due next". If you want nudges later, scope it on its own. Keeping step 4 to logging + countdown keeps it shippable in one pass.
