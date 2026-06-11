import { StatusPill } from "@/components/StatusPill";
import {
  scheduleAccessibleLabel,
  scheduleBadgeLabel,
  scheduleLoopBadgeLabel,
} from "@/lib/scheduleDeviation";
import type { EstimatedVehiclePosition } from "@/lib/tfl/types";

interface ScheduleBadgeProps {
  vehicle: EstimatedVehiclePosition;
  context?: "default" | "loop";
}

function mapScheduleVariant(
  status: EstimatedVehiclePosition["scheduleStatus"],
): "early" | "onTime" | "late" | "unknown" {
  if (status === "early") {
    return "early";
  }
  if (status === "late") {
    return "late";
  }
  if (status === "onTime") {
    return "onTime";
  }
  return "unknown";
}

export function ScheduleBadge({
  vehicle,
  context = "default",
}: ScheduleBadgeProps): React.ReactElement | null {
  if (vehicle.isSuspectedGhost) {
    return null;
  }

  const label =
    context === "loop"
      ? scheduleLoopBadgeLabel(
          vehicle.scheduleStatus,
          vehicle.scheduleDeviationMinutes,
          vehicle.scheduleMatchConfidence,
        )
      : scheduleBadgeLabel(
          vehicle.scheduleStatus,
          vehicle.scheduleDeviationMinutes,
          vehicle.scheduleMatchConfidence,
        );

  if (!label || label === "?") {
    return null;
  }

  return (
    <StatusPill
      label={label}
      variant={mapScheduleVariant(vehicle.scheduleStatus)}
      size={context === "loop" ? "loop" : "sm"}
      ariaLabel={scheduleAccessibleLabel(
        vehicle.scheduleStatus,
        vehicle.scheduleDeviationMinutes,
      )}
    />
  );
}
