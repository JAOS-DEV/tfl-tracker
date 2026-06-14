import { describe, expect, it } from "vitest";
import { buildVehicleRegistrationDiagnostics } from "@/lib/vehicleRegistrationDiagnostics";
import type { EstimatedVehiclePosition } from "@/lib/tfl/types";

function buildVehicle(
  overrides: Partial<EstimatedVehiclePosition> = {},
): EstimatedVehiclePosition {
  return {
    vehicleId: "DEL92",
    routeNumber: "22",
    direction: "outbound",
    destinationName: "Putney Bridge",
    expectedArrival: "2026-06-12T09:05:00.000Z",
    timeToStation: 120,
    nextPrediction: {
      id: "pred-1",
      routeId: "22",
      routeNumber: "22",
      naptanId: "490000001A",
      stopName: "Stop A",
      destinationName: "Putney Bridge",
      direction: "outbound",
      timeToStation: 120,
      expectedArrival: "2026-06-12T09:05:00.000Z",
      vehicleId: "DEL92",
      vehicleFleetReference: "DEL92",
    },
    nextStop: null,
    stopIndex: 0,
    progress: 0.2,
    x: 10,
    y: 20,
    matched: true,
    adherence: "unknown",
    scheduleDeviationMinutes: null,
    scheduleStatus: "unknown",
    scheduleStatusLabel: "Schedule ?",
    scheduleMatchConfidence: "unknown",
    matchedScheduledTime: null,
    matchedStopName: null,
    scheduleDataAvailable: false,
    scheduleExplanation: "Timetable unavailable",
    ghostStatus: "normal",
    missedRefreshCount: 0,
    isSuspectedGhost: false,
    vehicleFleetReference: "DEL92",
    ...overrides,
  };
}

describe("buildVehicleRegistrationDiagnostics", () => {
  it("shows live TfL registration with not-found iBus lookup and no missing reason", () => {
    const diagnostics = buildVehicleRegistrationDiagnostics({
      routeId: "22",
      vehicles: [
        buildVehicle({
          vehicleId: "LX75ZGV",
          vehicleRegistration: "LX75ZGV",
          vehicleRegistrationSource: "live-tfl-prediction",
          nextPrediction: {
            id: "pred-2",
            routeId: "22",
            routeNumber: "22",
            naptanId: "490000001A",
            stopName: "Stop A",
            destinationName: "Putney Bridge",
            direction: "outbound",
            timeToStation: 120,
            expectedArrival: "2026-06-12T09:05:00.000Z",
            vehicleId: "LX75ZGV",
            vehicleRegistration: "LX75ZGV",
          },
        }),
      ],
      showRegistrationEnabled: true,
      enrichmentLoaded: true,
      liveDetails: new Map([
        [
          "LX75ZGV",
          {
            runningNo: "61",
            registration: "LX75ZGV",
            registrationSource: "live-tfl-prediction",
            registrationLookupStatus: "not-found",
          },
        ],
      ]),
    });

    expect(diagnostics[0]?.normalizedRegistration).toBe("LX75ZGV");
    expect(diagnostics[0]?.registrationSource).toBe("live-tfl-prediction");
    expect(diagnostics[0]?.ibusLookupStatus).toBe("not-found");
    expect(diagnostics[0]?.missingReason).toBeUndefined();
    expect(diagnostics[0]?.lookupNote).toContain(
      "Static iBus vehicle lookup did not match",
    );
  });

  it("records reverse lookup registration source when enrichment succeeds", () => {
    const diagnostics = buildVehicleRegistrationDiagnostics({
      routeId: "22",
      vehicles: [
        buildVehicle({
          vehicleRegistration: "LX75ZGV",
          vehicleRegistrationSource: "ibus-fleet-reverse-lookup",
        }),
      ],
      showRegistrationEnabled: true,
      enrichmentLoaded: true,
      liveDetails: new Map([
        [
          "DEL92",
          {
            runningNo: "61",
            fleetNo: "DEL92",
            registration: "LX75ZGV",
            registrationSource: "ibus-fleet-reverse-lookup",
            registrationLookupStatus: "matched",
          },
        ],
      ]),
    });

    expect(diagnostics[0]?.registrationSource).toBe(
      "ibus-fleet-reverse-lookup",
    );
    expect(diagnostics[0]?.missingReason).toBeUndefined();
  });

  it("explains unavailable fleet-only ids with no reverse lookup", () => {
    const diagnostics = buildVehicleRegistrationDiagnostics({
      routeId: "22",
      vehicles: [buildVehicle()],
      showRegistrationEnabled: true,
      enrichmentLoaded: true,
      liveDetails: new Map([
        [
          "DEL92",
          {
            runningNo: "61",
            fleetNo: "DEL92",
            registrationLookupStatus: "not-found",
          },
        ],
      ]),
    });

    expect(diagnostics[0]?.registrationSource).toBe("unavailable");
    expect(diagnostics[0]?.missingReason).toBe(
      "vehicleId did not look like a registration and no static reverse lookup matched",
    );
  });

  it("flags display setting disabled as missing reason", () => {
    const diagnostics = buildVehicleRegistrationDiagnostics({
      routeId: "337",
      vehicles: [buildVehicle({ vehicleRegistration: undefined })],
      showRegistrationEnabled: false,
      enrichmentLoaded: true,
    });

    expect(diagnostics[0]?.missingReason).toBe("display setting disabled");
  });
});
