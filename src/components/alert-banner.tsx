import { ALERT_META, TREND_ARROW, type AlertResult } from "@/lib/alerts";
import { cn } from "@/lib/utils";

const LEVEL_CLASS: Record<AlertResult["level"], string> = {
  urgent: "border-red-200 bg-red-50 text-red-900",
  warning: "border-amber-200 bg-amber-50 text-amber-900",
  ok: "border-emerald-200 bg-emerald-50 text-emerald-900",
  insufficient: "border-zinc-200 bg-zinc-50 text-zinc-700",
};

/** Per-kitten alert summary banner with the reasons and the current trend. */
export function AlertBanner({ result }: { result: AlertResult }) {
  const meta = ALERT_META[result.level];
  return (
    <div className={cn("flex flex-col gap-1 rounded-lg border p-3", LEVEL_CLASS[result.level])}>
      <div className="flex items-center gap-2 text-sm font-semibold">
        <span aria-hidden>{meta.emoji}</span>
        <span>{meta.label}</span>
        {result.avgDailyGainG !== null && result.trend ? (
          <span className="ml-auto font-normal">
            {TREND_ARROW[result.trend]} {result.avgDailyGainG} g/day
          </span>
        ) : null}
      </div>
      <ul className="flex flex-col gap-0.5 text-sm">
        {result.reasons.map((reason, i) => (
          <li key={i}>{reason}</li>
        ))}
      </ul>
    </div>
  );
}
