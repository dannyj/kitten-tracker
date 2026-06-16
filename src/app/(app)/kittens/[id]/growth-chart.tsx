"use client";

import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { GrowthChartPoint } from "@/lib/growth";

function formatTick(ms: number): string {
  const d = new Date(ms);
  return `${String(d.getDate()).padStart(2, "0")}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * Explicit, ascending [min, max] domain padded ~8% (≥5 g). Computing it
 * ourselves — rather than recharts' `["auto", "auto"]` — is what keeps the
 * y-axis the right way up: with the range-Area band present, auto-domain can
 * resolve to a descending pair, which recharts then renders as a flipped axis
 * (heavier weights at the top reading as lower numbers).
 */
function weightDomain(points: GrowthChartPoint[]): [number, number] {
  const values: number[] = [];
  for (const p of points) {
    values.push(p.weight);
    if (p.bandLow !== null) values.push(p.bandLow);
    if (p.bandHigh !== null) values.push(p.bandHigh);
  }
  const min = Math.min(...values);
  const max = Math.max(...values);
  const pad = (max - min) * 0.08 || 5;
  return [Math.floor(min - pad), Math.ceil(max + pad)];
}

export function GrowthChart({ points }: { points: GrowthChartPoint[] }) {
  if (points.length < 2) {
    return (
      <div className="text-muted-foreground flex h-[240px] items-center justify-center rounded-lg border border-dashed text-sm">
        Need at least two weighings to chart growth.
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={240}>
      <ComposedChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis
          dataKey="t"
          type="number"
          scale="time"
          domain={["dataMin", "dataMax"]}
          tickFormatter={formatTick}
          fontSize={11}
          minTickGap={24}
        />
        <YAxis
          fontSize={11}
          width={44}
          unit="g"
          domain={weightDomain(points)}
          allowDecimals={false}
        />
        <Tooltip
          labelFormatter={(ms) => formatTick(Number(ms))}
          formatter={(value, name) => {
            if (name === "weight") return [`${value} g`, "Weight"];
            // The band series' value is a [low, high] tuple — show it as a range.
            if (Array.isArray(value)) return [`${value[0]}–${value[1]} g`, "Expected range"];
            return [`${value} g`, name];
          }}
        />
        {/* Expected-growth corridor as a range area between the band edges. */}
        <Area
          dataKey={(d: GrowthChartPoint) =>
            d.bandLow !== null && d.bandHigh !== null ? [d.bandLow, d.bandHigh] : undefined
          }
          stroke="none"
          fill="#16a34a"
          fillOpacity={0.1}
          isAnimationActive={false}
          activeDot={false}
          legendType="none"
          name="Expected range"
        />
        <Line
          dataKey="weight"
          stroke="#2563eb"
          strokeWidth={2}
          dot={{ r: 3 }}
          isAnimationActive={false}
          name="weight"
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
