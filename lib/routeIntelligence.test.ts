import { describe, expect, it } from "vitest";
import {
  buildRouteIntelligence,
  toRouteDashboardSummary,
} from "@/lib/routeIntelligence";
import { buildServiceHealthMetrics } from "@/lib/serviceIntelligence";
import { LOOP_LAYOUT } from "@/lib/constants";
import type {
  NormalizedRoute,
  NormalizedVehiclePrediction,
  PredictionTrackingState,
  ServiceHealthMetrics,
} from "@/lib/tfl/types";

const sampleRoute: NormalizedRoute = {
  routeId: "337",
  routeName: "337",
  outbound: [
    {
      id: "1",
      name: "Stop A",
      naptanId: "490000001A",
      isTimingPoint: false,
    },
    {
      id: "2",
      name: "Stop B",
      naptanId: "490000002B",
      isTimingPoint: false,
    },
  ],
  inbound: [
    {
      id: "3",
      name: "Stop C",
      naptanId: "490000003C",
      isTimingPoint: false,
    },
  ],
};

const basePrediction: NormalizedVehiclePrediction = {
  id: "pred-1",
  routeId: "337",
  routeNumber: "337",
  naptanId: "490000001A",
  stopName: "Stop A",
  destinationName: "Richmond",
  direction: "outbound",
  timeToStation: 180,
  expectedArrival: "2026-06-11T12:00:00Z",
  vehicleId: "BUS1",
};

function buildMetrics(
  overrides: Partial<ServiceHealthMetrics> = {},
): ServiceHealthMetrics {
  return {
    liveVehicleCount: 4,
    averageGapMinutes: 6,
    largestGapMinutes: 14,
    smallestGapMinutes: 2,
    bunchingClusterCount: 1,
    largeGapCount: 1,
    stalePredictionCount: 0,
    disappearedPredictionCount: 0,
    missingFromRefreshCount: 0,
    isDataStale: false,
    healthScore: 82,
    healthLabel: "Some gaps",
    estimatedLateCount: 0,
    estimatedEarlyCount: 0,
    estimatedOnTimeCount: 0,
    unknownScheduleMatchCount: 0,
    averageScheduleDeviationMinutes: null,
    possibleGhostCount: 0,
    predictionDisappearedCount: 0,
    missingLatestCount: 0,
    reappearedCount: 0,
    outbound: {
      direction: "outbound",
      liveVehicleCount: 2,
      averageGapMinutes: 6,
      largestGapMinutes: 14,
      smallestGapMinutes: 2,
      bunchingClusterCount: 1,
      largeGapCount: 1,
    },
    inbound: {
      direction: "inbound",
      liveVehicleCount: 2,
      averageGapMinutes: 8,
      largestGapMinutes: 10,
      smallestGapMinutes: 4,
      bunchingClusterCount: 0,
      largeGapCount: 0,
    },
    ...overrides,
  };
}

describe("toRouteDashboardSummary", () => {
  it("maps full service metrics to a compact dashboard summary", () => {
    const summary = toRouteDashboardSummary("337", buildMetrics());

    expect(summary).toEqual({
      routeId: "337",
      healthScore: 82,
      healthLabel: "Some gaps",
      liveVehicleCount: 4,
      largestGapMinutes: 14,
      largeGapCount: 1,
      bunchingClusterCount: 1,
      isDataStale: false,
      disappearedPredictionCount: 0,
      missingFromRefreshCount: 0,
      stalePredictionCount: 0,
      estimatedLateCount: 0,
      estimatedEarlyCount: 0,
      estimatedOnTimeCount: 0,
      unknownScheduleMatchCount: 0,
      possibleGhostCount: 0,
      predictionDisappearedCount: 0,
      missingLatestCount: 0,
    });
  });
});

