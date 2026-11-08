import assert from "node:assert/strict";
import { test } from "node:test";
import { formatAge, todayIso } from "./dates.ts";

test("shelter today crosses midnight before UTC in winter and summer", () => {
  assert.equal(todayIso(new Date("2026-11-07T23:30:00Z")), "2026-11-08");
  assert.equal(todayIso(new Date("2026-07-07T22:30:00Z")), "2026-07-08");
  assert.equal(todayIso(new Date("2026-11-07T22:30:00Z")), "2026-11-07");
});

test("ages use shelter calendar days at the UTC date boundary", () => {
  const until = new Date("2026-11-07T23:30:00Z");
  assert.equal(formatAge("2026-10-16", { until }), "3w 2d");
  assert.equal(formatAge("2026-10-29", { until, estimated: true }), "~1w 3d");
  assert.equal(formatAge("2026-11-09", { until }), null);
});

test("age advances by a calendar day across both DST changes", () => {
  assert.equal(formatAge("2026-03-29", { until: new Date("2026-03-29T22:30:00Z") }), "1d");
  assert.equal(formatAge("2026-10-25", { until: new Date("2026-10-25T23:30:00Z") }), "1d");
});

test("frozen ages reject invalid dates and preserve same-day age", () => {
  const until = new Date("2026-11-07T23:30:00Z");
  assert.equal(formatAge("2026-11-08", { until }), "0d");
  assert.equal(formatAge("2026-02-30", { until }), null);
  assert.equal(formatAge("invalid", { until }), null);
  assert.equal(formatAge(null, { until }), null);
  assert.equal(formatAge("2026-11-08", { until: new Date("invalid") }), null);
});
