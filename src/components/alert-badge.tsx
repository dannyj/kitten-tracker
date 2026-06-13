import { Badge } from "@/components/ui/badge";
import { ALERT_META, TREND_ARROW, type AlertResult } from "@/lib/alerts";
import { cn } from "@/lib/utils";

/**
 * Compact alert badge for list rows. By default only the actionable levels
 * (urgent/warning) render, so lists stay calm; pass showAll to include ok/need-data.
 */
export function AlertBadge({
  result,
  showAll = false,
  className,
}: {
  result: AlertResult;
  showAll?: boolean;
  className?: string;
}) {
  if (!showAll && result.level !== "urgent" && result.level !== "warning") {
    return null;
  }
  const meta = ALERT_META[result.level];
  return (
    <Badge variant="outline" className={cn(meta.badgeClass, "gap-1", className)}>
      <span aria-hidden>{meta.emoji}</span>
      {meta.label}
      {result.trend ? <span aria-hidden>{TREND_ARROW[result.trend]}</span> : null}
    </Badge>
  );
}
