import {
  LOOP_INFO_BADGE_METRICS,
  type LoopInfoBadgeAlign,
  measureLoopInfoBadgeHeight,
  measureLoopInfoBadgeWidth,
} from "@/lib/loopMarkerLayout";
import type { EstimatedVehiclePosition } from "@/lib/tfl/types";
import { isPossibleGhostBus } from "@/lib/ghostDisplay";
import {
  formatFleetNumberLabel,
  formatRunningNumberLabel,
  resolveDisplayFleetNumber,
} from "@/lib/vehicleLabels";

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

  const fleetNo = resolveDisplayFleetNumber(vehicle);

  if (settings.showFleetNumber && fleetNo && !isGhost) {
    labels.push({
      key: "fleet",
      text: formatFleetNumberLabel(fleetNo, { short: true }),
    });
  }

  const runningNo =
    vehicle.ibusRunningNo ??
    vehicle.scheduledGhostRunningNo ??
    undefined;

  if (settings.showRunningNumber && runningNo) {
    labels.push({
      key: "running",
      text: formatRunningNumberLabel(runningNo, { short: true }),
    });
  }

  return labels;
}

interface LoopMarkerInfoBadgesProps {
  vehicle: EstimatedVehiclePosition;
  settings: LoopMarkerLabelSettings;
  anchorX: number;
  anchorY: number;
  align?: LoopInfoBadgeAlign;
}

export function LoopMarkerInfoBadges({
  vehicle,
  settings,
  anchorX,
  anchorY,
  align = "left",
}: LoopMarkerInfoBadgesProps): React.ReactElement | null {
  const labels = buildLoopMarkerLabels(vehicle, settings);
  if (labels.length === 0) {
    return null;
  }

  const metrics = LOOP_INFO_BADGE_METRICS;
  const cardWidth = measureLoopInfoBadgeWidth(labels, metrics);
  const cardHeight = measureLoopInfoBadgeHeight(labels.length, metrics);
  const cardX =
    align === "center"
      ? anchorX - cardWidth / 2
      : align === "right"
        ? anchorX - cardWidth
        : anchorX;

  return (
    <g transform={`translate(${cardX}, ${anchorY})`} pointerEvents="none">
      <rect
        x={0}
        y={0}
        width={cardWidth}
        height={cardHeight}
        rx={8}
        className="fill-zinc-950/78 stroke-zinc-500/55 dark:fill-zinc-950/88 dark:stroke-zinc-400/45"
      />
      {labels.map((label, index) => {
        const textY =
          metrics.paddingY +
          index * (metrics.rowHeight + metrics.rowGap) +
          metrics.rowHeight -
          3;

        return (
          <text
            key={label.key}
            x={
              align === "right"
                ? cardWidth - metrics.paddingX
                : align === "center"
                  ? cardWidth / 2
                  : metrics.paddingX
            }
            y={textY}
            textAnchor={
              align === "right" ? "end" : align === "center" ? "middle" : "start"
            }
            fontSize={metrics.fontSize}
            fontWeight={600}
            fill="#E4E4E7"
            fontFamily="Arial, sans-serif"
          >
            {label.text}
          </text>
        );
      })}
    </g>
  );
}
