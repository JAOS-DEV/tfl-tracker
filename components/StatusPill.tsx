export type StatusPillVariant =
  | "good"
  | "warning"
  | "danger"
  | "info"
  | "ghost"
  | "late"
  | "early"
  | "onTime"
  | "unknown"
  | "muted"
  | "live";

export type StatusPillSize = "sm" | "md" | "loop";

interface StatusPillProps {
  label: string;
  variant: StatusPillVariant;
  size?: StatusPillSize;
  showLiveDot?: boolean;
  ariaLabel?: string;
}

const variantClasses: Record<StatusPillVariant, string> = {
  good: "bg-emerald-600 text-white",
  warning: "bg-amber-500 text-white",
  danger: "bg-red-600 text-white",
  info: "bg-sky-600 text-white",
  ghost: "bg-zinc-500 text-white dark:bg-zinc-600",
  late: "bg-rose-600 text-white",
  early: "bg-amber-500 text-white",
  onTime: "bg-emerald-600 text-white",
  unknown: "bg-zinc-400 text-zinc-900 dark:bg-zinc-600 dark:text-white",
  muted: "bg-zinc-200 text-zinc-800 dark:bg-zinc-700 dark:text-zinc-100",
  live: "bg-emerald-600 text-white",
};

const sizeClasses: Record<StatusPillSize, string> = {
  sm: "px-2 py-0.5 text-[11px]",
  md: "px-2.5 py-1 text-xs",
  loop: "min-w-[30px] justify-center px-1.5 py-1 text-[13px] font-bold",
};

export function getStatusPillClassName(variant: StatusPillVariant): string {
  return variantClasses[variant];
}

export function StatusPill({
  label,
  variant,
  size = "md",
  showLiveDot = false,
  ariaLabel,
}: StatusPillProps): React.ReactElement {
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full font-semibold leading-none ${variantClasses[variant]} ${sizeClasses[size]}`}
      aria-label={ariaLabel}
    >
      {showLiveDot ? (
        <span className="relative flex h-2 w-2" aria-hidden="true">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white/70 opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
        </span>
      ) : null}
      {label}
    </span>
  );
}
