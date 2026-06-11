import { StatusPill } from "@/components/StatusPill";
import type { RouteAlert } from "@/lib/routeAlerts";

interface RouteAlertBadgesProps {
  alerts: RouteAlert[];
  compact?: boolean;
}

function mapAlertTone(
  tone: RouteAlert["tone"],
): "warning" | "danger" | "muted" {
  if (tone === "warning") {
    return "warning";
  }
  if (tone === "danger") {
    return "danger";
  }
  return "muted";
}

export function RouteAlertBadges({
  alerts,
  compact = false,
}: RouteAlertBadgesProps): React.ReactElement | null {
  if (alerts.length === 0) {
    return null;
  }

  return (
    <div className={`flex flex-wrap gap-1.5 ${compact ? "" : "mt-2"}`}>
      {alerts.map((alert) => (
        <StatusPill
          key={alert.id}
          label={alert.label}
          variant={mapAlertTone(alert.tone)}
          size="sm"
        />
      ))}
    </div>
  );
}
