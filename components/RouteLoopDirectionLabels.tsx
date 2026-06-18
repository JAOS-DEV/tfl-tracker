import type { LoopLayoutConfig } from "@/lib/constants";
import { getDirectionLabel } from "@/lib/routePositioning";
import type { NormalizedRoute } from "@/lib/tfl/types";

interface RouteLoopDirectionLabelsProps {
  route: NormalizedRoute;
  layout: LoopLayoutConfig;
  legStart: { x: number; y: number };
  legEnd: { x: number; y: number };
  direction: "outbound" | "inbound";
}

export function RouteLoopDirectionLabels({
  route,
  layout,
  legStart,
  legEnd,
  direction,
}: RouteLoopDirectionLabelsProps): React.ReactElement {
  const label = getDirectionLabel(route, direction);
  const midX = (legStart.x + legEnd.x) / 2;
  const midY = (legStart.y + legEnd.y) / 2;
  const laneOffset = direction === "outbound" ? -34 : 34;

  let x = midX;
  let y = midY + laneOffset;
  let textAnchor: "middle" | "start" | "end" = "middle";

  if (layout.orientation === "portrait") {
    x = legStart.x + (direction === "outbound" ? -72 : 72);
    y = midY;
    textAnchor = direction === "outbound" ? "end" : "start";
  }

  const fillClass =
    direction === "outbound"
      ? "fill-sky-700 dark:fill-sky-200"
      : "fill-violet-700 dark:fill-violet-200";

  return (
    <text
      x={x}
      y={y}
      textAnchor={textAnchor}
      fontSize={layout.orientation === "portrait" ? 13 : 12}
      fontWeight={700}
      className={fillClass}
      aria-hidden="true"
    >
      {label}
    </text>
  );
}
