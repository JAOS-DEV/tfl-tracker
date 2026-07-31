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

export interface AfterMidnightReplay {
  scenario: AfterMidnightReplayScenario;
  simulatedNow: string;
  provenance: "synthetic-known-sample";
  rawPredictions: TflPrediction[];
}

interface ReplaySample {
  id: string;
  naptanId: string;
  stationName: string;
  destinationName: string;
  direction: string;
  timeToStation: number;
  vehicleId: string;
  tripId: string;
  currentLocation: string;
}

/** Known Route 14 overnight samples pinned to the imported active base version. */
const ROUTE_14_SAMPLES_BY_SCENARIO: Record<
  AfterMidnightReplayScenario,
  ReplaySample[]
> = {
  "0015": [
    {
      id: "replay-14-123-0015",
      naptanId: "490011285E2",
      stationName: "Putney Heath / Green Man",
      destinationName: "Russell Square",
      direction: "inbound",
      timeToStation: 0,
      vehicleId: "YY66OZB",
      tripId: "581999",
      currentLocation: "Putney Heath / Green Man",
    },
    {
      id: "replay-14-153-0015",
      naptanId: "490005069E",
      stationName: "Chelsea Football Club",
      destinationName: "Russell Square",
      direction: "inbound",
      timeToStation: 9,
      vehicleId: "LJ62KGG",
      tripId: "509785",
      currentLocation: "Chelsea Football Club",
    },
  ],
  "0045": [
    {
      id: "replay-14-129-0045",
      naptanId: "490011285S1",
      stationName: "Putney Heath / Green Man",
      destinationName: "Putney Heath / Green Man",
      direction: "outbound",
      timeToStation: 0,
      vehicleId: "YY66OZB",
      tripId: "510138",
      currentLocation: "Putney Heath / Green Man",
    },
    {
      id: "replay-14-116-0045",
      naptanId: "490000200E",
      stationName: "Russell Square",
      destinationName: "Putney Heath / Green Man",
      direction: "outbound",
      timeToStation: 0,
      vehicleId: "LJ62KGG",
      tripId: "581983",
      currentLocation: "Russell Square",
    },
  ],
  "0115": [
    {
      id: "replay-14-157-0115",
      naptanId: "490015157T",
      stationName: "Putney Bridge Stn  / Gonville Street",
      destinationName: "Putney Heath / Green Man",
      direction: "outbound",
      timeToStation: 0,
      vehicleId: "YY66OZB",
      tripId: "509846",
      currentLocation: "Putney Bridge Stn  / Gonville Street",
    },
  ],
  "0130": [
    {
      id: "replay-14-116-0130",
      naptanId: "490011285S1",
      stationName: "Putney Heath / Green Man",
      destinationName: "Putney Heath / Green Man",
      direction: "outbound",
      timeToStation: 0,
      vehicleId: "YY66OZB",
      tripId: "581983",
      currentLocation: "Putney Heath / Green Man",
    },
    {
      id: "replay-14-125-0130",
      naptanId: "490000200E",
      stationName: "Russell Square",
      destinationName: "Putney Heath / Green Man",
      direction: "outbound",
      timeToStation: 0,
      vehicleId: "LJ62KGG",
      tripId: "582009",
      currentLocation: "Russell Square",
    },
  ],
  "0230": [
    {
      id: "replay-14-112-0230",
      naptanId: "490000200E",
      stationName: "Russell Square",
      destinationName: "Putney Heath / Green Man",
      direction: "outbound",
      timeToStation: 0,
      vehicleId: "YY66OZB",
      tripId: "581978",
      currentLocation: "Russell Square",
    },
    {
      id: "replay-14-129-0230",
      naptanId: "490000084M",
      stationName: "Fulham Broadway Station",
      destinationName: "Putney Heath / Green Man",
      direction: "outbound",
      timeToStation: 0,
      vehicleId: "LJ62KGG",
      tripId: "582023",
      currentLocation: "Fulham Broadway Station",
    },
    {
      id: "replay-14-125-0230",
      naptanId: "490011285E2",
      stationName: "Putney Heath / Green Man",
      destinationName: "Russell Square",
      direction: "inbound",
      timeToStation: 0,
      vehicleId: "BV66VHK",
      tripId: "582011",
      currentLocation: "Putney Heath / Green Man",
    },
  ],
};

const AFTER_MIDNIGHT_REPLAY_BASE_VERSION = "20260731";

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

export function buildAfterMidnightReplay(
  routeId: string,
  scenario: AfterMidnightReplayScenario,
): AfterMidnightReplay {
  const simulatedNow = SIMULATED_NOW_BY_SCENARIO[scenario];
  const timestampMs = Date.parse(simulatedNow);
  const samples = routeId.toLowerCase() === "14"
    ? ROUTE_14_SAMPLES_BY_SCENARIO[scenario]
    : [];

  return {
    scenario,
    simulatedNow,
    provenance: "synthetic-known-sample",
    rawPredictions: samples.map((sample) => ({
      ...sample,
      lineId: routeId,
      lineName: routeId,
      expectedArrival: new Date(
        timestampMs + sample.timeToStation * 1_000,
      ).toISOString(),
      baseVersion: AFTER_MIDNIGHT_REPLAY_BASE_VERSION,
      modeName: "bus",
      timestamp: simulatedNow,
    })),
  };
}
