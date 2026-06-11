import {
  scheduleAccessibleLabel,
  scheduleLoopBadgeLabel,
} from "@/lib/scheduleDeviation";
import type { EstimatedVehiclePosition } from "@/lib/tfl/types";

interface LoopMarkerBadgeProps {
  vehicle: EstimatedVehiclePosition;
}

const badgeColors = {
  onTime: "#059669",
  early: "#F59E0B",
  late: "#E11D48",
} as const;

function getBadgeFill(
  status: EstimatedVehiclePosition["scheduleStatus"],
): string {
  if (status === "early") {
    return badgeColors.early;
  }
  if (status === "late") {
    return badgeColors.late;
  }
  return badgeColors.onTime;
}

export function LoopMarkerBadge({
  vehicle,
}: LoopMarkerBadgeProps): React.ReactElement | null {
  if (vehicle.isSuspectedGhost) {
    return null;
  }

  const label = scheduleLoopBadgeLabel(
    vehicle.scheduleStatus,
    vehicle.scheduleDeviationMinutes,
    vehicle.scheduleMatchConfidence,
  );

  if (!label) {
    return null;
  }

  const width = label.length > 2 ? 40 : 30;
  const height = 22;

  return (
    <g
      role="img"
      aria-label={scheduleAccessibleLabel(
        vehicle.scheduleStatus,
        vehicle.scheduleDeviationMinutes,
      )}
    >
      <rect
        x={0}
        y={0}
        width={width}
        height={height}
        rx={height / 2}
        fill={getBadgeFill(vehicle.scheduleStatus)}
      />
      <text
        x={width / 2}
        y={height / 2 + 4}
        textAnchor="middle"
        fontSize="12"
        fontWeight="700"
        fill="#FFFFFF"
        fontFamily="Arial, sans-serif"
      >
        {label}
      </text>
    </g>
  );
}
