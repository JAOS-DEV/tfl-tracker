import { BusIcon } from "@/components/BusIcon";
import { adherenceLabel } from "@/lib/scheduleAdherence";
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
  const statusLabel = adherenceLabel(vehicle.adherence);
  const label = vehicle.matched
    ? `Bus ${vehicle.routeNumber}, ${statusLabel}, estimated near ${vehicle.nextStop?.name ?? "route"}`
    : `Bus ${vehicle.routeNumber} position unavailable`;

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
    >
      <circle
        cx={half}
        cy={half}
        r={ringRadius}
        className={`stroke-2 transition-all duration-500 ${
          adherenceRingClasses[vehicle.adherence]
        } ${isSelected ? "animate-pulse" : ""}`}
      />
      <foreignObject x={0} y={0} width={markerSize} height={markerSize}>
        <BusIcon
          routeNumber={vehicle.routeNumber}
          size={markerSize}
          isActive={isSelected}
          className="drop-shadow-md hover:scale-110"
        />
      </foreignObject>
    </g>
  );
}
