import { EmbeddedBusIcon } from "@/components/BusIcon";
import { EmbeddedGhostIcon } from "@/components/EmbeddedGhostIcon";
import { LoopMarkerBadge } from "@/components/LoopMarkerBadge";
import { ghostStatusLabel } from "@/lib/ghostBusDetection";
import { scheduleAccessibleLabel } from "@/lib/scheduleDeviation";
import {
  formatMovementDecision,
  type SmoothMovementDecision,
} from "@/lib/smoothBusMovement";
import type { EstimatedVehiclePosition } from "@/lib/tfl/types";

interface RouteLoopBusMarkerProps {
  vehicle: EstimatedVehiclePosition;
  displayX: number;
  displayY: number;
  movementDecision?: SmoothMovementDecision;
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
  displayX,
  displayY,
  movementDecision,
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
  const debugTitle = movementDecision
    ? `Movement: ${formatMovementDecision(movementDecision)}`
    : undefined;

  const ringClass = isGhost
    ? "fill-zinc-400/20 stroke-zinc-400 dark:fill-zinc-500/20 dark:stroke-zinc-400"
    : adherenceRingClasses[vehicle.adherence];

  const badgeX = markerSize - 8;
  const badgeY = -20;
  const ghostX = badgeX + 34;
  const ghostY = badgeY - 2;

  return (
    <g
      className="cursor-pointer"
      transform={`translate(${displayX - half}, ${displayY - half - 8})`}
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
      {debugTitle ? <title>{debugTitle}</title> : null}
      <circle
        cx={half}
        cy={half}
        r={ringRadius}
        className={`stroke-2 transition-all duration-500 ${ringClass} ${
          isSelected ? "animate-pulse" : ""
        } ${vehicle.ghostStatus === "disappeared" ? "stroke-dashed" : ""}`}
      />
      <EmbeddedBusIcon
        routeNumber={vehicle.routeNumber}
        size={markerSize}
        isActive={isSelected}
        variant={isGhost ? "ghost" : isFaded ? "faded" : "live"}
        ariaLabel={label}
      />
      <g transform={`translate(${badgeX}, ${badgeY})`}>
        <LoopMarkerBadge vehicle={vehicle} />
      </g>
      {isGhost ? (
        <g transform={`translate(${ghostX}, ${ghostY})`}>
          <EmbeddedGhostIcon size={18} />
        </g>
      ) : null}
    </g>
  );
}
