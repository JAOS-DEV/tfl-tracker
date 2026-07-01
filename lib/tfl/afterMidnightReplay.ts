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

const ROUTE_14_SAMPLES_BY_SCENARIO: Record<
  AfterMidnightReplayScenario,
  ReplaySample[]
> = {
  "0015": [
    {
      id: "replay-14-116-0015",
      naptanId: "490000179B",
      stationName: "Piccadilly Circus",
      destinationName: "Russell Square",
      direction: "inbound",
      timeToStation: 120,
      vehicleId: "YY66OZB",
      tripId: "373903",
      currentLocation: "Piccadilly Circus",
    },
    {
      id: "replay-14-117-0015",
      naptanId: "490007841KB",
      stationName: "Harrods",
      destinationName: "Russell Square",
      direction: "inbound",
      timeToStation: 76,
      vehicleId: "LJ62KGG",
      tripId: "373923",
      currentLocation: "Harrods",
    },
  ],
  "0045": [
    {
      id: "replay-14-157-0045",
      naptanId: "490000179S",
      stationName: "Piccadilly Circus",
      destinationName: "Putney Heath / Green Man",
      direction: "outbound",
      timeToStation: 60,
      vehicleId: "BV66VHK",
      tripId: "373814",
      currentLocation: "Piccadilly Circus",
    },
    {
      id: "replay-14-112-0045",
      naptanId: "490000212S1",
      stationName: "South Kensington Station",
      destinationName: "Putney Heath / Green Man",
      direction: "outbound",
      timeToStation: 120,
      vehicleId: "BV66ZSD",
      tripId: "373847",
      currentLocation: "South Kensington Station",
    },
  ],
  "0115": [
    {
      id: "replay-14-157-0115",
      naptanId: "490011278R",
      stationName: "St Mary's Church / Putney Pier",
      destinationName: "Putney Heath / Green Man",
      direction: "outbound",
      timeToStation: 60,
      vehicleId: "BV66VHK",
      tripId: "373814",
      currentLocation: "St Mary's Church / Putney Pier",
    },
  ],
  "0130": [
    {
      id: "replay-14-117-0130",
      naptanId: "490005069W",
      stationName: "Chelsea Football Club",
      destinationName: "Putney Heath / Green Man",
      direction: "outbound",
      timeToStation: 74,
      vehicleId: "LJ62KGG",
      tripId: "544821",
      currentLocation: "Chelsea Football Club",
    },
    {
      id: "replay-14-123-0130",
      naptanId: "490000119N",
      stationName: "Hyde Park Corner Station",
      destinationName: "Putney Heath / Green Man",
      direction: "outbound",
      timeToStation: 180,
      vehicleId: "BV66VLA",
      tripId: "544830",
      currentLocation: "Hyde Park Corner Station",
    },
  ],
  "0230": [
    {
      id: "replay-14-112-0230",
      naptanId: "490011815K",
      stationName: "Bedford Place",
      destinationName: "Putney Heath / Green Man",
      direction: "outbound",
      timeToStation: 127,
      vehicleId: "BV66ZSD",
      tripId: "544808",
      currentLocation: "Bedford Place",
    },
    {
      id: "replay-14-129-0230",
      naptanId: "490010861V",
      stationName: "Parsons Green Lane / Fulham Library",
      destinationName: "Putney Heath / Green Man",
      direction: "outbound",
      timeToStation: 110,
      vehicleId: "YY66OZA",
      tripId: "544853",
      currentLocation: "Parsons Green Lane / Fulham Library",
    },
    {
      id: "replay-14-131-0230",
      naptanId: "490000119N",
      stationName: "Hyde Park Corner Station",
      destinationName: "Putney Heath / Green Man",
      direction: "outbound",
      timeToStation: 120,
      vehicleId: "BV66VJZ",
      tripId: "544862",
      currentLocation: "Hyde Park Corner Station",
    },
  ],
};

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
      baseVersion: "20250619",
      modeName: "bus",
      timestamp: simulatedNow,
    })),
  };
}
