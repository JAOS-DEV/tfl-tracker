import type { LoopLayoutConfig } from "@/lib/constants";
import type { RouteDirection } from "@/lib/tfl/types";

interface RouteLoopDirectionChevronsProps {
  layout: LoopLayoutConfig;
  direction: RouteDirection;
  legStart: { x: number; y: number };
  legEnd: { x: number; y: number };
}

function chevronPoints(
  x: number,
  y: number,
  direction: RouteDirection,
  layout: LoopLayoutConfig,
): string {
  const size = 10;

  if (layout.orientation === "portrait") {
    if (direction === "outbound") {
      return `${x - size},${y - size} ${x + size},${y - size} ${x},${y + size}`;
    }
    return `${x - size},${y + size} ${x + size},${y + size} ${x},${y - size}`;
  }

  if (direction === "outbound") {
    return `${x - size},${y - size} ${x + size},${y} ${x - size},${y + size}`;
  }
  return `${x + size},${y - size} ${x - size},${y} ${x + size},${y + size}`;
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
  const count = Math.min(6, Math.max(3, Math.round(legLength / 90)));
  const chevrons: Array<{ x: number; y: number }> = [];

  for (let index = 1; index <= count; index += 1) {
    const t = index / (count + 1);

    if (orientation === "portrait") {
      const y = legStart.y + (legEnd.y - legStart.y) * t;
      chevrons.push({
        x: legStart.x + (direction === "outbound" ? 22 : -22),
        y,
      });
    } else {
      const x = legStart.x + (legEnd.x - legStart.x) * t;
      chevrons.push({
        x,
        y: legStart.y + (direction === "outbound" ? -22 : 22),
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
          points={chevronPoints(point.x, point.y, direction, layout)}
          className={fillClass}
          opacity={0.85}
        />
      ))}
    </g>
  );
}
