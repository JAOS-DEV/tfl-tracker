import type {
  HeadwayInfo,
  NormalizedVehiclePrediction,
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

export function calculateHeadway(
  predictions: NormalizedVehiclePrediction[],
): HeadwayInfo {
  if (predictions.length === 0) {
    return { nextMinutes: null, gapMinutes: null };
  }

  const sorted = sortByArrival(predictions);
  const nextMinutes = Math.max(0, Math.round(sorted[0].timeToStation / 60));

  if (sorted.length < 2) {
    return { nextMinutes, gapMinutes: null };
  }

  const first = new Date(sorted[0].expectedArrival).getTime();
  const second = new Date(sorted[1].expectedArrival).getTime();
  const gapMinutes = Math.max(0, Math.round((second - first) / 60000));

  return { nextMinutes, gapMinutes };
}

export function calculateRouteSummary(
  predictions: NormalizedVehiclePrediction[],
): RouteSummaryStats {
  if (predictions.length === 0) {
    return {
      liveVehicleCount: 0,
      averageGapMinutes: null,
      earliestArrival: null,
      latestArrival: null,
    };
  }

  const sorted = sortByArrival(predictions);
  const vehicleIds = new Set(
    sorted.map((prediction) => prediction.vehicleId ?? prediction.id),
  );

  const gaps: number[] = [];
  for (let index = 1; index < sorted.length; index += 1) {
    const previous = new Date(sorted[index - 1].expectedArrival).getTime();
    const current = new Date(sorted[index].expectedArrival).getTime();
    gaps.push(Math.max(0, Math.round((current - previous) / 60000)));
  }

  const averageGapMinutes =
    gaps.length > 0
      ? Math.round(gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length)
      : null;

  return {
    liveVehicleCount: vehicleIds.size,
    averageGapMinutes,
    earliestArrival: sorted[0]?.expectedArrival ?? null,
    latestArrival: sorted[sorted.length - 1]?.expectedArrival ?? null,
  };
}
