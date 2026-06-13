import assert from "node:assert/strict";
import { test } from "node:test";
import {
  expectedDailyMl,
  formatCountdown,
  intakeTodayMl,
  nextFeedDue,
  perFeedTargetMl,
} from "./feeding.ts";

const MIN = 60 * 1000;
const NOW = Date.UTC(2026, 5, 13, 12, 0, 0);

test("nextFeedDue: null when no feed yet", () => {
  assert.equal(nextFeedDue(null, 120, NOW), null);
});

test("nextFeedDue: upcoming feed", () => {
  const due = nextFeedDue(NOW - 73 * MIN, 120, NOW);
  assert.ok(due);
  assert.equal(due.overdue, false);
  assert.equal(due.minutesUntil, 47);
});

test("nextFeedDue: overdue feed", () => {
  const due = nextFeedDue(NOW - 142 * MIN, 120, NOW);
  assert.ok(due);
  assert.equal(due.overdue, true);
  assert.equal(due.minutesUntil, -22);
});

test("nextFeedDue: crosses into overdue exactly at the interval", () => {
  assert.equal(nextFeedDue(NOW - 120 * MIN, 120, NOW)?.overdue, true);
  assert.equal(nextFeedDue(NOW - 119 * MIN, 120, NOW)?.overdue, false);
});

test("formatCountdown labels", () => {
  assert.equal(formatCountdown(47), "in 47 min");
  assert.equal(formatCountdown(-22), "overdue by 22 min");
  assert.equal(formatCountdown(0), "due now");
  assert.equal(formatCountdown(65), "in 1h 5m");
});

test("perFeedTargetMl: ~8 ml per 30 g", () => {
  assert.equal(perFeedTargetMl(30), 8);
  assert.equal(perFeedTargetMl(150), 40);
  assert.equal(perFeedTargetMl(225), 60);
});

test("expectedDailyMl: per-feed × feeds-per-day", () => {
  // 150 g -> 40 ml/feed, 120 min interval -> 12 feeds/day -> 480 ml
  assert.equal(expectedDailyMl(150, 120), 480);
});

test("intakeTodayMl: sums only today's feeds", () => {
  const feeds = [
    { fedAtMs: NOW - 1 * MIN, amountMl: 10 },
    { fedAtMs: NOW - 3 * 60 * MIN, amountMl: 8.5 },
    { fedAtMs: NOW - 36 * 60 * MIN, amountMl: 12 }, // yesterday
    { fedAtMs: NOW - 5 * MIN, amountMl: null }, // no amount recorded
  ];
  const { totalMl, count } = intakeTodayMl(feeds, NOW);
  assert.equal(totalMl, 18.5);
  assert.equal(count, 3);
});
