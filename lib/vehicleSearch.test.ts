import { describe, expect, it } from "vitest";
import type { EstimatedVehiclePosition } from "@/lib/tfl/types";
import {
  buildRunningNumberEmptyMessage,
  buildVehicleSearchEmptyState,
  createVehicleSearchFocus,
  detectVehicleSearchQueryKinds,
  groupVehicleSearchResults,
  isVehicleOnlyDiscoveryQuery,
  searchActiveVehicleCandidates,
  shouldSearchActiveVehicles,
  VEHICLE_SEARCH_HELP_TEXT,
  VEHICLE_SEARCH_PLACEHOLDER,
  type VehicleSearchCandidate,
} from "@/lib/vehicleSearch";

function buildVehicle(
  overrides: Partial<EstimatedVehiclePosition> = {},
): EstimatedVehiclePosition {
  return {
    vehicleId: "LV24EUK",
    vehicleRegistration: "LV24EUK",
    routeNumber: "337",
    direction: "outbound",
    destinationName: "Clapham Junction",
    expectedArrival: "2026-06-14T12:00:00Z",
    timeToStation: 120,
    nextPrediction: {
      id: "pred-1",
      routeId: "337",
      routeNumber: "337",
      naptanId: "490012345A",
      stopName: "Putney Leisure Centre",
      direction: "outbound",
      destinationName: "Clapham Junction",
      expectedArrival: "2026-06-14T12:00:00Z",
      timeToStation: 120,
      vehicleId: "LV24EUK",
    },
    nextStop: {
      id: "490012345A",
      naptanId: "490012345A",
      name: "Putney Leisure Centre",
      stopLetter: "A",
      towards: "Clapham Junction",
      isTimingPoint: false,
    },
    stopIndex: 3,
    progress: 0.4,
    x: 0,
    y: 0,
    matched: true,
    adherence: "on-time",
    scheduleDeviationMinutes: 22,
    scheduleStatus: "late",
    scheduleStatusLabel: "Late +22",
    scheduleMatchConfidence: "high",
    matchedScheduledTime: null,
    matchedStopName: null,
    scheduleDataAvailable: true,
    ghostStatus: "live",
    missedRefreshCount: 0,
    isSuspectedGhost: false,
    ibusRunningNo: "562",
    ibusFleetNo: "3049",
    ibusBlockNo: "337012",
    baseVersion: "20250619",
    ...overrides,
  } as EstimatedVehiclePosition;
}

function candidate(
  routeId: string,
  vehicle: EstimatedVehiclePosition,
): VehicleSearchCandidate {
  return { routeId, vehicle };
}

describe("vehicleSearch query detection", () => {
  it("recognises route, registration, fleet, and running-style queries", () => {
    expect(detectVehicleSearchQueryKinds("337")).toContain("route");
    expect(detectVehicleSearchQueryKinds("LV24EUK")).toContain("registration");
    expect(detectVehicleSearchQueryKinds("BV66VJZ")).toContain("registration");
    expect(detectVehicleSearchQueryKinds("3051")).toEqual(
      expect.arrayContaining(["route", "running", "fleet"]),
    );
    expect(detectVehicleSearchQueryKinds("WHV119")).toContain("fleet");
    expect(detectVehicleSearchQueryKinds("562")).toEqual(
      expect.arrayContaining(["route", "running", "fleet"]),
    );
  });

  it("treats registration and fleet queries as vehicle-only discovery", () => {
    expect(isVehicleOnlyDiscoveryQuery("LV24EUK")).toBe(true);
    expect(isVehicleOnlyDiscoveryQuery("WHV119")).toBe(true);
    expect(isVehicleOnlyDiscoveryQuery("337")).toBe(false);
    expect(shouldSearchActiveVehicles("562")).toBe(true);
  });
});

