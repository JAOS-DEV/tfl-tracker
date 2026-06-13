import type { EstimatedVehiclePosition } from "@/lib/tfl/types";

export type GhostSource = "schedule" | "feed" | "disappeared";

export const POSSIBLE_GHOST_LABEL = "Possible ghost bus";
export const POSSIBLE_GHOST_SHORT_LABEL = "Possible ghost";

export const GHOST_MARKER_RING_CLASS =
  "fill-violet-400/15 stroke-violet-400 stroke-dashed dark:fill-violet-500/15 dark:stroke-violet-300";

export function isPossibleGhostBus(
  vehicle: EstimatedVehiclePosition,
): boolean {
  if (vehicle.isScheduledGhostCandidate) {
    return true;
  }
  if (vehicle.isSuspectedGhost) {
    return true;
  }
  if (
    !vehicle.matched &&
    vehicle.missedRefreshCount > 0 &&
    (vehicle.ghostStatus === "disappeared" ||
      vehicle.ghostStatus === "missingLatest" ||
      vehicle.ghostStatus === "suspectedGhost")
  ) {
    return true;
  }
  return false;
}

export function getGhostSource(
  vehicle: EstimatedVehiclePosition,
): GhostSource | null {
  if (vehicle.isScheduledGhostCandidate || vehicle.ghostSource === "schedule") {
    return "schedule";
  }
  if (vehicle.ghostStatus === "disappeared" || vehicle.ghostSource === "disappeared") {
    return "disappeared";
  }
  if (vehicle.isSuspectedGhost || vehicle.ghostSource === "feed") {
    return "feed";
  }
  if (isPossibleGhostBus(vehicle)) {
    return "feed";
  }
  return null;
}

export function possibleGhostCountLabel(count: number): string {
  if (count === 1) {
    return "1 possible ghost";
  }
  return `${count} possible ghosts`;
}

export function getGhostMarkerIconText(
  vehicle: EstimatedVehiclePosition,
): string {
  if (vehicle.isScheduledGhostCandidate) {
    return vehicle.scheduledGhostRunningNo ?? "?";
  }
  if (vehicle.scheduledGhostRunningNo) {
    return vehicle.scheduledGhostRunningNo;
  }
  return vehicle.routeNumber;
}

export function getPossibleGhostMarkerLabel(
  vehicle: EstimatedVehiclePosition,
): string {
  const runningNo = getGhostMarkerIconText(vehicle);
  const near = vehicle.matchedStopName ?? vehicle.nextStop?.name ?? "route";
  return `${POSSIBLE_GHOST_LABEL} ${vehicle.routeNumber}, running ${runningNo} near ${near}`;
}

export function formatGhostDestination(
  destinationName: string | null | undefined,
): string {
  if (!destinationName || destinationName === "Scheduled destination") {
    return "Destination unavailable";
  }
  return destinationName;
}

export interface PossibleGhostExplanation {
  title: string;
  summary: string;
  sourceLabel: string;
  ghostSource: GhostSource;
}

export function getPossibleGhostExplanation(
  vehicle: EstimatedVehiclePosition,
): PossibleGhostExplanation | null {
  const ghostSource = getGhostSource(vehicle);
  if (!ghostSource) {
    return null;
  }

  if (ghostSource === "schedule") {
    return {
      title: POSSIBLE_GHOST_LABEL,
      summary:
        "This scheduled journey should currently be active, but no matching live vehicle was found.",
      sourceLabel: "TfL iBus static schedule + live TfL data",
      ghostSource: "schedule",
    };
  }

  return {
    title: POSSIBLE_GHOST_LABEL,
    summary:
      "This bus was previously visible in the live feed, but it is no longer being returned by TfL.",
    sourceLabel: "live TfL feed tracking",
    ghostSource: ghostSource === "disappeared" ? "disappeared" : "feed",
  };
}

export function countPossibleGhostBuses(
  vehicles: EstimatedVehiclePosition[],
): number {
  return vehicles.filter(isPossibleGhostBus).length;
}

export function countPossibleGhostsBySource(
  vehicles: EstimatedVehiclePosition[],
): { schedule: number; feed: number; disappeared: number; total: number } {
  let schedule = 0;
  let feed = 0;
  let disappeared = 0;

  for (const vehicle of vehicles) {
    if (!isPossibleGhostBus(vehicle)) {
      continue;
    }
    const source = getGhostSource(vehicle);
    if (source === "schedule") {
      schedule += 1;
    } else if (source === "disappeared") {
      disappeared += 1;
    } else {
      feed += 1;
    }
  }

  return {
    schedule,
    feed,
    disappeared,
    total: schedule + feed + disappeared,
  };
}
