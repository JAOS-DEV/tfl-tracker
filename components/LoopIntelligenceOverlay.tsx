import type { LoopLayoutConfig } from "@/lib/constants";
import { mapProgressToLoopCoordinates } from "@/lib/routePositioning";
import type { BunchingCluster, LargeGapSegment } from "@/lib/tfl/types";

interface LoopIntelligenceOverlayProps {
  layout: LoopLayoutConfig;
  bunchingClusters: BunchingCluster[];
  largeGapSegments: LargeGapSegment[];
}

export function LoopIntelligenceOverlay({
  layout,
  bunchingClusters,
  largeGapSegments,
}: LoopIntelligenceOverlayProps): React.ReactElement {
  return (
    <g aria-hidden="true">
      {largeGapSegments.map((segment) => {
        const start = mapProgressToLoopCoordinates(segment.fromProgress, layout);
        const end = mapProgressToLoopCoordinates(segment.toProgress, layout);

        return (
          <line
            key={`gap-${segment.direction}-${segment.fromVehicleId}-${segment.toVehicleId}`}
            x1={start.x}
            y1={start.y}
            x2={end.x}
            y2={end.y}
            stroke="#F59E0B"
            strokeWidth={layout.orientation === "portrait" ? 10 : 8}
            strokeLinecap="round"
            opacity={0.35}
            strokeDasharray="10 8"
          />
        );
      })}

      {bunchingClusters.map((cluster, index) => (
        <g
          key={`bunching-${cluster.direction}-${cluster.vehicleIds.join("-")}-${index}`}
        >
          <rect
            x={cluster.centerX - 42}
            y={cluster.centerY - 30}
            width={84}
            height={18}
            rx={9}
            className="fill-amber-500/90"
          />
          <text
            x={cluster.centerX}
            y={cluster.centerY - 17}
            textAnchor="middle"
            fontSize={10}
            fontWeight={700}
            className="fill-white"
          >
            Bunching
          </text>
        </g>
      ))}
    </g>
  );
}
