/**
 * Pure geometry for the growth chart used in the shelter export. The same
 * computed coordinates drive the inline SVG (print view) and the pdfkit vector
 * drawing (PDF), so both render identically with no browser involved.
 */

import type { GrowthChartPoint } from "@/lib/growth";

export type Pt = { x: number; y: number };

export type ChartGeometry = {
  width: number;
  height: number;
  area: { x: number; y: number; w: number; h: number };
  line: Pt[];
  /** Closed polygon for the expected-growth band, or null if not computable. */
  band: Pt[] | null;
  xTicks: { x: number; label: string }[];
  yTicks: { y: number; label: string }[];
};

function ddmm(ms: number): string {
  const d = new Date(ms);
  return `${String(d.getDate()).padStart(2, "0")}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Build chart geometry, or null when there's too little data to plot. */
export function buildChartGeometry(
  points: GrowthChartPoint[],
  width = 480,
  height = 200,
): ChartGeometry | null {
  if (points.length < 2) return null;

  const pad = { top: 12, right: 14, bottom: 22, left: 40 };
  const area = {
    x: pad.left,
    y: pad.top,
    w: width - pad.left - pad.right,
    h: height - pad.top - pad.bottom,
  };

  const xs = points.map((p) => p.t);
  const xMin = Math.min(...xs);
  const xMax = Math.max(...xs);
  if (xMax === xMin) return null;

  const ys: number[] = [];
  for (const p of points) {
    ys.push(p.weight);
    if (p.bandLow !== null) ys.push(p.bandLow);
    if (p.bandHigh !== null) ys.push(p.bandHigh);
  }
  let yMin = Math.min(...ys);
  let yMax = Math.max(...ys);
  const padY = (yMax - yMin) * 0.08 || 5;
  yMin -= padY;
  yMax += padY;

  const sx = (t: number) => area.x + ((t - xMin) / (xMax - xMin)) * area.w;
  const sy = (v: number) => area.y + ((yMax - v) / (yMax - yMin)) * area.h;

  const line: Pt[] = points.map((p) => ({ x: sx(p.t), y: sy(p.weight) }));

  let band: Pt[] | null = null;
  if (points.every((p) => p.bandLow !== null && p.bandHigh !== null)) {
    const highs = points.map((p) => ({ x: sx(p.t), y: sy(p.bandHigh!) }));
    const lows = points.map((p) => ({ x: sx(p.t), y: sy(p.bandLow!) })).reverse();
    band = [...highs, ...lows];
  }

  const xTicks = [xMin, (xMin + xMax) / 2, xMax].map((t) => ({ x: sx(t), label: ddmm(t) }));

  const yTickCount = 4;
  const yTicks = Array.from({ length: yTickCount + 1 }, (_, i) => {
    const v = yMin + ((yMax - yMin) * i) / yTickCount;
    return { y: sy(v), label: `${Math.round(v)}` };
  });

  return { width, height, area, line, band, xTicks, yTicks };
}

/** Render the geometry as a standalone SVG string (for the HTML print view). */
export function chartToSvg(g: ChartGeometry): string {
  const linePts = g.line.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const bandPts = g.band?.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const yAxis = `${g.area.x},${g.area.y} ${g.area.x},${g.area.y + g.area.h}`;
  const xAxis = `${g.area.x},${g.area.y + g.area.h} ${g.area.x + g.area.w},${g.area.y + g.area.h}`;

  const yTickEls = g.yTicks
    .map(
      (t) =>
        `<text x="${g.area.x - 4}" y="${(t.y + 3).toFixed(1)}" font-size="9" text-anchor="end" fill="#666">${t.label}</text>` +
        `<line x1="${g.area.x}" y1="${t.y.toFixed(1)}" x2="${g.area.x + g.area.w}" y2="${t.y.toFixed(1)}" stroke="#eee" stroke-width="1"/>`,
    )
    .join("");
  const xTickEls = g.xTicks
    .map(
      (t) =>
        `<text x="${t.x.toFixed(1)}" y="${g.height - 6}" font-size="9" text-anchor="middle" fill="#666">${t.label}</text>`,
    )
    .join("");

  return [
    `<svg viewBox="0 0 ${g.width} ${g.height}" width="100%" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Growth chart">`,
    yTickEls,
    bandPts ? `<polygon points="${bandPts}" fill="#16a34a" fill-opacity="0.12"/>` : "",
    `<polyline points="${yAxis}" fill="none" stroke="#999" stroke-width="1"/>`,
    `<polyline points="${xAxis}" fill="none" stroke="#999" stroke-width="1"/>`,
    `<polyline points="${linePts}" fill="none" stroke="#2563eb" stroke-width="2"/>`,
    g.line
      .map((p) => `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="2" fill="#2563eb"/>`)
      .join(""),
    xTickEls,
    `</svg>`,
  ].join("");
}
