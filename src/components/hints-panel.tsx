import { Stethoscope } from "lucide-react";

/**
 * Static, curated action checklist shown when a kitten is warning/urgent.
 * Deliberately not AI-generated — this is decision support for the foster, with
 * an explicit escalation line. It does not replace a vet.
 *
 * `feeding` hints deep-link to the feeding section (#feeding) when the kitten is
 * hand-fed, tying the step-3 alert advice to the step-4 module.
 */
const HINTS: { text: string; feeding?: boolean }[] = [
  {
    text: "Weigh consistently (same scale, before feeds) to confirm it's real, not measurement noise.",
  },
  {
    text: "Warm formula to ~38 °C and check the nipple flow — too slow tires them out, too fast risks aspiration.",
  },
  {
    text: "Try smaller, more frequent feeds; consider shortening the feeding interval.",
    feeding: true,
  },
  {
    text: "Check hydration (skin tent at the scruff) and warmth — a cold kitten (<36 °C) won't digest and shouldn't be fed until warmed.",
  },
  { text: "Stimulate toileting before and after feeds." },
];

export function HintsPanel({
  urgent,
  feedingHref,
}: {
  urgent: boolean;
  /** When set (hand-fed kitten), feeding-related hints link here. */
  feedingHref?: string;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-amber-200 bg-amber-50/50 p-4">
      <div className="flex items-center gap-2 text-sm font-semibold text-amber-900">
        <Stethoscope className="size-4" aria-hidden />
        What to check
      </div>
      <ul className="ml-4 flex list-disc flex-col gap-1.5 text-sm">
        {HINTS.map((hint) => (
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
