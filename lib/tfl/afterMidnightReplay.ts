import type {
  IbusRouteSchedule,
  IbusScheduledJourney,
  IbusScheduledStop,
} from "@/lib/ibus/scheduleTypes";
import type { TflPrediction } from "@/lib/tfl/types";

export const AFTER_MIDNIGHT_REPLAY_SCENARIOS = [
  "0015",
  "0045",
  "0115",
  "0130",
  "0230",
] as const;
export type AfterMidnightReplayScenario =
  (typeof AFTER_MIDNIGHT_REPLAY_SCENARIOS)[number];

const SIMULATED_NOW_BY_SCENARIO: Record<AfterMidnightReplayScenario, string> = {
  "0015": "2026-06-30T23:15:00.000Z",
  "0045": "2026-06-30T23:45:00.000Z",
  "0115": "2026-07-01T00:15:00.000Z",
  "0130": "2026-07-01T00:30:00.000Z",
  "0230": "2026-07-01T01:30:00.000Z",
};

/** Service-day midnight in London for the fixed replay calendar night. */
const REPLAY_SERVICE_DAY_START_UTC = "2026-06-29T23:00:00.000Z";

/** Tuesday on the replay service day (0 = Sunday). */
const REPLAY_SERVICE_DAY_OF_WEEK = 2;

const MATCH_WINDOW_MINUTES = 5;
const REPLAY_ROUTE_ID = "14";

export interface AfterMidnightReplay {
  scenario: AfterMidnightReplayScenario;
  simulatedNow: string;
  provenance: "synthetic-known-sample";
  rawPredictions: TflPrediction[];
}

/**
 * Preferred stop anchors for the overnight story. Trip IDs are resolved from
 * the current imported schedule so base-version updates do not require re-pinning.
 */
interface ReplaySlotTemplate {
  naptanId: string;
  direction: "inbound" | "outbound";
  vehicleId: string;
}

const ROUTE_14_SLOT_TEMPLATES: Record<
  AfterMidnightReplayScenario,
  ReplaySlotTemplate[]
> = {
  "0015": [
    {
      naptanId: "490011285E2",
      direction: "inbound",
      vehicleId: "YY66OZB",
    },
    {
      naptanId: "490005069E",
      direction: "inbound",
      vehicleId: "LJ62KGG",
    },
  ],
  "0045": [
    {
      naptanId: "490011285S1",
      direction: "outbound",
      vehicleId: "YY66OZB",
    },
    {
      naptanId: "490000200E",
      direction: "outbound",
      vehicleId: "LJ62KGG",
    },
  ],
  "0115": [
    {
      naptanId: "490015157T",
      direction: "outbound",
      vehicleId: "YY66OZB",
    },
  ],
  "0130": [
    {
      naptanId: "490011285S1",
      direction: "outbound",
      vehicleId: "YY66OZB",
    },
    {
      naptanId: "490000200E",
      direction: "outbound",
      vehicleId: "LJ62KGG",
    },
  ],
  "0230": [
    {
      naptanId: "490000200E",
      direction: "outbound",
      vehicleId: "YY66OZB",
    },
    {
      naptanId: "490000084M",
      direction: "outbound",
      vehicleId: "LJ62KGG",
    },
    {
      naptanId: "490011285E2",
      direction: "inbound",
      vehicleId: "BV66VHK",
    },
  ],
};

interface ResolvedReplayStop {
  journey: IbusScheduledJourney;
  stop: IbusScheduledStop;
  direction: "inbound" | "outbound";
  deltaMinutes: number;
}

export function resolveAfterMidnightReplayScenario(
  value: string | null,
  nodeEnv: string | undefined,
  enabled = nodeEnv !== "production",
): AfterMidnightReplayScenario | null {
  if (!enabled) {
    return null;
  }
  return AFTER_MIDNIGHT_REPLAY_SCENARIOS.find((entry) => entry === value) ?? null;
}

export function buildAfterMidnightReplayUrl(
  currentUrl: string,
  scenario: AfterMidnightReplayScenario | null,
): string {
  const url = new URL(currentUrl);
  if (scenario) {
    url.searchParams.set("replay", scenario);
  } else {
    url.searchParams.delete("replay");
  }
  return url.toString();
}

export function mapRoute14ReplayDirection(
  journey: IbusScheduledJourney,
): "inbound" | "outbound" {
  const destination = (journey.destination ?? "").toLowerCase();
  if (destination.includes("russell")) {
    return "inbound";
  }
  if (destination.includes("putney")) {
    return "outbound";
  }
  // Route 14 compact schedules: "1" toward Russell Square, "2" toward Putney Heath.
  return journey.direction === "1" ? "inbound" : "outbound";
}

