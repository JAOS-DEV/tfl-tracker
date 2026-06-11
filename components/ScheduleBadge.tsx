import {
  scheduleAccessibleLabel,
  scheduleBadgeLabel,
} from "@/lib/scheduleDeviation";
import type { EstimatedVehiclePosition } from "@/lib/tfl/types";

interface ScheduleBadgeProps {
  vehicle: EstimatedVehiclePosition;
}

const toneClasses = {
  early: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
  onTime:
    "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
  late: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200",
  unknown: "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
} as const;

export function ScheduleBadge({
  vehicle,
}: ScheduleBadgeProps): React.ReactElement | null {
  if (vehicle.isSuspectedGhost) {
    return null;
  }

  const label = scheduleBadgeLabel(
    vehicle.scheduleStatus,
    vehicle.scheduleDeviationMinutes,
    vehicle.scheduleMatchConfidence,
  );

  if (!label) {
    return null;
  }

  const tone =
    label === "?"
      ? "unknown"
      : vehicle.scheduleStatus === "unknown"
        ? "unknown"
        : vehicle.scheduleStatus;

  return (
    <span
      className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none ${toneClasses[tone]}`}
      aria-label={scheduleAccessibleLabel(
        vehicle.scheduleStatus,
        vehicle.scheduleDeviationMinutes,
      )}
    >
      {label}
    </span>
  );
}
