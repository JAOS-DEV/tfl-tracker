import { getDirectionLabel } from "@/lib/routePositioning";
import type { DirectionIntelligence, NormalizedRoute } from "@/lib/tfl/types";

interface DirectionIntelligenceRowProps {
  route: NormalizedRoute;
  outbound: DirectionIntelligence;
  inbound: DirectionIntelligence;
}

function DirectionStat({
  intelligence,
  route,
}: {
  intelligence: DirectionIntelligence;
  route: NormalizedRoute;
}): React.ReactElement {
  const directionClasses =
    intelligence.direction === "outbound"
      ? "border-sky-200 bg-sky-50 dark:border-sky-900 dark:bg-sky-950/40"
      : "border-violet-200 bg-violet-50 dark:border-violet-900 dark:bg-violet-950/40";

  return (
    <div className={`rounded-xl border px-3 py-2.5 ${directionClasses}`}>
      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
        {getDirectionLabel(route, intelligence.direction)}
      </p>
      <p className="mt-1 text-sm font-medium text-zinc-900 dark:text-zinc-100">
        {intelligence.liveVehicleCount} bus
        {intelligence.liveVehicleCount === 1 ? "" : "es"}
        {intelligence.averageGapMinutes !== null
          ? ` · avg gap ${intelligence.averageGapMinutes} min`
          : ""}
        {intelligence.largestGapMinutes !== null
          ? ` · largest gap ${intelligence.largestGapMinutes} min`
          : ""}
      </p>
      {intelligence.bunchingClusterCount > 0 ||
      intelligence.largeGapCount > 0 ? (
        <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
          {intelligence.bunchingClusterCount > 0
            ? `${intelligence.bunchingClusterCount} possible bunching`
            : null}
          {intelligence.bunchingClusterCount > 0 &&
          intelligence.largeGapCount > 0
            ? " · "
            : null}
          {intelligence.largeGapCount > 0
            ? `${intelligence.largeGapCount} large predicted gap${intelligence.largeGapCount === 1 ? "" : "s"}`
            : null}
        </p>
      ) : null}
    </div>
  );
}

export function DirectionIntelligenceRow({
  route,
  outbound,
  inbound,
}: DirectionIntelligenceRowProps): React.ReactElement {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      <DirectionStat intelligence={outbound} route={route} />
      <DirectionStat intelligence={inbound} route={route} />
    </div>
  );
}