describe("buildRouteIntelligence", () => {
  it("builds vehicles, metrics, and dashboard summary from the same inputs", () => {
    const now = Date.now();
    const dataUpdatedAt = now;
    const trackingStates = new Map<string, PredictionTrackingState>();

    const result = buildRouteIntelligence({
      routeId: "337",
      route: sampleRoute,
      predictions: [
        basePrediction,
        {
          ...basePrediction,
          id: "pred-2",
          vehicleId: "BUS2",
          naptanId: "490000002B",
          stopName: "Stop B",
          expectedArrival: "2026-06-11T12:20:00Z",
        },
      ],
      layout: LOOP_LAYOUT,
      dataUpdatedAt,
      now,
      trackingStates,
    });

    expect(result.vehicles).toHaveLength(2);
    expect(result.metrics.liveVehicleCount).toBe(2);
    expect(result.dashboardSummary.liveVehicleCount).toBe(
      result.metrics.liveVehicleCount,
    );
    expect(result.dashboardSummary.healthScore).toBe(result.metrics.healthScore);
    expect(result.dashboardSummary.largeGapCount).toBe(
      result.metrics.largeGapCount,
    );
  });

  it("matches direct service health metrics when tracking state is shared", () => {
    const now = Date.now();
    const trackingStates = new Map<string, PredictionTrackingState>([
      [
        "BUS1",
        {
          key: "BUS1",
          vehicleId: "BUS1",
          missingRefreshCount: 2,
          lastSeenAt: now - 60_000,
          justReappeared: false,
          wasDueSoon: false,
        },
      ],
    ]);

    const result = buildRouteIntelligence({
      routeId: "337",
      route: sampleRoute,
      predictions: [basePrediction],
      layout: LOOP_LAYOUT,
      dataUpdatedAt: now - 120_000,
      now,
      trackingStates,
    });

    const directMetrics = buildServiceHealthMetrics(result.vehicles, {
      dataUpdatedAt: now - 120_000,
      now,
      trackingStates,
    });

    expect(result.metrics).toEqual(directMetrics);
    expect(result.dashboardSummary.disappearedPredictionCount).toBe(
      directMetrics.disappearedPredictionCount,
    );
    expect(result.dashboardSummary.isDataStale).toBe(directMetrics.isDataStale);
  });

  it("renders live buses first and appends schedule ghosts after route schedule loads", () => {
    const now = new Date("2026-06-12T09:04:00.000Z").getTime();
    const baseInput = {
      routeId: "337",
      route: sampleRoute,
      predictions: [basePrediction],
      layout: LOOP_LAYOUT,
      dataUpdatedAt: now,
      now,
      trackingStates: new Map<string, PredictionTrackingState>(),
      liveBaseVersion: "20260606",
      showScheduleGhosts: true,
    };

    const liveOnly = buildRouteIntelligence(baseInput);
    expect(liveOnly.vehicles.some((vehicle) => vehicle.isScheduledGhostCandidate)).toBe(false);

    const withSchedule = buildRouteIntelligence({
      ...baseInput,
      routeSchedule: {
        baseVersion: "20260606",
        routeId: "337",
        generatedAt: "2026-06-13T00:00:00.000Z",
        journeys: [
          {
            tripId: "scheduled-ghost-trip",
            operatorCode: "CX",
            blockNo: "123568",
            blockIdx: "",
            runningNo: "568",
            garageNo: "123",
            direction: "1",
            destination: "towards Stop B",
            patternIdx: "10",
            startTime: "10:00",
            startSeconds: 36000,
            endSeconds: 36300,
            journeyType: 1,
            serviceDays: [5],
            stops: [
              {
                sequence: 1,
                stopName: "Stop A",
                stopCode: "A1",
                naptanId: "490000001A",
                scheduledTime: "10:00",
                scheduledSeconds: 36000,
              },
              {
                sequence: 2,
                stopName: "Stop B",
                stopCode: "B1",
                naptanId: "490000002B",
                scheduledTime: "10:05",
                scheduledSeconds: 36300,
              },
            ],
          },
          {
            tripId: "scheduled-ghost-trip-2",
            operatorCode: "CX",
            blockNo: "123569",
            blockIdx: "",
            runningNo: "569",
            garageNo: "123",
            direction: "1",
            destination: "towards Stop B",
            patternIdx: "10",
            startTime: "10:00",
            startSeconds: 36000,
            endSeconds: 36300,
            journeyType: 1,
            serviceDays: [5],
            stops: [
              {
                sequence: 1,
                stopName: "Stop A",
                stopCode: "A1",
                naptanId: "490000001A",
                scheduledTime: "10:00",
                scheduledSeconds: 36000,
              },
              {
                sequence: 2,
                stopName: "Stop B",
                stopCode: "B1",
                naptanId: "490000002B",
                scheduledTime: "10:05",
                scheduledSeconds: 36300,
              },
            ],
          },
        ],
      },
    });

    const scheduleGhosts = withSchedule.vehicles.filter(
      (vehicle) => vehicle.isScheduledGhostCandidate,
    );
    expect(scheduleGhosts).toHaveLength(2);
    expect(scheduleGhosts[0]?.scheduledGhostRunningNo).toBe("568");
    expect(scheduleGhosts[1]?.scheduledGhostRunningNo).toBe("569");
    expect(withSchedule.dashboardSummary.possibleGhostCount).toBe(2);
  });

  it("keeps live marker timing unknown before compact schedule data is available", () => {
    const now = new Date("2026-06-12T09:04:00.000Z").getTime();
    const result = buildRouteIntelligence({
      routeId: "337",
      route: sampleRoute,
      predictions: [
        {
          ...basePrediction,
          tripId: "trip-568",
          baseVersion: "20260606",
        },
      ],
      layout: LOOP_LAYOUT,
      dataUpdatedAt: now,
      now,
      trackingStates: new Map<string, PredictionTrackingState>(),
      timetables: {},
      includeScheduleMatching: true,
    });

    const liveVehicle = result.vehicles.find(
      (vehicle) => !vehicle.isScheduledGhostCandidate,
    );
    expect(liveVehicle?.scheduleStatus).toBe("unknown");
    expect(liveVehicle?.adherence).toBe("unknown");
  });

  it("derives early/late/on-time marker status from compact route schedule without timetable data", () => {
    const now = new Date("2026-06-12T09:04:00.000Z").getTime();
    const result = buildRouteIntelligence({
      routeId: "337",
      route: sampleRoute,
      predictions: [
        {
          ...basePrediction,
          tripId: "trip-568",
          baseVersion: "20260606",
          expectedArrival: "2026-06-12T09:05:00.000Z",
        },
      ],
      layout: LOOP_LAYOUT,
      dataUpdatedAt: now,
      now,
      trackingStates: new Map<string, PredictionTrackingState>(),
      timetables: {},
      includeScheduleMatching: true,
      collectScheduleGhostDiagnostics: true,
      showScheduleGhosts: false,
      liveBaseVersion: "20260606",
      routeSchedule: {
        baseVersion: "20260606",
        routeId: "337",
        generatedAt: "2026-06-13T00:00:00.000Z",
        journeys: [
          {
            tripId: "trip-568",
            operatorCode: "CX",
            blockNo: "123568",
            blockIdx: "",
            runningNo: "568",
            garageNo: "123",
            direction: "1",
            destination: "towards Stop B",
            patternIdx: "10",
            startTime: "10:00",
            startSeconds: 36_000,
            endSeconds: 36_900,
            journeyType: 1,
            serviceDays: [5],
            stops: [
              {
                sequence: 1,
                stopName: "Stop A",
                stopCode: "A1",
                naptanId: "490000001A",
                scheduledTime: "10:00",
                scheduledSeconds: 36_000,
              },
              {
                sequence: 2,
                stopName: "Stop B",
                stopCode: "B1",
                naptanId: "490000002B",
                scheduledTime: "10:10",
                scheduledSeconds: 36_600,
              },
            ],
          },
        ],
      },
    });

    const liveVehicle = result.vehicles.find(
      (vehicle) => !vehicle.isScheduledGhostCandidate,
    );
    expect(liveVehicle?.scheduleStatus).toBe("late");
    expect(liveVehicle?.adherence).toBe("late");
    expect(liveVehicle?.scheduleDeviationMinutes).toBeGreaterThanOrEqual(2);
    expect(result.liveBusScheduleDiagnostics).toHaveLength(1);
    expect(result.liveBusScheduleDiagnostics?.[0]?.trustedTiming).toBe(true);
  });

  it("does not compute schedule timing for collapsed routes", () => {
    const now = Date.now();
    const result = buildRouteIntelligence({
      routeId: "337",
      route: sampleRoute,
      predictions: [basePrediction],
      layout: LOOP_LAYOUT,
      dataUpdatedAt: now,
      now,
      trackingStates: new Map<string, PredictionTrackingState>(),
      includeScheduleMatching: false,
      routeSchedule: {
        baseVersion: "20260606",
        routeId: "337",
        generatedAt: "2026-06-13T00:00:00.000Z",
        journeys: [],
      },
    });

    expect(result.vehicles[0]?.adherence).toBe("unknown");
    expect(result.vehicles[0]?.scheduleStatus).toBe("unknown");
  });

  it("attaches live TfL registration from normalized prediction without iBus match", () => {
    const now = Date.now();
    const result = buildRouteIntelligence({
      routeId: "74",
      route: sampleRoute,
      predictions: [
        {
          ...basePrediction,
          routeId: "74",
          routeNumber: "74",
          vehicleId: "YY66OZO",
          vehicleRegistration: "YY66OZO",
        },
      ],
      layout: LOOP_LAYOUT,
      dataUpdatedAt: now,
      now,
      trackingStates: new Map<string, PredictionTrackingState>(),
      includeScheduleMatching: true,
    });

    expect(result.vehicles[0]?.vehicleRegistration).toBe("YY66OZO");
    expect(result.vehicles[0]?.vehicleRegistrationSource).toBe(
      "live-tfl-prediction",
    );
  });

  it("attaches reverse-lookup registration from iBus enrichment", () => {
    const now = Date.now();
    const liveDetails = new Map([
      [
        "DEL92",
        {
          runningNo: "61",
          fleetNo: "DEL92",
          registration: "LX75ZGV",
          registrationSource: "ibus-fleet-reverse-lookup" as const,
          registrationLookupStatus: "matched" as const,
        },
      ],
    ]);

    const result = buildRouteIntelligence({
      routeId: "22",
      route: sampleRoute,
      predictions: [
        {
          ...basePrediction,
          routeId: "22",
          routeNumber: "22",
          vehicleId: "DEL92",
          vehicleFleetReference: "DEL92",
        },
      ],
      layout: LOOP_LAYOUT,
      dataUpdatedAt: now,
      now,
      trackingStates: new Map<string, PredictionTrackingState>(),
      liveIbusRunningDetails: liveDetails,
      includeScheduleMatching: true,
    });

    expect(result.vehicles[0]?.vehicleRegistration).toBe("LX75ZGV");
    expect(result.vehicles[0]?.vehicleRegistrationSource).toBe(
      "ibus-fleet-reverse-lookup",
    );
    expect(result.vehicles[0]?.ibusRunningNo).toBe("61");
    expect(result.vehicles[0]?.ibusFleetNo).toBe("DEL92");
  });
});
