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
  const isScheduledGhost = vehicle.isScheduledGhostCandidate === true;
  const isGhost = vehicle.isSuspectedGhost;
  const isFaded =
    vehicle.ghostStatus === "missingLatest" ||
    vehicle.ghostStatus === "disappeared" ||
    (isGhost && !isScheduledGhost);

  const statusLabel = isScheduledGhost
    ? `Possible ghost bus, running number ${vehicle.scheduledGhostRunningNo ?? "unknown"}`
    : isGhost
      ? ghostStatusLabel(vehicle.ghostStatus)
      : scheduleAccessibleLabel(
          vehicle.scheduleStatus,
          vehicle.scheduleDeviationMinutes,
        );

  const label = isScheduledGhost
    ? `Possible ghost bus ${vehicle.routeNumber}, running ${vehicle.scheduledGhostRunningNo ?? "?"} near ${vehicle.matchedStopName ?? "route"}`
    : vehicle.matched
      ? `Bus ${vehicle.routeNumber}, ${statusLabel}, estimated near ${vehicle.nextStop?.name ?? "route"}`
      : `Bus ${vehicle.routeNumber} position unavailable`;
  const debugTitle = movementDecision
    ? `Movement: ${formatMovementDecision(movementDecision)}`
    : undefined;

  const ringClass = isScheduledGhost
    ? "fill-violet-400/15 stroke-violet-400 stroke-dashed dark:fill-violet-500/15 dark:stroke-violet-300"
    : isGhost
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
        } ${vehicle.ghostStatus === "disappeared" && !isScheduledGhost ? "stroke-dashed" : ""}`}
      />
      <EmbeddedBusIcon
        routeNumber={
          isScheduledGhost
            ? vehicle.scheduledGhostRunningNo ?? "?"
            : vehicle.routeNumber
        }
        size={markerSize}
        isActive={isSelected}
        variant={isScheduledGhost || isGhost ? "ghost" : isFaded ? "faded" : "live"}
        ariaLabel={label}
      />
      {!isScheduledGhost ? (
        <g transform={`translate(${badgeX}, ${badgeY})`}>
          <LoopMarkerBadge vehicle={vehicle} />
        </g>
      ) : (
        <g transform={`translate(${badgeX}, ${badgeY})`}>
          <rect
            x={-8}
            y={-10}
            width={42}
            height={18}
            rx={6}
            className="fill-violet-700/90 stroke-violet-300 dark:fill-violet-900 dark:stroke-violet-400"
          />
          <text
            x={13}
            y={3}
            textAnchor="middle"
            fontSize={10}
            fontWeight={700}
            fill="#FFFFFF"
            fontFamily="Arial, sans-serif"
          >
            Ghost
          </text>
        </g>
      )}
      {isGhost ? (
        <g transform={`translate(${ghostX}, ${ghostY})`}>
          <EmbeddedGhostIcon size={18} />
        </g>
      ) : null}
    </g>
  );
}
