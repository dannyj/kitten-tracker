/**
 * Neonatal-kitten growth alert engine.
 *
 * Pure and dependency-free on purpose: no imports, so it can be unit-tested
 * with Node's type stripping and reused on both server and client. Evaluation
 * is "on read" — feed it the recent weight entries and the live settings.
 *
 * This is monitoring decision support, not a medical diagnosis. The real
 * instruction for a declining kitten is the escalation line (contact a vet),
 * surfaced in the hints panel.
 */

export type AlertLevel = "urgent" | "warning" | "ok" | "insufficient";

export type AlertSettings = {
  /** Warning floor: average daily gain below this (g/day) is a warning. */
  minDailyGainG: number;
  /** Target daily gain (g/day) — used for the chart reference band. */
  targetDailyGainG: number;
  /** A drop of at least this percent vs the previous weighing is urgent. */
  lossPctUrgent: number;
  /** No net gain across at least this many hours is urgent. */
  noGainHoursUrgent: number;
};

export const DEFAULT_ALERT_SETTINGS: AlertSettings = {
  minDailyGainG: 7,
  targetDailyGainG: 10,
  lossPctUrgent: 5,
  noGainHoursUrgent: 24,
};

export type WeightPoint = { weighedAtMs: number; weightGrams: number };

export type Trend = "up" | "flat" | "down";

export type AlertResult = {
  level: AlertLevel;
  /** Average daily gain over the 48h window (g/day), or null if not computable. */
  avgDailyGainG: number | null;
  trend: Trend | null;
  /** Human-readable explanations, most important first. */
  reasons: string[];
};

const HOUR_MS = 60 * 60 * 1000;
const WINDOW_MS = 48 * HOUR_MS;
const MIN_RECORD_AGE_MS = 24 * HOUR_MS;
/** Direction deadband (g/day): smaller magnitudes read as "flat". */
const TREND_DEADBAND = 0.5;

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/**
 * Classify a kitten's recent growth. `points` may be in any order; only entries
 * within the last 48h are considered for the trend, but the full history is used
 * to decide whether the kitten has been "on record" long enough to judge.
 */
export function evaluateAlert(
  points: WeightPoint[],
  settings: AlertSettings,
  nowMs: number = Date.now(),
): AlertResult {
  const sorted = [...points].sort((a, b) => a.weighedAtMs - b.weighedAtMs);

  if (sorted.length === 0) {
    return {
      level: "insufficient",
      avgDailyGainG: null,
      trend: null,
      reasons: ["No weights recorded yet."],
    };
  }
  if (nowMs - sorted[0].weighedAtMs < MIN_RECORD_AGE_MS) {
    return {
      level: "insufficient",
      avgDailyGainG: null,
      trend: null,
      reasons: ["Less than 24h of data — need more time to judge a trend."],
    };
  }

  const window = sorted.filter((p) => p.weighedAtMs >= nowMs - WINDOW_MS);
  if (window.length < 2) {
    return {
      level: "insufficient",
      avgDailyGainG: null,
      trend: null,
      reasons: ["Fewer than two weighings in the last 48h."],
    };
  }

  const first = window[0];
  const latest = window[window.length - 1];
  const prev = window[window.length - 2];
  const spanHours = (latest.weighedAtMs - first.weighedAtMs) / HOUR_MS;

  if (spanHours <= 0) {
    return {
      level: "insufficient",
      avgDailyGainG: null,
      trend: null,
      reasons: ["Weighings are too close together to compute a trend."],
    };
  }

  const avgDailyGainG = round1(((latest.weightGrams - first.weightGrams) / spanHours) * 24);
  const trend: Trend =
    avgDailyGainG > TREND_DEADBAND ? "up" : avgDailyGainG < -TREND_DEADBAND ? "down" : "flat";

  const reasons: string[] = [];

  // --- Urgent checks ---
  // 1) Significant drop versus the previous weighing.
  const pctChange = ((latest.weightGrams - prev.weightGrams) / prev.weightGrams) * 100;
  if (pctChange <= -settings.lossPctUrgent) {
    reasons.push(
      `Lost ${round1(-pctChange)}% since the previous weighing (${prev.weightGrams}g → ${latest.weightGrams}g).`,
    );
  }

  // 2) No net gain across the urgent window (only if data actually spans it).
  const noGainCutoff = latest.weighedAtMs - settings.noGainHoursUrgent * HOUR_MS;
  const anchorCandidates = window.filter((p) => p.weighedAtMs <= noGainCutoff);
  if (anchorCandidates.length > 0) {
    const anchor = anchorCandidates[anchorCandidates.length - 1];
    if (latest.weightGrams - anchor.weightGrams <= 0) {
      reasons.push(
        `No weight gain in the last ${settings.noGainHoursUrgent}h (${anchor.weightGrams}g → ${latest.weightGrams}g).`,
      );
    }
  }

  if (reasons.length > 0) {
    return { level: "urgent", avgDailyGainG, trend, reasons };
  }

  // --- Warning ---
  if (avgDailyGainG < settings.minDailyGainG) {
    return {
      level: "warning",
      avgDailyGainG,
      trend,
      reasons: [
        `Average gain ${avgDailyGainG} g/day is below the ${settings.minDailyGainG} g/day floor.`,
      ],
    };
  }

  // --- OK ---
  return {
    level: "ok",
    avgDailyGainG,
    trend,
    reasons: [`Gaining ${avgDailyGainG} g/day — on track.`],
  };
}

/** UI metadata (strings only, no component imports — keeps this module pure). */
export const ALERT_META: Record<AlertLevel, { label: string; emoji: string; badgeClass: string }> =
  {
    urgent: {
      label: "Urgent",
      emoji: "🔴",
      badgeClass: "bg-red-100 text-red-900 border-red-200",
    },
    warning: {
      label: "Warning",
      emoji: "⚠️",
      badgeClass: "bg-amber-100 text-amber-900 border-amber-200",
    },
    ok: {
      label: "On track",
      emoji: "✅",
      badgeClass: "bg-emerald-100 text-emerald-900 border-emerald-200",
    },
    insufficient: {
      label: "Need data",
      emoji: "ⓘ",
      badgeClass: "bg-zinc-100 text-zinc-700 border-zinc-200",
    },
  };

export const TREND_ARROW: Record<Trend, string> = { up: "↑", flat: "→", down: "↓" };
