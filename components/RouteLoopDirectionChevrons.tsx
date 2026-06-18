import type { LoopLayoutConfig } from "@/lib/constants";
import type { RouteDirection } from "@/lib/tfl/types";

interface RouteLoopDirectionChevronsProps {
  layout: LoopLayoutConfig;
  direction: RouteDirection;
  legStart: { x: number; y: number };
  legEnd: { x: number; y: number };
}

function chevronPointsAlongLeg(
  x: number,
  y: number,
  legStart: { x: number; y: number },
  legEnd: { x: number; y: number },
  size: number,
): string {
  const dx = legEnd.x - legStart.x;
  const dy = legEnd.y - legStart.y;
  const length = Math.hypot(dx, dy) || 1;
  const unitX = dx / length;
  const unitY = dy / length;
  const perpX = -unitY;
  const perpY = unitX;

  const tipX = x + unitX * size;
  const tipY = y + unitY * size;
  const backX = x - unitX * size * 0.35;
  const backY = y - unitY * size * 0.35;
  const leftX = backX + perpX * size * 0.85;
  const leftY = backY + perpY * size * 0.85;
  const rightX = backX - perpX * size * 0.85;
  const rightY = backY - perpY * size * 0.85;

  return `${tipX},${tipY} ${leftX},${leftY} ${rightX},${rightY}`;
}

export function RouteLoopDirectionChevrons({
  layout,
  direction,
  legStart,
  legEnd,
}: RouteLoopDirectionChevronsProps): React.ReactElement {
  const { orientation } = layout;
  const legLength =
    orientation === "portrait"
      ? Math.abs(legEnd.y - legStart.y)
      : Math.abs(legEnd.x - legStart.x);
  const count = Math.min(7, Math.max(4, Math.round(legLength / 75)));
  const chevrons: Array<{ x: number; y: number }> = [];
  const laneOffset = direction === "outbound" ? 24 : -24;

  for (let index = 1; index <= count; index += 1) {
    const t = index / (count + 1);

    if (orientation === "portrait") {
      const y = legStart.y + (legEnd.y - legStart.y) * t;
      chevrons.push({
        x: legStart.x + laneOffset,
        y,
      });
    } else {
      const x = legStart.x + (legEnd.x - legStart.x) * t;
      chevrons.push({
        x,
        y: legStart.y + laneOffset,
      });
    }
  }

  const fillClass =
    direction === "outbound"
      ? "fill-sky-500 dark:fill-sky-400"
      : "fill-violet-500 dark:fill-violet-400";

  return (
    <g aria-hidden="true">
      {chevrons.map((point, index) => (
        <polygon
          key={`${direction}-chevron-${index}`}
          points={chevronPointsAlongLeg(
            point.x,
            point.y,
            legStart,
            legEnd,
            12,
          )}
          className={fillClass}
          opacity={0.95}
        />
      ))}
    </g>
  );
}
