import type { RouteAlert } from "@/lib/routeAlerts";

interface RouteAlertBadgesProps {
  alerts: RouteAlert[];
  compact?: boolean;
}

const toneClasses = {
  warning: "border-amber-500/40 bg-amber-950/40 text-amber-200",
  danger: "border-red-500/40 bg-red-950/40 text-red-200",
  neutral: "border-zinc-600 bg-zinc-800/60 text-zinc-300",
} as const;

export function RouteAlertBadges({
  alerts,
  compact = false,
}: RouteAlertBadgesProps): React.ReactElement | null {
  if (alerts.length === 0) {
    return null;
  }

  return (
    <div className={`flex flex-wrap gap-2 ${compact ? "" : "mt-2"}`}>
      {alerts.map((alert) => (
        <span
          key={alert.id}
          className={`rounded-full border px-2.5 py-1 text-xs font-medium ${toneClasses[alert.tone]}`}
        >
          {alert.label}
        </span>
      ))}
    </div>
  );
}
