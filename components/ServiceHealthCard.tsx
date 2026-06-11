import { DirectionIntelligenceRow } from "@/components/DirectionIntelligenceRow";
import { StatusPill } from "@/components/StatusPill";
import { buildServiceAlertBadges } from "@/lib/serviceIntelligence";
import { buildServiceHealthSummary } from "@/lib/serviceHealthSummary";
import type { NormalizedRoute, ServiceHealthMetrics } from "@/lib/tfl/types";

interface ServiceHealthCardProps {
  route: NormalizedRoute;
  metrics: ServiceHealthMetrics;
  compact?: boolean;
  variant?: "full" | "summary";
}

function healthScoreColor(score: number): string {
  if (score >= 85) {
    return "text-emerald-600 dark:text-emerald-400";
  }
  if (score >= 65) {
    return "text-sky-600 dark:text-sky-400";
  }
  if (score >= 40) {
    return "text-amber-600 dark:text-amber-400";
  }
  return "text-red-600 dark:text-red-400";
}

function mapBadgeTone(
  tone: "info" | "warning" | "neutral" | "success" | "danger",
): "info" | "warning" | "muted" | "good" | "danger" {
  if (tone === "success") {
    return "good";
  }
  if (tone === "neutral") {
    return "muted";
  }
  return tone;
}

export function ServiceHealthCard({
  route,
  metrics,
  compact = false,
  variant = "full",
}: ServiceHealthCardProps): React.ReactElement {
  const badges = buildServiceAlertBadges(metrics);
  const summary = buildServiceHealthSummary(metrics);

  if (variant === "summary") {
    return (
      <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              Service health
            </p>
            <p
              className={`text-xl font-bold ${healthScoreColor(metrics.healthScore)}`}
            >
              {metrics.healthScore}
              <span className="ml-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
                {metrics.healthLabel}
              </span>
            </p>
          </div>
          <p className="text-sm text-zinc-600 dark:text-zinc-300">
            {metrics.liveVehicleCount} live
          </p>
        </div>
        {summary.topWarning ? (
          <p className="mt-2 text-sm text-amber-800 dark:text-amber-200">
            {summary.topWarning}
          </p>
        ) : null}
        <div className="mt-2 flex flex-wrap gap-1.5">
          {badges.slice(0, 4).map((badge) => (
            <StatusPill
              key={badge.id}
              label={badge.label}
              variant={mapBadgeTone(badge.tone)}
              size="sm"
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div
      className={`space-y-3 text-sm ${
        compact
          ? "rounded-xl bg-zinc-50 p-3 dark:bg-zinc-900"
          : "rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Service health estimate
          </p>
          <p
            className={`mt-1 text-2xl font-bold ${healthScoreColor(metrics.healthScore)}`}
          >
            {metrics.healthScore}
            <span className="ml-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
              {metrics.healthLabel}
            </span>
          </p>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            Estimated from TfL live arrival data. Schedule position is estimated,
            not official.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {badges.map((badge) => (
          <StatusPill
            key={badge.id}
            label={badge.label}
            variant={mapBadgeTone(badge.tone)}
            size="sm"
          />
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
        <div>
          <p className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Est. on time
          </p>
          <p className="mt-1 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            {metrics.estimatedOnTimeCount}
          </p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Est. late
          </p>
          <p className="mt-1 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            {metrics.estimatedLateCount}
          </p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Est. early
          </p>
          <p className="mt-1 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            {metrics.estimatedEarlyCount}
          </p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Schedule uncertain
          </p>
          <p className="mt-1 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            {metrics.unknownScheduleMatchCount}
          </p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Possible ghosts
          </p>
          <p className="mt-1 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            {metrics.possibleGhostCount}
          </p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Live vehicles
          </p>
          <p className="mt-1 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            {metrics.liveVehicleCount}
          </p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Avg predicted gap
          </p>
          <p className="mt-1 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            {metrics.averageGapMinutes !== null
              ? `${metrics.averageGapMinutes} min`
              : "—"}
          </p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Largest gap
          </p>
          <p className="mt-1 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            {metrics.largestGapMinutes !== null
              ? `${metrics.largestGapMinutes} min`
              : "—"}
          </p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Smallest gap
          </p>
          <p className="mt-1 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
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
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:bg-amber-950/50 dark:text-amber-100">
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
