import type { RouteDashboardSummary } from "@/lib/tfl/types";

export interface ActiveRouteComparisonEntry {
  routeId: string;
  healthScore: number;
  healthLabel: string;
  liveVehicleCount: number;
  largestGapMinutes: number | null;
  estimatedLateCount: number;
  possibleGhostCount: number;
  topWarning: string | null;
  comparisonScore: number;
}

export interface ActiveRouteComparisonResult {
  entries: ActiveRouteComparisonEntry[];
  bestRouteId: string | null;
  bestReason: string | null;
  largestGapRouteId: string | null;
}

function topWarningForSummary(summary: RouteDashboardSummary): string | null {
  if (summary.possibleGhostCount > 0) {
    return `${summary.possibleGhostCount} possible ghost${
      summary.possibleGhostCount === 1 ? "" : "s"
    }`;
  }
  if (summary.estimatedLateCount > 0) {
    return `${summary.estimatedLateCount} late`;
  }
  if (summary.isDataStale) {
    return "Stale data";
  }
  return null;
}

function comparisonScore(summary: RouteDashboardSummary): number {
  const gapPenalty =
    summary.largestGapMinutes !== null ? summary.largestGapMinutes * 2 : 0;

  return (
    summary.healthScore +
    summary.liveVehicleCount * 4 -
    gapPenalty -
    summary.estimatedLateCount * 6 -
    summary.possibleGhostCount * 8 -
    (summary.isDataStale ? 12 : 0)
  );
}

function buildBestReason(
  best: ActiveRouteComparisonEntry,
  others: ActiveRouteComparisonEntry[],
): string | null {
  if (others.length === 0) {
    return null;
  }

  const reasons: string[] = [];

  const bestHealth = Math.max(...others.map((entry) => entry.healthScore));
  if (best.healthScore >= bestHealth) {
    reasons.push("better health score");
  }

  const bestLive = Math.max(...others.map((entry) => entry.liveVehicleCount));
  if (best.liveVehicleCount >= bestLive && best.liveVehicleCount > 0) {
    reasons.push("more live buses");
  }

  const smallestGap = Math.min(
    ...[best, ...others]
      .map((entry) => entry.largestGapMinutes)
      .filter((value): value is number => value !== null),
  );
  if (
    best.largestGapMinutes !== null &&
    best.largestGapMinutes <= smallestGap
  ) {
    reasons.push("smaller largest gap");
  }

  if (reasons.length === 0) {
    return "best balance of live service and gaps right now";
  }

  return reasons.slice(0, 2).join(", ");
}

export function buildActiveRouteComparison(
  summaries: RouteDashboardSummary[],
): ActiveRouteComparisonResult | null {
  if (summaries.length < 2) {
    return null;
  }

  const entries = summaries
    .map((summary) => ({
      routeId: summary.routeId,
      healthScore: summary.healthScore,
      healthLabel: summary.healthLabel,
      liveVehicleCount: summary.liveVehicleCount,
      largestGapMinutes: summary.largestGapMinutes,
      estimatedLateCount: summary.estimatedLateCount,
      possibleGhostCount: summary.possibleGhostCount,
      topWarning: topWarningForSummary(summary),
      comparisonScore: comparisonScore(summary),
    }))
    .sort((left, right) => right.comparisonScore - left.comparisonScore);

  const best = entries[0];
  const largestGapRoute = [...entries].sort((left, right) => {
    const leftGap = left.largestGapMinutes ?? -1;
    const rightGap = right.largestGapMinutes ?? -1;
    return rightGap - leftGap;
  })[0];

  return {
    entries,
    bestRouteId: best?.routeId ?? null,
    bestReason: best ? buildBestReason(best, entries.slice(1)) : null,
    largestGapRouteId:
      largestGapRoute && largestGapRoute.largestGapMinutes !== null
        ? largestGapRoute.routeId
        : null,
  };
}
