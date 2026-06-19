import { FEEDBACK_META, feedbackTone, type WeighFeedback } from "@/lib/alerts";
import { cn } from "@/lib/utils";

/** "+18 g since last weigh" / "−5 g…" / first-weight copy. */
function deltaLine(deltaGrams: number | null): string {
  if (deltaGrams === null) return "First weight recorded.";
  if (deltaGrams === 0) return "No change since the last weigh.";
  // Use a real minus sign for losses; "+" for gains.
  const sign = deltaGrams > 0 ? "+" : "−";
  return `${sign}${Math.abs(deltaGrams)} g since the last weigh.`;
}

/**
 * Instant read on a just-saved weighing: the gain/loss versus the previous
 * weight and the two-tier "on track" / "be aware" verdict. Used by the kitten
 * quick-add and the litter weigh-in summary.
 */
export function WeighResult({
  feedback,
  className,
}: {
  feedback: WeighFeedback;
  className?: string;
}) {
  const tone = feedbackTone(feedback.alert.level);
  const meta = FEEDBACK_META[tone];
  const reason = feedback.alert.reasons[0];

  return (
    <div
      role="status"
      className={cn("flex flex-col gap-1 rounded-lg border p-3", meta.class, className)}
    >
      <div className="flex items-center gap-2 text-sm font-semibold">
        <span aria-hidden>{meta.emoji}</span>
        <span>{meta.label}</span>
        <span className="ml-auto font-normal">
          {feedback.weightGrams} g · {deltaLine(feedback.deltaGrams)}
        </span>
      </div>
      {reason ? <p className="text-sm">{reason}</p> : null}
    </div>
  );
}
