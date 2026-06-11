import { buildRouteAlertBadges, calculateRouteSummary } from "@/lib/headway";
import type { NormalizedVehiclePrediction } from "@/lib/tfl/types";

interface RouteSummaryBadgesProps {
  predictions: NormalizedVehiclePrediction[];
}

const toneClasses = {
  info: "border-sky-500/40 bg-sky-950/40 text-sky-200",
  warning: "border-amber-500/40 bg-amber-950/40 text-amber-200",
  neutral: "border-zinc-600 bg-zinc-800/60 text-zinc-300",
} as const;

export function RouteSummaryBadges({
  predictions,
}: RouteSummaryBadgesProps): React.ReactElement {
  const summary = calculateRouteSummary(predictions);
  const badges = buildRouteAlertBadges(summary);

  return (
    <div className="flex flex-wrap gap-2">
      {badges.map((badge) => (
        <span
          key={badge.id}
          className={`rounded-full border px-2.5 py-1 text-xs font-medium ${toneClasses[badge.tone]}`}
        >
          {badge.label}
        </span>
      ))}
    </div>
  );
}
