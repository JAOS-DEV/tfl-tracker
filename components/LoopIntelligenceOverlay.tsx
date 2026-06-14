import type { BunchingCluster } from "@/lib/tfl/types";

interface LoopIntelligenceOverlayProps {
  bunchingClusters: BunchingCluster[];
}

export function LoopIntelligenceOverlay({
  bunchingClusters,
}: LoopIntelligenceOverlayProps): React.ReactElement {
  return (
    <g aria-hidden="true">
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
