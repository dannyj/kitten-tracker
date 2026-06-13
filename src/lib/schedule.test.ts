import assert from "node:assert/strict";
import { test } from "node:test";
import {
  addDaysIso,
  daysUntil,
  milestoneDates,
  nextDueForType,
  suggestNextDueDate,
  type ScheduleTemplate,
} from "./schedule.ts";

const FVRCP: ScheduleTemplate = {
  vaccineType: "FVRCP",
  label: "FVRCP",
  firstWeeks: 7,
  everyWeeks: 3,
  untilWeeks: 16,
};
const DEWORM: ScheduleTemplate = {
  vaccineType: "deworming",
  label: "Deworming",
  firstWeeks: 2,
  everyWeeks: 2,
  untilWeeks: 8,
};

test("addDaysIso handles month boundaries", () => {
  assert.equal(addDaysIso("2026-05-20", 14), "2026-06-03");
});

test("milestoneDates: deworming at 2,4,6,8 weeks", () => {
  // born 2026-05-01 -> +2w, +4w, +6w, +8w
  assert.deepEqual(milestoneDates("2026-05-01", DEWORM), [
    "2026-05-15",
    "2026-05-29",
    "2026-06-12",
    "2026-06-26",
  ]);
});

test("milestoneDates: FVRCP first at 7w then every 3 until 16w", () => {
  const dates = milestoneDates("2026-05-01", FVRCP);
  // 7,10,13,16 weeks
  assert.equal(dates.length, 4);
  assert.equal(dates[0], addDaysIso("2026-05-01", 49));
});

test("nextDueForType: 2 dewormings given -> next is the 6-week milestone", () => {
  const item = nextDueForType("2026-05-01", DEWORM, 2, "2026-06-01");
  assert.ok(item);
  assert.equal(item.dueDateIso, "2026-06-12");
  assert.equal(item.overdue, false);
});

test("nextDueForType: overdue when the milestone is in the past", () => {
  const item = nextDueForType("2026-05-01", DEWORM, 0, "2026-06-01");
  assert.ok(item);
  assert.equal(item.dueDateIso, "2026-05-15");
  assert.equal(item.overdue, true);
});

test("nextDueForType: null once the schedule is complete", () => {
  assert.equal(nextDueForType("2026-05-01", DEWORM, 4, "2026-08-01"), null);
});

test("suggestNextDueDate: given + booster interval", () => {
  assert.equal(suggestNextDueDate("2026-06-01", FVRCP), addDaysIso("2026-06-01", 21));
});

test("daysUntil: negative when overdue", () => {
  assert.equal(daysUntil("2026-05-28", "2026-06-01"), -4);
  assert.equal(daysUntil("2026-06-08", "2026-06-01"), 7);
});
