import assert from "node:assert/strict";
import { test } from "node:test";
import { DEFAULT_ALERT_SETTINGS, evaluateAlert, type WeightPoint } from "./alerts.ts";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const NOW = Date.UTC(2026, 5, 13, 12, 0, 0);

// Helper: build a point N hours before NOW.
const at = (hoursAgo: number, weightGrams: number): WeightPoint => ({
  weighedAtMs: NOW - hoursAgo * HOUR,
  weightGrams,
});

test("insufficient: no weights", () => {
  const r = evaluateAlert([], DEFAULT_ALERT_SETTINGS, NOW);
  assert.equal(r.level, "insufficient");
});

test("insufficient: only one weighing", () => {
  const r = evaluateAlert([at(30, 200)], DEFAULT_ALERT_SETTINGS, NOW);
  assert.equal(r.level, "insufficient");
});

test("insufficient: less than 24h on record even with two weights", () => {
  const r = evaluateAlert([at(10, 200), at(2, 220)], DEFAULT_ALERT_SETTINGS, NOW);
  assert.equal(r.level, "insufficient");
});

test("insufficient: two weights but none in the 48h window", () => {
  const r = evaluateAlert([at(120, 200), at(72, 240)], DEFAULT_ALERT_SETTINGS, NOW);
  assert.equal(r.level, "insufficient");
});

test("ok: gaining at the target rate", () => {
  // 200g 48h ago, +10 g/day -> +20g over 2 days
  const r = evaluateAlert([at(48, 200), at(24, 210), at(0, 220)], DEFAULT_ALERT_SETTINGS, NOW);
  assert.equal(r.level, "ok");
  assert.equal(r.avgDailyGainG, 10);
  assert.equal(r.trend, "up");
});

test("warning: gaining but below the daily-gain floor", () => {
  // +6 g over 2 days span = 3 g/day, below floor, but no loss and net positive over 24h
  const r = evaluateAlert([at(48, 200), at(24, 203), at(0, 206)], DEFAULT_ALERT_SETTINGS, NOW);
  assert.equal(r.level, "warning");
  assert.ok(r.avgDailyGainG !== null && r.avgDailyGainG < DEFAULT_ALERT_SETTINGS.minDailyGainG);
});

test("urgent: weight loss >= 5% vs previous weighing", () => {
  // 220 -> 205 is -6.8%
  const r = evaluateAlert([at(48, 210), at(24, 220), at(0, 205)], DEFAULT_ALERT_SETTINGS, NOW);
  assert.equal(r.level, "urgent");
  assert.ok(r.reasons.some((x) => /Lost .*% since the previous/.test(x)));
});

test("urgent: no net gain over 24h", () => {
  // spans 36h, net change <= 0 across >=24h, but each step small (no 5% loss)
  const r = evaluateAlert([at(36, 210), at(24, 209), at(0, 208)], DEFAULT_ALERT_SETTINGS, NOW);
  assert.equal(r.level, "urgent");
  assert.ok(r.reasons.some((x) => /No weight gain in the last 24h/.test(x)));
});

test("settings drive classification: raising the floor flips ok -> warning", () => {
  const points = [at(48, 200), at(24, 210), at(0, 220)]; // 10 g/day
  assert.equal(evaluateAlert(points, DEFAULT_ALERT_SETTINGS, NOW).level, "ok");
  const strict = { ...DEFAULT_ALERT_SETTINGS, minDailyGainG: 15 };
  assert.equal(evaluateAlert(points, strict, NOW).level, "warning");
});

test("settings drive classification: lowering loss% makes a small dip urgent", () => {
  // Net positive over 24h (no urgent no-gain), below the floor (warning by default),
  // last pair 212 -> 207 is -2.36% — only urgent once loss% is lowered to 2.
  const points = [at(48, 200), at(30, 204), at(6, 212), at(0, 207)];
  assert.equal(evaluateAlert(points, DEFAULT_ALERT_SETTINGS, NOW).level, "warning");
  const sensitive = { ...DEFAULT_ALERT_SETTINGS, lossPctUrgent: 2 };
  assert.equal(evaluateAlert(points, sensitive, NOW).level, "urgent");
});

test("order independence: unsorted input gives the same result", () => {
  const sorted = [at(48, 200), at(24, 210), at(0, 220)];
  const shuffled = [at(0, 220), at(48, 200), at(24, 210)];
  assert.deepEqual(
    evaluateAlert(shuffled, DEFAULT_ALERT_SETTINGS, NOW),
    evaluateAlert(sorted, DEFAULT_ALERT_SETTINGS, NOW),
  );
});

void DAY;
