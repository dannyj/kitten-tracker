import { Badge } from "@/components/ui/badge";
import type { PartyStatus } from "@/db/schema";
import { PARTY_STATUS_BADGE_CLASSES, PARTY_STATUS_LABELS } from "@/lib/parties";
import { cn } from "@/lib/utils";

export function PartyStatusBadge({
  status,
  className,
}: {
  status: PartyStatus;
  className?: string;
}) {
  return (
    <Badge variant="outline" className={cn(PARTY_STATUS_BADGE_CLASSES[status], className)}>
      {PARTY_STATUS_LABELS[status]}
    </Badge>
  );
}
