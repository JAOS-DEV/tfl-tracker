import type { LoopOrientation } from "@/lib/constants";
import { wrapStopLabel } from "@/lib/format";
import type { LoopStopNode, StopDisruption } from "@/lib/tfl/types";

interface RouteLoopStopNodeProps {
  node: LoopStopNode;
  x: number;
  y: number;
  isSelected: boolean;
  hasNearbyBus: boolean;
  isClosed: boolean;
  stopDisruption?: StopDisruption;
  compact: boolean;
  orientation: LoopOrientation;
  onSelect: () => void;
}

export function RouteLoopStopNode({
  node,
  x,
  y,
  isSelected,
  hasNearbyBus,
  isClosed,
  stopDisruption,
  compact,
  orientation,
  onSelect,
}: RouteLoopStopNodeProps): React.ReactElement {
  const radius = node.isTerminal ? 8 : hasNearbyBus ? 7 : compact ? 6 : 5.5;
  const hitRadius = compact ? 24 : 18;
  const showLabel = node.shouldLabel || isSelected || hasNearbyBus;

  let labelX = x;
  let labelY = y - 18;
  let textAnchor: "middle" | "start" | "end" = "middle";

  if (orientation === "portrait") {
    if (node.direction === "outbound") {
      labelX = x - 10;
      labelY = y + 5;
      textAnchor = "end";
    } else {
      labelX = x + 10;
      labelY = y + 5;
      textAnchor = "start";
    }
  } else if (node.direction === "inbound") {
    labelY = y + 20;
  }

  const fontSize = compact ? 14 : 12;
  const lineHeight = compact ? 15 : 13;
  const maxCharsPerLine =
    orientation === "portrait" ? (compact ? 20 : 18) : compact ? 24 : 20;
  const labelLines = wrapStopLabel(node.stop.name, maxCharsPerLine, 2);
  const multiLine = labelLines.length > 1;
  const firstLineY = multiLine ? labelY - lineHeight / 2 : labelY;

  return (
    <g
      className="cursor-pointer"
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect();
        }
      }}
      role="button"
      tabIndex={0}
      aria-label={`Stop ${node.stop.name}${
        isClosed
          ? ", closed"
          : hasNearbyBus
            ? ", next stop for approaching bus"
            : ""
      }`}
    >
      <circle cx={x} cy={y} r={hitRadius} className="fill-transparent" />
      <circle
        cx={x}
        cy={y}
        r={radius}
        className={`${
          isClosed
            ? "fill-red-200 dark:fill-red-950/70"
            : node.isTerminal
              ? "fill-sky-500"
              : hasNearbyBus
                ? "fill-amber-400"
                : "fill-zinc-400 dark:fill-zinc-500"
        } ${
          isSelected
            ? "stroke-zinc-900 stroke-[3] dark:stroke-white"
            : isClosed
              ? "stroke-red-600 stroke-2 dark:stroke-red-400"
              : "stroke-zinc-700 stroke-2 dark:stroke-zinc-300"
        }`}
      />
      {isClosed ? (
        <g aria-hidden="true" style={{ pointerEvents: "none" }}>
          <line
            x1={x - radius - 1}
            y1={y - radius - 1}
            x2={x + radius + 1}
            y2={y + radius + 1}
            stroke="#DC2626"
            strokeWidth={2.5}
            strokeLinecap="round"
          />
          <line
            x1={x + radius + 1}
            y1={y - radius - 1}
            x2={x - radius - 1}
            y2={y + radius + 1}
            stroke="#DC2626"
            strokeWidth={2.5}
            strokeLinecap="round"
          />
        </g>
      ) : null}
      {isClosed && stopDisruption ? (
        <title>{stopDisruption.description}</title>
      ) : null}
      {showLabel ? (
        <text
          x={labelX}
          y={firstLineY}
          textAnchor={textAnchor}
          fontSize={fontSize}
          fontWeight={node.isTerminal || isSelected ? 700 : 600}
          className="fill-zinc-900 dark:fill-zinc-50"
          style={{ pointerEvents: "none" }}
        >
          {labelLines.map((line, index) => (
            <tspan key={`${node.stop.naptanId}-${index}`} x={labelX} dy={index === 0 ? 0 : lineHeight}>
              {line}
            </tspan>
          ))}
        </text>
      ) : null}
    </g>
  );
}
