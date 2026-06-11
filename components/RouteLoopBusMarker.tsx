import { BusIcon } from "@/components/BusIcon";
import { GhostIcon } from "@/components/GhostIcon";
import { ScheduleBadge } from "@/components/ScheduleBadge";
import { ghostStatusLabel } from "@/lib/ghostBusDetection";
import { scheduleAccessibleLabel } from "@/lib/scheduleDeviation";
import type { EstimatedVehiclePosition } from "@/lib/tfl/types";

interface RouteLoopBusMarkerProps {
  vehicle: EstimatedVehiclePosition;
  isSelected: boolean;
  markerSize?: number;
  onSelect: () => void;
}

const adherenceRingClasses = {
  onTime:
    "fill-emerald-500/25 stroke-emerald-500 dark:fill-emerald-400/30 dark:stroke-emerald-400",
  late: "fill-red-500/25 stroke-red-500 dark:fill-red-400/30 dark:stroke-red-400",
  early:
    "fill-amber-400/30 stroke-amber-500 dark:fill-amber-300/30 dark:stroke-amber-300",
} as const;

export function RouteLoopBusMarker({
  vehicle,
  isSelected,
  markerSize = 32,
  onSelect,
}: RouteLoopBusMarkerProps): React.ReactElement {
  const half = markerSize / 2;
  const ringRadius = half + 10;
  const isGhost = vehicle.isSuspectedGhost;
  const isFaded =
    vehicle.ghostStatus === "missingLatest" ||
    vehicle.ghostStatus === "disappeared" ||
    isGhost;

  const statusLabel = isGhost
    ? ghostStatusLabel(vehicle.ghostStatus)
    : scheduleAccessibleLabel(
        vehicle.scheduleStatus,
        vehicle.scheduleDeviationMinutes,
      );

  const label = vehicle.matched
    ? `Bus ${vehicle.routeNumber}, ${statusLabel}, estimated near ${vehicle.nextStop?.name ?? "route"}`
    : `Bus ${vehicle.routeNumber} position unavailable`;

  const ringClass = isGhost
    ? "fill-zinc-400/20 stroke-zinc-400 dark:fill-zinc-500/20 dark:stroke-zinc-400"
    : adherenceRingClasses[vehicle.adherence];

  return (
    <g
      className="cursor-pointer"
      transform={`translate(${vehicle.x - half}, ${vehicle.y - half - 8})`}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect();
        }
      }}
      role="button"
      tabIndex={0}
      aria-label={label}
      opacity={isFaded ? 0.65 : 1}
    >
      <circle
        cx={half}
        cy={half}
        r={ringRadius}
        className={`stroke-2 transition-all duration-500 ${ringClass} ${
          isSelected ? "animate-pulse" : ""
        } ${vehicle.ghostStatus === "disappeared" ? "stroke-dashed" : ""}`}
      />
      <foreignObject x={0} y={0} width={markerSize} height={markerSize}>
        <BusIcon
          routeNumber={vehicle.routeNumber}
          size={markerSize}
          isActive={isSelected}
          variant={isGhost ? "ghost" : isFaded ? "faded" : "live"}
          className="drop-shadow-md hover:scale-110"
        />
      </foreignObject>
      <foreignObject
        x={markerSize - 22}
        y={-22}
        width={60}
        height={36}
        className="overflow-visible"
      >
        <div className="flex items-center justify-end gap-1">
          <ScheduleBadge vehicle={vehicle} context="loop" />
          {isGhost ? (
            <span
              className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-violet-500 shadow-lg ring-2 ring-white dark:bg-violet-400 dark:ring-violet-100"
              aria-hidden
            >
              <GhostIcon size={18} variant="marker" />
            </span>
          ) : null}
        </div>
      </foreignObject>
    </g>
  );
}
