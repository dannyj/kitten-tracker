/**
 * Pure helpers for the growth charts. No runtime imports so it stays portable
 * between server and client.
 */

export type WeightSample = { weighedAtMs: number; weightGrams: number };

export type GrowthChartPoint = {
  t: number; // weighedAt epoch ms (x-axis)
  weight: number;
  /** Expected-growth corridor edges, anchored at the first recorded weight. */
  bandLow: number | null;
  bandHigh: number | null;
};

/**
 * Build per-kitten chart data with an expected-growth reference band.
 *
 * The band is a corridor anchored at the first recorded weight: its lower edge
 * grows at `minDailyGainG` and its upper edge at `targetDailyGainG`. A kitten
 * tracking inside or above the corridor is gaining acceptably; dipping below it
 * is the visual cue that matches a warning.
 */
export function buildKittenGrowthSeries(
  samples: WeightSample[],
  opts: { minDailyGainG: number; targetDailyGainG: number },
): GrowthChartPoint[] {
  const sorted = [...samples].sort((a, b) => a.weighedAtMs - b.weighedAtMs);
  if (sorted.length === 0) return [];

  const anchor = sorted[0];
  return sorted.map((s) => {
    const days = (s.weighedAtMs - anchor.weighedAtMs) / 86_400_000;
    return {
      t: s.weighedAtMs,
      weight: s.weightGrams,
      bandLow: Math.round(anchor.weightGrams + opts.minDailyGainG * days),
      bandHigh: Math.round(anchor.weightGrams + opts.targetDailyGainG * days),
    };
  });
}

export type LitterSeries = {
  kittenId: number;
  name: string;
  points: { t: number; weight: number; pctGain: number | null }[];
};

/**
 * Build one series per kitten for the litter overview, including each point's
 * percent gain from that kitten's own first recorded weight (siblings start at
 * different weights, so % normalises the comparison).
 */
export function buildLitterSeries(
  kittens: { kittenId: number; name: string; samples: WeightSample[] }[],
): LitterSeries[] {
  return kittens.map(({ kittenId, name, samples }) => {
    const sorted = [...samples].sort((a, b) => a.weighedAtMs - b.weighedAtMs);
    const birthWeight = sorted[0]?.weightGrams;
    return {
      kittenId,
      name,
      points: sorted.map((s) => ({
        t: s.weighedAtMs,
        weight: s.weightGrams,
        pctGain:
          birthWeight && birthWeight > 0
            ? Math.round(((s.weightGrams - birthWeight) / birthWeight) * 1000) / 10
            : null,
      })),
    };
  });
}

/** Distinct, legible line colors for the litter overview (cycled if needed). */
export const LITTER_LINE_COLORS = [
  "#2563eb",
  "#dc2626",
  "#16a34a",
  "#9333ea",
  "#ea580c",
  "#0891b2",
  "#db2777",
  "#65a30d",
];
