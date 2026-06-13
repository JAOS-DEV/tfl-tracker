import type { EstimatedVehiclePosition } from "@/lib/tfl/types";
import { isPossibleGhostBus } from "@/lib/ghostDisplay";

export interface LoopMarkerLabelSettings {
  showRegistration: boolean;
  showFleetNumber: boolean;
  showRunningNumber: boolean;
}

export interface LoopMarkerLabelItem {
  key: string;
  text: string;
}

export function buildLoopMarkerLabels(
  vehicle: EstimatedVehiclePosition,
  settings: LoopMarkerLabelSettings,
): LoopMarkerLabelItem[] {
  const isGhost = isPossibleGhostBus(vehicle);
  const labels: LoopMarkerLabelItem[] = [];

  if (settings.showRegistration && vehicle.vehicleRegistration) {
    labels.push({
      key: "registration",
      text: `Reg: ${vehicle.vehicleRegistration}`,
    });
  }

  if (
    settings.showFleetNumber &&
    vehicle.vehicleFleetReference &&
    !isGhost
  ) {
    labels.push({
      key: "fleet",
      text: `Fleet: ${vehicle.vehicleFleetReference}`,
    });
  }

  const runningNo =
    vehicle.ibusRunningNo ??
    vehicle.scheduledGhostRunningNo ??
    undefined;

  if (settings.showRunningNumber && runningNo) {
    labels.push({
      key: "running",
      text: `Run: ${runningNo}`,
    });
  }

  return labels;
}

interface LoopMarkerInfoBadgesProps {
  vehicle: EstimatedVehiclePosition;
  settings: LoopMarkerLabelSettings;
  anchorX: number;
  anchorY: number;
}

export function LoopMarkerInfoBadges({
  vehicle,
  settings,
  anchorX,
  anchorY,
}: LoopMarkerInfoBadgesProps): React.ReactElement | null {
  const labels = buildLoopMarkerLabels(vehicle, settings);
  if (labels.length === 0) {
    return null;
  }

  return (
    <g transform={`translate(${anchorX}, ${anchorY})`}>
      {labels.map((label, index) => (
        <g key={label.key} transform={`translate(0, ${index * 14})`}>
          <rect
            x={0}
            y={-10}
            width={Math.max(56, label.text.length * 5.8)}
            height={14}
            rx={4}
            className="fill-zinc-800/85 stroke-zinc-600 dark:fill-zinc-900/90 dark:stroke-zinc-500"
          />
          <text
            x={4}
            y={0}
            fontSize={9}
            fontWeight={600}
            fill="#F4F4F5"
            fontFamily="Arial, sans-serif"
          >
            {label.text}
          </text>
        </g>
      ))}
    </g>
  );
}
