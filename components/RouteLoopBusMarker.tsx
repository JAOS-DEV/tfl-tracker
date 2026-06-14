import { memo } from "react";
import { EmbeddedBusIcon } from "@/components/BusIcon";
import {
  buildLoopMarkerLabels,
  LoopMarkerInfoBadges,
  type LoopMarkerLabelSettings,
} from "@/components/LoopMarkerInfoBadges";
import { LoopMarkerBadge } from "@/components/LoopMarkerBadge";
import type { LoopLayoutConfig } from "@/lib/constants";
import {
  getBusMarkerGroupOffsetY,
  getLoopInfoBadgePlacement,
  isTerminusConnectorMarker,
} from "@/lib/loopMarkerLayout";
import {
  getGhostMarkerIconText,
  getPossibleGhostMarkerLabel,
  GHOST_MARKER_RING_CLASS,
  isPossibleGhostBus,
  POSSIBLE_GHOST_LABEL,
} from "@/lib/ghostDisplay";
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
  loopLabelSettings?: LoopMarkerLabelSettings;
  layout?: LoopLayoutConfig;
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
  unknown:
    "fill-sky-500/20 stroke-sky-500 dark:fill-sky-400/20 dark:stroke-sky-400",
} as const;

const terminusRingClass =
  "fill-zinc-400/20 stroke-zinc-500 stroke-dashed dark:fill-zinc-500/20 dark:stroke-zinc-400";

export const RouteLoopBusMarker = memo(function RouteLoopBusMarker({
  vehicle,
  displayX,
  displayY,
  movementDecision,
  loopLabelSettings,
  layout,
  isSelected,
  markerSize = 32,
  onSelect,
}: RouteLoopBusMarkerProps): React.ReactElement {
  const half = markerSize / 2;
  const ringRadius = half + 10;
  const isGhost = isPossibleGhostBus(vehicle);
  const isTerminus = vehicle.markerState === "terminus-layover";
  const isFaded =
    !isGhost &&
    !isTerminus &&
    (vehicle.ghostStatus === "missingLatest" ||
      vehicle.ghostStatus === "disappeared");

  const statusLabel = isGhost
    ? `${POSSIBLE_GHOST_LABEL}, running number ${getGhostMarkerIconText(vehicle)}`
    : isTerminus
      ? vehicle.terminusLayoverLabel ?? "At terminus"
      : scheduleAccessibleLabel(
          vehicle.scheduleStatus,
          vehicle.scheduleDeviationMinutes,
        );

  const label = isGhost
    ? getPossibleGhostMarkerLabel(vehicle)
    : vehicle.matched
      ? `Bus ${vehicle.routeNumber}, ${statusLabel}, estimated near ${vehicle.nextStop?.name ?? "route"}`
      : `Bus ${vehicle.routeNumber} position unavailable`;
  const debugTitle = movementDecision
    ? `Movement: ${formatMovementDecision(movementDecision)}`
    : undefined;

  const ringClass = isGhost
    ? GHOST_MARKER_RING_CLASS
    : isTerminus
      ? terminusRingClass
      : adherenceRingClasses[vehicle.adherence];

  const badgeX = markerSize - 8;
  const badgeY = -20;
  const infoLabels = loopLabelSettings
    ? buildLoopMarkerLabels(vehicle, loopLabelSettings)
    : [];
  const infoBadgePlacement =
    layout && infoLabels.length > 0
      ? getLoopInfoBadgePlacement(markerSize)
      : null;
  const groupOffsetY = getBusMarkerGroupOffsetY({
    alignToConnector:
      isTerminus && layout != null && isTerminusConnectorMarker(vehicle),
  });
  const iconText = isGhost
    ? getGhostMarkerIconText(vehicle)
    : vehicle.routeNumber;
  const handleSelect = (): void => {
    onSelect();
  };

  return (
    <g
      className="cursor-pointer"
      transform={`translate(${displayX - half}, ${displayY - half + groupOffsetY})`}
      onPointerDown={handleSelect}
      onClick={handleSelect}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          handleSelect();
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
        r={ringRadius + 8}
        fill="transparent"
        stroke="transparent"
        strokeWidth={1}
      />
      <circle
        cx={half}
        cy={half}
        r={ringRadius}
        className={`stroke-2 transition-all duration-500 ${ringClass} ${
          isSelected ? "animate-pulse" : ""
        }`}
      />
      <EmbeddedBusIcon
        routeNumber={iconText}
        size={markerSize}
        isActive={isSelected}
        variant={isGhost ? "ghost" : isFaded || isTerminus ? "faded" : "live"}
        ariaLabel={label}
      />
      {isGhost ? (
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
      ) : isTerminus ? (
        <g transform={`translate(${badgeX}, ${badgeY})`}>
          <rect
            x={-10}
            y={-10}
            width={48}
            height={18}
            rx={6}
            className="fill-zinc-600/90 stroke-zinc-400 dark:fill-zinc-800 dark:stroke-zinc-500"
          />
          <text
            x={14}
            y={3}
            textAnchor="middle"
            fontSize={10}
            fontWeight={700}
            fill="#FFFFFF"
            fontFamily="Arial, sans-serif"
          >
            Waiting
          </text>
        </g>
      ) : (
        <g transform={`translate(${badgeX}, ${badgeY})`}>
          <LoopMarkerBadge vehicle={vehicle} />
        </g>
      )}
      {loopLabelSettings && infoBadgePlacement ? (
        <LoopMarkerInfoBadges
          vehicle={vehicle}
          settings={loopLabelSettings}
          anchorX={infoBadgePlacement.anchorX}
          anchorY={infoBadgePlacement.anchorY}
          align={infoBadgePlacement.align}
        />
      ) : null}
    </g>
  );
});
