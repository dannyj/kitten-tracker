import { Badge } from "@/components/ui/badge";
import type { KittenStatus } from "@/db/schema";
import { STATUS_BADGE_CLASSES, STATUS_LABELS } from "@/lib/status";
import { cn } from "@/lib/utils";

export function StatusBadge({ status, className }: { status: KittenStatus; className?: string }) {
  return (
    <Badge variant="outline" className={cn(STATUS_BADGE_CLASSES[status], className)}>
      {STATUS_LABELS[status]}
    </Badge>
  );
}
