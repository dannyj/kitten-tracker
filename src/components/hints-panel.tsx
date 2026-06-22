import { Stethoscope } from "lucide-react";
import type { FeedingMethod } from "@/db/schema";

/**
 * Static, curated action checklist shown when a kitten is warning/urgent.
 * Deliberately not AI-generated — this is decision support for the foster, with
 * an explicit escalation line. It does not replace a vet.
 *
 * The hint list is tailored to how the kitten is fed: a hand-fed kitten needs
 * bottle/formula guidance, a mother-fed kitten needs you to check the queen and
 * littermate competition, and a weaned kitten needs solid-food guidance. The
 * `feeding`-flagged hint deep-links to the hand-feeding module (#feeding), so it
 * only links for hand-fed kittens.
 */
type Hint = { text: string; feeding?: boolean };

const WEIGH: Hint = {
  text: "Weigh consistently (same scale, before feeds) to confirm it's real, not measurement noise.",
};
const HYDRATION_WARMTH: Hint = {
  text: "Check hydration (skin tent at the scruff) and warmth — a cold kitten (<36 °C) won't digest and shouldn't be fed until warmed.",
};

const HINTS_BY_METHOD: Record<FeedingMethod, Hint[]> = {
  hand: [
    WEIGH,
    {
      text: "Warm formula to ~38 °C and check the nipple flow — too slow tires them out, too fast risks aspiration.",
    },
    {
      text: "Try smaller, more frequent feeds; consider shortening the feeding interval.",
      feeding: true,
    },
    HYDRATION_WARMTH,
    { text: "Stimulate toileting before and after feeds." },
  ],
  mother: [
    WEIGH,
    {
      text: "Check the queen is nursing and producing milk — look for mastitis (hot, hard or painful teats) or signs she's rejecting or separating from this kitten.",
    },
    {
      text: "Make sure the kitten can latch and isn't being pushed off by stronger littermates; offer it a less-contested back teat.",
    },
    HYDRATION_WARMTH,
  ],
  weaned: [
    WEIGH,
    {
      text: "Offer warm, strong-smelling wet food or a kitten gruel — appetite drops when food is cold or bland.",
    },
    {
      text: "Feed from a shallow, separate bowl so it isn't out-competed by littermates, and watch that it actually eats.",
    },
    HYDRATION_WARMTH,
  ],
};

export function HintsPanel({
  urgent,
  feedingMethod,
  feedingHref,
}: {
  urgent: boolean;
  feedingMethod: FeedingMethod;
  /** When set (hand-fed kitten), the feeding-related hint links here. */
  feedingHref?: string;
}) {
  const hints = HINTS_BY_METHOD[feedingMethod];
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-amber-200 bg-amber-50/50 p-4">
      <div className="flex items-center gap-2 text-sm font-semibold text-amber-900">
        <Stethoscope className="size-4" aria-hidden />
        What to check
      </div>
      <ul className="ml-4 flex list-disc flex-col gap-1.5 text-sm">
        {hints.map((hint) => (
          <li key={hint.text}>
            {hint.feeding && feedingHref ? (
              <a href={feedingHref} className="underline underline-offset-2">
                {hint.text}
              </a>
            ) : (
              hint.text
            )}
          </li>
        ))}
      </ul>
      <div className="rounded-md border border-amber-300 bg-amber-100/70 p-3 text-sm font-medium text-amber-950">
        {urgent
          ? "Escalate now: contact the shelter or a vet. This is the threshold where a kitten can decline fast."
          : "If this continues for a second day, contact the shelter or a vet — don't wait for it to become urgent."}
      </div>
      <p className="text-muted-foreground text-xs">
        This is monitoring support for the foster, not a substitute for veterinary advice.
      </p>
    </div>
  );
}
