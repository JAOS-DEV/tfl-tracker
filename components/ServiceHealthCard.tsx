import { DirectionIntelligenceRow } from "@/components/DirectionIntelligenceRow";
import { buildServiceAlertBadges } from "@/lib/serviceIntelligence";
import type { NormalizedRoute, ServiceHealthMetrics } from "@/lib/tfl/types";

interface ServiceHealthCardProps {
  route: NormalizedRoute;
  metrics: ServiceHealthMetrics;
  compact?: boolean;
}

const toneClasses = {
  info: "border-sky-500/40 bg-sky-950/40 text-sky-200",
  warning: "border-amber-500/40 bg-amber-950/40 text-amber-200",
  neutral: "border-zinc-600 bg-zinc-800/60 text-zinc-300",
  success: "border-emerald-500/40 bg-emerald-950/40 text-emerald-200",
  danger: "border-red-500/40 bg-red-950/40 text-red-200",
} as const;

function healthScoreColor(score: number): string {
  if (score >= 85) {
    return "text-emerald-600 dark:text-emerald-300";
  }
  if (score >= 65) {
    return "text-sky-600 dark:text-sky-300";
  }
  if (score >= 40) {
    return "text-amber-600 dark:text-amber-300";
  }
  return "text-red-600 dark:text-red-300";
}

export function ServiceHealthCard({
  route,
  metrics,
  compact = false,
}: ServiceHealthCardProps): React.ReactElement {
  const badges = buildServiceAlertBadges(metrics);

  return (
    <div
      className={`space-y-3 text-sm ${
        compact
          ? "rounded-xl bg-zinc-100/80 p-3 dark:bg-zinc-800/50"
          : "rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-zinc-500">
            Service health estimate
          </p>
          <p
            className={`mt-1 text-2xl font-bold ${healthScoreColor(metrics.healthScore)}`}
          >
            {metrics.healthScore}
            <span className="ml-2 text-sm font-medium text-zinc-600 dark:text-zinc-300">
              {metrics.healthLabel}
            </span>
          </p>
          <p className="mt-1 text-xs text-zinc-500">
            Estimated from TfL live arrival data. Schedule position is estimated,
            not official.
          </p>
        </div>
      </div>

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

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
        <div>
          <p className="text-xs uppercase tracking-wide text-zinc-500">
            Est. on time
          </p>
          <p className="mt-1 text-lg font-semibold">
            {metrics.estimatedOnTimeCount}
          </p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-zinc-500">
            Est. late
          </p>
          <p className="mt-1 text-lg font-semibold">
            {metrics.estimatedLateCount}
          </p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-zinc-500">
            Est. early
          </p>
          <p className="mt-1 text-lg font-semibold">
            {metrics.estimatedEarlyCount}
          </p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-zinc-500">
            Schedule uncertain
          </p>
          <p className="mt-1 text-lg font-semibold">
            {metrics.unknownScheduleMatchCount}
          </p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-zinc-500">
            Possible ghosts
          </p>
          <p className="mt-1 text-lg font-semibold">
            {metrics.possibleGhostCount}
          </p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-zinc-500">
            Live vehicles
          </p>
          <p className="mt-1 text-lg font-semibold">{metrics.liveVehicleCount}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-zinc-500">
            Avg predicted gap
          </p>
          <p className="mt-1 text-lg font-semibold">
            {metrics.averageGapMinutes !== null
              ? `${metrics.averageGapMinutes} min`
              : "—"}
          </p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-zinc-500">
            Largest gap
          </p>
          <p className="mt-1 text-lg font-semibold">
            {metrics.largestGapMinutes !== null
              ? `${metrics.largestGapMinutes} min`
              : "—"}
          </p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-zinc-500">
            Smallest gap
          </p>
          <p className="mt-1 text-lg font-semibold">
            {metrics.smallestGapMinutes !== null
              ? `${metrics.smallestGapMinutes} min`
              : "—"}
          </p>
        </div>
      </div>

      <DirectionIntelligenceRow
        route={route}
        outbound={metrics.outbound}
        inbound={metrics.inbound}
      />

      {metrics.isDataStale ||
      metrics.disappearedPredictionCount > 0 ||
      metrics.missingFromRefreshCount > 0 ? (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          {metrics.isDataStale ? "Prediction data may be stale. " : null}
          {metrics.missingFromRefreshCount > 0
            ? `${metrics.missingFromRefreshCount} missing from latest refresh. `
            : null}
          {metrics.disappearedPredictionCount > 0
            ? `${metrics.disappearedPredictionCount} prediction${metrics.disappearedPredictionCount === 1 ? "" : "s"} disappeared after multiple refreshes.`
            : null}
        </p>
      ) : null}
    </div>
  );
}
