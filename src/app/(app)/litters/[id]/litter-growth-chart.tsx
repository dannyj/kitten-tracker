"use client";

import { useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Button } from "@/components/ui/button";
import { LITTER_LINE_COLORS, type LitterSeries } from "@/lib/growth";

type Mode = "absolute" | "pct";

function formatTick(ms: number): string {
  const d = new Date(ms);
  return `${String(d.getDate()).padStart(2, "0")}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Merge per-kitten series into one row per timestamp, one column per kitten. */
function mergeRows(series: LitterSeries[], mode: Mode): Record<string, number | null>[] {
  const byTime = new Map<number, Record<string, number | null>>();
  for (const s of series) {
    for (const p of s.points) {
      const row = byTime.get(p.t) ?? { t: p.t };
      row[`k${s.kittenId}`] = mode === "absolute" ? p.weight : p.pctGain;
      byTime.set(p.t, row);
    }
  }
  return [...byTime.values()].sort((a, b) => (a.t as number) - (b.t as number));
}

export function LitterGrowthChart({ series }: { series: LitterSeries[] }) {
  const [mode, setMode] = useState<Mode>("absolute");

  const chartable = series.filter((s) => s.points.length > 0);
  if (chartable.length === 0 || chartable.every((s) => s.points.length < 2)) {
    return (
      <div className="text-muted-foreground flex h-[280px] items-center justify-center rounded-lg border border-dashed text-sm">
        Need at least two weighings on a sibling to chart the litter.
      </div>
    );
  }

  const data = mergeRows(chartable, mode);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2">
        <Button
          type="button"
          size="sm"
          variant={mode === "absolute" ? "default" : "outline"}
          onClick={() => setMode("absolute")}
        >
          Weight (g)
        </Button>
        <Button
          type="button"
          size="sm"
          variant={mode === "pct" ? "default" : "outline"}
          onClick={() => setMode("pct")}
        >
          % gain from birth
        </Button>
      </div>
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
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
          <YAxis fontSize={11} width={52} unit={mode === "absolute" ? "g" : "%"} />
          <Tooltip
            labelFormatter={(ms) => formatTick(Number(ms))}
            formatter={(value, name) => [mode === "absolute" ? `${value} g` : `${value}%`, name]}
          />
          <Legend />
          {chartable.map((s, i) => (
            <Line
              key={s.kittenId}
              dataKey={`k${s.kittenId}`}
              name={s.name}
              stroke={LITTER_LINE_COLORS[i % LITTER_LINE_COLORS.length]}
              strokeWidth={2}
              dot={{ r: 2 }}
              connectNulls
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