function stripTowardsPrefix(destination: string | null, fallback: string): string {
  if (!destination) {
    return fallback;
  }
  return destination.replace(/^towards\s+/i, "").trim() || fallback;
}

function scoreMatch(candidate: ResolvedReplayStop): number {
  const dayBonus = candidate.journey.serviceDays.includes(REPLAY_SERVICE_DAY_OF_WEEK)
    ? 0
    : 100;
  return Math.abs(candidate.deltaMinutes) + dayBonus;
}

function collectMatchesNearClock(
  schedule: IbusRouteSchedule,
  simulatedNowMs: number,
  serviceDayStartMs: number,
): ResolvedReplayStop[] {
  const matches: ResolvedReplayStop[] = [];

  for (const journey of schedule.journeys) {
    const direction = mapRoute14ReplayDirection(journey);
    for (const stop of journey.stops) {
      if (!stop.naptanId) {
        continue;
      }
      const scheduledArrivalMs =
        serviceDayStartMs + stop.scheduledSeconds * 1_000;
      const deltaMinutes = (scheduledArrivalMs - simulatedNowMs) / 60_000;
      if (Math.abs(deltaMinutes) > MATCH_WINDOW_MINUTES) {
        continue;
      }
      matches.push({ journey, stop, direction, deltaMinutes });
    }
  }

  return matches.sort((left, right) => scoreMatch(left) - scoreMatch(right));
}

function resolveSlot(
  matches: ResolvedReplayStop[],
  template: ReplaySlotTemplate,
  usedTripIds: Set<string>,
): ResolvedReplayStop | null {
  const exact = matches.find(
    (candidate) =>
      !usedTripIds.has(candidate.journey.tripId) &&
      candidate.stop.naptanId === template.naptanId &&
      candidate.direction === template.direction,
  );
  if (exact) {
    return exact;
  }

  return (
    matches.find(
      (candidate) =>
        !usedTripIds.has(candidate.journey.tripId) &&
        candidate.direction === template.direction,
    ) ?? null
  );
}

export function buildAfterMidnightReplayFromSchedule(
  routeId: string,
  scenario: AfterMidnightReplayScenario,
  schedule: IbusRouteSchedule | null,
): AfterMidnightReplay {
  const simulatedNow = SIMULATED_NOW_BY_SCENARIO[scenario];
  const simulatedNowMs = Date.parse(simulatedNow);
  const serviceDayStartMs = Date.parse(REPLAY_SERVICE_DAY_START_UTC);

  if (
    routeId.toLowerCase() !== REPLAY_ROUTE_ID ||
    !schedule ||
    schedule.journeys.length === 0
  ) {
    return {
      scenario,
      simulatedNow,
      provenance: "synthetic-known-sample",
      rawPredictions: [],
    };
  }

  const matches = collectMatchesNearClock(
    schedule,
    simulatedNowMs,
    serviceDayStartMs,
  );
  const templates = ROUTE_14_SLOT_TEMPLATES[scenario];
  const usedTripIds = new Set<string>();
  const rawPredictions: TflPrediction[] = [];

  for (const [index, template] of templates.entries()) {
    const resolved = resolveSlot(matches, template, usedTripIds);
    if (!resolved || !resolved.stop.naptanId) {
      continue;
    }

    usedTripIds.add(resolved.journey.tripId);
    const timeToStation = Math.max(0, Math.round(resolved.deltaMinutes * 60));
    const destinationName = stripTowardsPrefix(
      resolved.journey.destination,
      template.direction === "inbound" ? "Russell Square" : "Putney Heath / Green Man",
    );

    rawPredictions.push({
      id: `replay-14-${resolved.journey.tripId}-${scenario}-${index}`,
      lineId: routeId,
      lineName: routeId,
      naptanId: resolved.stop.naptanId,
      stationName: resolved.stop.stopName,
      destinationName,
      direction: resolved.direction,
      timeToStation,
      expectedArrival: new Date(
        simulatedNowMs + timeToStation * 1_000,
      ).toISOString(),
      vehicleId: template.vehicleId,
      tripId: resolved.journey.tripId,
      baseVersion: schedule.baseVersion,
      currentLocation: resolved.stop.stopName,
      modeName: "bus",
      timestamp: simulatedNow,
    });
  }

  return {
    scenario,
    simulatedNow,
    provenance: "synthetic-known-sample",
    rawPredictions,
  };
}
