import { HEADWAY_THRESHOLDS } from "@/lib/constants";
import type {
  HeadwayInfo,
  NormalizedVehiclePrediction,
  RouteAlertBadge,
  RouteSummaryStats,
} from "@/lib/tfl/types";

function sortByArrival(
  predictions: NormalizedVehiclePrediction[],
): NormalizedVehiclePrediction[] {
  return [...predictions].sort((a, b) => {
    const timeDiff =
      new Date(a.expectedArrival).getTime() -
      new Date(b.expectedArrival).getTime();
    if (timeDiff !== 0) {
      return timeDiff;
    }
    return a.timeToStation - b.timeToStation;
  });
}

function calculateGapsMinutes(
  predictions: NormalizedVehiclePrediction[],
): number[] {
  const sorted = sortByArrival(predictions);
  const gaps: number[] = [];

  for (let index = 1; index < sorted.length; index += 1) {
    const previous = new Date(sorted[index - 1].expectedArrival).getTime();
    const current = new Date(sorted[index].expectedArrival).getTime();
    gaps.push(Math.max(0, Math.round((current - previous) / 60000)));
  }

  return gaps;
}

export function calculateHeadway(
  predictions: NormalizedVehiclePrediction[],
): HeadwayInfo {
  if (predictions.length === 0) {
    return { nextMinutes: null, gapMinutes: null };
  }

  const sorted = sortByArrival(predictions);
  const nextMinutes = Math.max(0, Math.round(sorted[0].timeToStation / 60));
  const gaps = calculateGapsMinutes(predictions);

  return {
    nextMinutes,
    gapMinutes: gaps[0] ?? null,
  };
}

function findBusiestStop(
  predictions: NormalizedVehiclePrediction[],
): { name: string | null; count: number } {
  const counts = new Map<string, { name: string; count: number }>();

  for (const prediction of predictions) {
    const existing = counts.get(prediction.naptanId);
    if (existing) {
      existing.count += 1;
    } else {
      counts.set(prediction.naptanId, {
        name: prediction.stopName,
        count: 1,
      });
    }
  }

  let busiest: { name: string | null; count: number } = {
    name: null,
    count: 0,
  };

  for (const entry of counts.values()) {
    if (entry.count > busiest.count) {
      busiest = { name: entry.name, count: entry.count };
    }
  }

  return busiest;
}

export function detectBunching(
  predictions: NormalizedVehiclePrediction[],
): boolean {
  const gaps = calculateGapsMinutes(predictions);
  return gaps.some(
    (gap) => gap > 0 && gap <= HEADWAY_THRESHOLDS.BUNCHING_MINUTES,
  );
}

export function detectLargeGap(
  predictions: NormalizedVehiclePrediction[],
): boolean {
  const gaps = calculateGapsMinutes(predictions);
  return gaps.some((gap) => gap >= HEADWAY_THRESHOLDS.LARGE_GAP_MINUTES);
}

export function calculateRouteSummary(
  predictions: NormalizedVehiclePrediction[],
): RouteSummaryStats {
  if (predictions.length === 0) {
    return {
      liveVehicleCount: 0,
      averageGapMinutes: null,
      largestGapMinutes: null,
      busiestStopName: null,
      busiestStopCount: 0,
      hasLargeGap: false,
      hasBunching: false,
    };
  }

  const sorted = sortByArrival(predictions);
  const vehicleIds = new Set(
    sorted.map((prediction) => prediction.vehicleId ?? prediction.id),
  );
  const gaps = calculateGapsMinutes(predictions);
  const busiest = findBusiestStop(predictions);

  const averageGapMinutes =
    gaps.length > 0
      ? Math.round(gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length)
      : null;

  const largestGapMinutes =
    gaps.length > 0 ? Math.max(...gaps) : null;

  return {
    liveVehicleCount: vehicleIds.size,
    averageGapMinutes,
    largestGapMinutes,
    busiestStopName: busiest.name,
    busiestStopCount: busiest.count,
    hasLargeGap: detectLargeGap(predictions),
    hasBunching: detectBunching(predictions),
  };
}

export function buildRouteAlertBadges(
  summary: RouteSummaryStats,
): RouteAlertBadge[] {
  const badges: RouteAlertBadge[] = [];

  if (summary.liveVehicleCount === 0) {
    badges.push({
      id: "no-buses",
      label: "No buses detected",
      tone: "neutral",
    });
    return badges;
  }

  if (summary.liveVehicleCount > 0) {
    badges.push({
      id: "live-count",
      label: `${summary.liveVehicleCount} bus${summary.liveVehicleCount === 1 ? "" : "es"} live`,
      tone: "info",
    });
  }

  if (summary.hasLargeGap) {
    badges.push({
      id: "large-gap",
      label: "Large predicted gap",
      tone: "warning",
    });
  }

  if (summary.hasBunching) {
    badges.push({
      id: "bunching",
      label: "Possible bunching",
      tone: "warning",
    });
  }

  return badges;
}
