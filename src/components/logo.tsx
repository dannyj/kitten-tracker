import { cn } from "@/lib/utils";

/**
 * Kitten Tracker logomark (style guide §02): a geometric cat head — two
 * triangular ears atop a rounded-corner head, vertical-slit pupils, and an
 * amber "tracker" dot cluster at bottom-right. Rendered white-on-teal inside a
 * rounded square for the icon-only contexts (nav lockup, favicon, app icon).
 */
export function BrandIcon({
  size = 30,
  className,
  title = "Kitten Tracker",
}: {
  size?: number;
  className?: string;
  title?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label={title}
      className={cn("rounded-[7px]", className)}
    >
      <rect width="64" height="64" rx="16" fill="#1D7874" />
      <g transform="translate(9.7,8) scale(0.857)">
        <polygon points="5,26 14,4 23,22" fill="white" fillOpacity="0.95" />
        <polygon points="47,26 38,4 29,22" fill="white" fillOpacity="0.95" />
        <rect x="5" y="18" width="42" height="34" rx="13" fill="white" fillOpacity="0.95" />
        <polygon points="8,25 14,9 21,22" fill="#1D7874" fillOpacity="0.12" />
        <polygon points="44,25 38,9 31,22" fill="#1D7874" fillOpacity="0.12" />
        <ellipse cx="18" cy="32" rx="4.5" ry="4" fill="#1D7874" />
        <ellipse cx="34" cy="32" rx="4.5" ry="4" fill="#1D7874" />
        <ellipse cx="18.8" cy="32" rx="2" ry="3.2" fill="#0A2E2C" />
        <ellipse cx="34.8" cy="32" rx="2" ry="3.2" fill="#0A2E2C" />
        <path d="M24,40 L26,37.5 L28,40 Z" fill="#1D7874" />
        <path d="M23.5,40.5 Q26,43 28.5,40.5" stroke="#1D7874" strokeWidth="0.9" fill="none" />
        <circle cx="39" cy="44" r="2" fill="#F2A63D" />
        <circle cx="44" cy="41.5" r="1.3" fill="#F2A63D" fillOpacity="0.7" />
        <circle cx="47.5" cy="45" r="1" fill="#F2A63D" fillOpacity="0.4" />
      </g>
    </svg>
  );
}

/**
 * Primary horizontal lockup: icon square + two-colour wordmark. "Kitten" in
 * forest teal, "Tracker" in harvest amber, set without a space at weight 600
 * (the only place weight 600 is used). The icon and text scale together with
 * `size`. The reversed variant (style guide §02) swaps "Kitten" to white for
 * dark brand surfaces — the sidebar and anything teal/deep-forest.
 */
export function BrandLockup({
  size = 30,
  variant = "primary",
  className,
}: {
  size?: number;
  variant?: "primary" | "reversed";
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <BrandIcon size={size} />
      <span
        className="font-semibold tracking-tight whitespace-nowrap"
        style={{ fontSize: Math.round(size * 0.5) }}
      >
        <span className={variant === "reversed" ? "text-white" : "text-[#1D7874]"}>Kitten</span>
        <span className="text-[#F2A63D]">Tracker</span>
      </span>
    </span>
  );
}