describe("vehicleSearch matching", () => {
  const activeCandidates = [
    candidate("337", buildVehicle()),
    candidate(
      "14",
      buildVehicle({
        vehicleId: "BV66VJZ",
        vehicleRegistration: "BV66VJZ",
        routeNumber: "14",
        destinationName: "Putney Heath",
        ibusRunningNo: "562",
        ibusFleetNo: "3051",
      }),
    ),
    candidate(
      "22",
      buildVehicle({
        vehicleId: "WHV119",
        vehicleRegistration: undefined,
        vehicleFleetReference: "WHV119",
        routeNumber: "22",
        ibusRunningNo: "138",
        ibusFleetNo: "WHV119",
      }),
    ),
  ];

  it("returns an exact registration match", () => {
    const results = searchActiveVehicleCandidates(activeCandidates, "LV24EUK");
    expect(results).toHaveLength(1);
    expect(results[0]?.kind).toBe("registration");
    expect(results[0]?.registration).toBe("LV24EUK");
  });

  it("returns a fleet match", () => {
    const results = searchActiveVehicleCandidates(activeCandidates, "3051");
    expect(results.some((result) => result.routeId === "14")).toBe(true);
    expect(results.some((result) => result.kind === "fleet")).toBe(true);
  });

  it("returns all running-number candidates", () => {
    const results = searchActiveVehicleCandidates(activeCandidates, "562");
    expect(results).toHaveLength(2);
    expect(results.map((result) => result.routeId).sort()).toEqual(["14", "337"]);
  });

  it("includes schedule ghost buses in running-number search", () => {
    const ghostCandidates = [
      candidate(
        "22",
        buildVehicle({
          vehicleId: "scheduled-ghost-22-61",
          isScheduledGhostCandidate: true,
          isSuspectedGhost: true,
          ghostStatus: "suspectedGhost",
          ghostSource: "schedule",
          ibusRunningNo: undefined,
          scheduledGhostRunningNo: "61",
          vehicleRegistration: undefined,
          destinationName: "Putney Common",
        }),
      ),
      candidate(
        "22",
        buildVehicle({
          vehicleId: "scheduled-ghost-22-64",
          isScheduledGhostCandidate: true,
          isSuspectedGhost: true,
          ghostStatus: "suspectedGhost",
          ghostSource: "schedule",
          ibusRunningNo: undefined,
          scheduledGhostRunningNo: "64",
          vehicleRegistration: undefined,
          destinationName: "Margaret Street",
        }),
      ),
    ];

    const results = searchActiveVehicleCandidates(ghostCandidates, "61");
    expect(results).toHaveLength(1);
    expect(results[0]?.runningNumber).toBe("61");
    expect(results[0]?.routeId).toBe("22");
    expect(results[0]?.kind).toBe("running");
  });

  it("does not include schedule ghosts in registration search", () => {
    const ghostCandidates = [
      candidate(
        "22",
        buildVehicle({
          vehicleId: "scheduled-ghost-22-61",
          isScheduledGhostCandidate: true,
          isSuspectedGhost: true,
          ghostStatus: "suspectedGhost",
          scheduledGhostRunningNo: "61",
          vehicleRegistration: undefined,
        }),
      ),
    ];

    expect(searchActiveVehicleCandidates(ghostCandidates, "LV24EUK")).toEqual([]);
  });

  it("returns a useful empty state message for missing running numbers", () => {
    expect(buildRunningNumberEmptyMessage("562")).toBe(
      "No live bus with run 562 found on active routes.",
    );
    expect(searchActiveVehicleCandidates(activeCandidates, "999")).toEqual([]);
  });

  it("does not scan when the query is location-only", () => {
    expect(searchActiveVehicleCandidates(activeCandidates, "Richmond")).toEqual(
      [],
    );
  });
});

describe("vehicleSearch empty states", () => {
  it("exposes clear placeholder and help copy", () => {
    expect(VEHICLE_SEARCH_PLACEHOLDER).toMatch(/active routes/i);
    expect(VEHICLE_SEARCH_HELP_TEXT).toMatch(/active routes only/i);
  });

  it("shows a helpful message when no active routes are open", () => {
    const message = buildVehicleSearchEmptyState("562", 0);
    expect(message.title).toMatch(/Open a route first/i);
    expect(message.hint).toMatch(/Search a route first/i);
  });

  it("shows a helpful message for registration queries with no match", () => {
    const message = buildVehicleSearchEmptyState("LV24EUK", 0);
    expect(message.title).toMatch(/Open a route first/i);
  });

  it("shows a helpful message for registration queries on active routes", () => {
    const message = buildVehicleSearchEmptyState("LV24EUK", 1);
    expect(message.title).toBe("No active-route match for LV24EUK.");
    expect(message.detail).toMatch(/routes you have opened/i);
  });

  it("shows a helpful message for fleet queries with no match", () => {
    const message = buildVehicleSearchEmptyState("WHV119", 1);
    expect(message.title).toBe("No active-route match for fleet WHV119.");
    expect(message.detail).toMatch(/Open the route first/i);
  });

  it("shows a helpful message for running-number queries with no match", () => {
    const message = buildVehicleSearchEmptyState("562", 1);
    expect(message.title).toBe(
      "No live bus with run 562 found on active routes.",
    );
    expect(message.detail).toMatch(/Add the route first/i);
  });
});

describe("vehicleSearch grouping and focus", () => {
  it("groups running-number matches separately from other live vehicles", () => {
    const grouped = groupVehicleSearchResults([
      {
        kind: "registration",
        routeId: "337",
        matchScore: 100,
        registration: "LV24EUK",
      },
      {
        kind: "running",
        routeId: "14",
        matchScore: 88,
        runningNumber: "562",
      },
    ]);

    expect(grouped.liveVehicles).toHaveLength(1);
    expect(grouped.runningNumbers).toHaveLength(1);
  });

  it("builds a focus payload for opening a route card", () => {
    const focus = createVehicleSearchFocus(
      {
        kind: "registration",
        routeId: "337",
        vehicleId: "LV24EUK",
        registration: "LV24EUK",
        runningNumber: "562",
        direction: "outbound",
        matchScore: 100,
      },
      "req-1",
    );

    expect(focus.routeId).toBe("337");
    expect(focus.vehicleId).toBe("LV24EUK");
    expect(focus.note).toContain("LV24EUK");
  });
});
