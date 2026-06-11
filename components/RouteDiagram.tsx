import { StopRow } from "@/components/StopRow";
import { predictionsForStop } from "@/lib/tfl/normalizers";
import type {
  NormalizedRoute,
  NormalizedStop,
  NormalizedVehiclePrediction,
  RouteDirection,
} from "@/lib/tfl/types";

interface RouteDiagramProps {
  route: NormalizedRoute;
  direction: RouteDirection;
  predictions: NormalizedVehiclePrediction[];
  onStopSelect: (stop: NormalizedStop) => void;
}

export function RouteDiagram({
  route,
  direction,
  predictions,
  onStopSelect,
}: RouteDiagramProps): React.ReactElement {
  const stops = direction === "inbound" ? route.inbound : route.outbound;

  if (stops.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-zinc-300 p-6 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
        No stops found for the {direction} direction.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-zinc-200 bg-zinc-50/60 p-2 dark:border-zinc-800 dark:bg-zinc-950/40">
      {stops.map((stop, index) => (
        <StopRow
          key={stop.naptanId}
          stop={stop}
          predictions={predictionsForStop(predictions, stop.naptanId)}
          isFirst={index === 0}
          isLast={index === stops.length - 1}
          onSelect={onStopSelect}
        />
      ))}
    </div>
  );
}
