import { describe, expect, it } from "vitest";
import { LOOP_LAYOUT } from "@/lib/constants";
import {
  buildRouteSchedule,
  computeJourneyStops,
} from "@/lib/ibus/scheduleBuilder";
import {
  parseJourneyDetailXml,
  parseJourneyDriveTimeXml,
  parseJourneyWaitTimeXml,
  parsePatternXml,
  parseStopInPatternXml,
} from "@/lib/ibus/scheduleParsers";
import {
  applyScheduleGhostDuplicateGuard,
  getScheduledGhostCandidates,
  hasPlausibleLiveMatch,
  isJourneyActiveAtTime,
  isJourneyScheduledForToday,
  scheduledGhostToVehiclePosition,
} from "@/lib/scheduledGhostBuses";
import { decideMarkerMovement } from "@/lib/smoothBusMovement";
import type { EstimatedVehiclePosition, NormalizedRoute } from "@/lib/tfl/types";

const sampleRoute: NormalizedRoute = {
  routeId: "337",
  routeName: "337",
  outbound: [
    { id: "1", name: "Stop A", naptanId: "490000001A", isTimingPoint: false },
    { id: "2", name: "Stop B", naptanId: "490000002B", isTimingPoint: false },
  ],
  inbound: [
    { id: "3", name: "Stop C", naptanId: "490000003C", isTimingPoint: false },
  ],
};

const journeyXml = `<?xml version="1.0" encoding="UTF-8"?>
<jou:Schedule_Data xmlns:jou="http://www.tfl.uk/CDII/Journey">
  <Journey aJourney_Idx="9001" aPattern_Idx="10" aBlock_Idx="100">
    <Trip_No_LBSL>1</Trip_No_LBSL>
    <Type>1</Type>
    <Start_Time>36000</Start_Time>
  </Journey>
</jou:Schedule_Data>`;

const waitXml = `<?xml version="1.0" encoding="UTF-8"?>
<jouwt:Schedule_Data xmlns:jouwt="http://www.tfl.uk/CDII/Journey_Wait_Time">
  <Journey_Wait_Time aJourney_Idx="9001" aStop_In_Pattern_Idx="501">
    <Wait_Time>60</Wait_Time>
  </Journey_Wait_Time>
</jouwt:Schedule_Data>`;

const driveXml = `<?xml version="1.0" encoding="UTF-8"?>
<joudt:Schedule_Data xmlns:joudt="http://www.tfl.uk/CDII/Journey_Drive_Time">
  <Journey_Drive_Time aJourney_Idx="9001" aStop_In_Pattern_From_Idx="501" aStop_In_Pattern_To_Idx="502">
    <Drive_Time>300</Drive_Time>
  </Journey_Drive_Time>
</joudt:Schedule_Data>`;

const patternXml = `<?xml version="1.0" encoding="UTF-8"?>
<pt:Network_Data xmlns:pt="http://www.tfl.uk/CDII/Pattern">
  <Pattern aPattern_Idx="10" aContract_Line_No="337">
    <Direction>1</Direction>
    <Type>1</Type>
  </Pattern>
</pt:Network_Data>`;

const stopInPatternXml = `<?xml version="1.0" encoding="UTF-8"?>
<sipt:Network_Data xmlns:sipt="http://www.tfl.uk/CDII/Stop_In_Pattern">
  <Stop_In_Pattern aStop_In_Pattern_Idx="501" aPattern_Idx="10" aStop_Point_Idx="1">
    <Sequence_No>1</Sequence_No>
    <Timing_Point_Code>A1</Timing_Point_Code>
  </Stop_In_Pattern>
  <Stop_In_Pattern aStop_In_Pattern_Idx="502" aPattern_Idx="10" aStop_Point_Idx="2">
    <Sequence_No>2</Sequence_No>
    <Timing_Point_Code>B1</Timing_Point_Code>
  </Stop_In_Pattern>
</sipt:Network_Data>`;

function liveVehicle(
  overrides: Partial<EstimatedVehiclePosition> & { vehicleId: string },
): EstimatedVehiclePosition {
  return {
    routeNumber: "337",
    direction: "outbound",
    destinationName: "Richmond",
    expectedArrival: "2026-06-13T10:06:00.000Z",
    timeToStation: 180,
    stopIndex: 1,
    progress: 0.2,
    x: 100,
    y: 200,
    matched: true,
    adherence: "onTime",
    nextPrediction: {
      id: "pred-1",
      routeId: "337",
      routeNumber: "337",
      naptanId: "490000002B",
      stopName: "Stop B",
      destinationName: "Richmond",
      direction: "outbound",
      timeToStation: 180,
      expectedArrival: "2026-06-13T10:06:00.000Z",
      vehicleId: overrides.vehicleId,
      tripId: overrides.tripId,
      baseVersion: overrides.baseVersion,
    },
    nextStop: sampleRoute.outbound[1],
    scheduleDeviationMinutes: null,
    scheduleStatus: "unknown",
    scheduleStatusLabel: "Schedule ?",
    scheduleMatchConfidence: "unknown",
    matchedScheduledTime: null,
    matchedStopName: null,
    scheduleDataAvailable: false,
    ghostStatus: "normal",
    missedRefreshCount: 0,
    isSuspectedGhost: false,
    ...overrides,
  };
}

describe("schedule import output", () => {
  it("builds route schedule records from compact fixtures", () => {
    const journeys = parseJourneyDetailXml(journeyXml);
    const waits = parseJourneyWaitTimeXml(waitXml);
    const drives = parseJourneyDriveTimeXml(driveXml);
    const patterns = parsePatternXml(patternXml);
    const stopsInPattern = parseStopInPatternXml(stopInPatternXml);
    const stopPoints = {
      "1": {
        stopPointIdx: "1",
        stopCode: "A1",
        stopName: "Stop A",
        naptanId: "490000001A",
      },
      "2": {
        stopPointIdx: "2",
        stopCode: "B1",
        stopName: "Stop B",
        naptanId: "490000002B",
      },
    };

    const schedule = buildRouteSchedule({
      baseVersion: "20260606",
      routeId: "337",
      generatedAt: "2026-06-13T10:00:00.000Z",
      patterns,
      stopsInPattern,
      stopPoints,
      journeys,
      waits,
      drives,
      blocks: [
        {
          blockIdx: "100",
          blockNo: "123568",
          runningNo: "568",
          garageNo: "123",
          operatorCode: "CX",
        },
      ],
      blockServiceDays: { "100": [1, 2, 3, 4, 5, 6, 0] },
    });

    expect(schedule.routeId).toBe("337");
    expect(schedule.journeys).toHaveLength(1);
    expect(schedule.journeys[0]?.runningNo).toBe("568");
    expect(schedule.journeys[0]?.stops).toHaveLength(2);
    expect(schedule.journeys[0]?.stops[1]?.scheduledTime).toBe("10:06");
  });
});

describe("scheduledGhostBuses", () => {
  const scheduleJourney = buildRouteSchedule({
    baseVersion: "20260606",
    routeId: "337",
    generatedAt: "2026-06-13T10:00:00.000Z",
    patterns: parsePatternXml(patternXml),
    stopsInPattern: parseStopInPatternXml(stopInPatternXml),
    stopPoints: {
      "1": {
        stopPointIdx: "1",
        stopCode: "A1",
        stopName: "Stop A",
        naptanId: "490000001A",
      },
      "2": {
        stopPointIdx: "2",
        stopCode: "B1",
        stopName: "Stop B",
        naptanId: "490000002B",
      },
    },
    journeys: parseJourneyDetailXml(journeyXml),
    waits: parseJourneyWaitTimeXml(waitXml),
    drives: parseJourneyDriveTimeXml(driveXml),
    blocks: [
      {
        blockIdx: "100",
        blockNo: "123568",
        runningNo: "568",
        garageNo: "123",
        operatorCode: "CX",
      },
    ],
    blockServiceDays: { "100": [5] },
  }).journeys[0]!;

  it("detects active scheduled journeys by current time", () => {
    expect(isJourneyActiveAtTime(scheduleJourney, 10 * 3600 + 4 * 60)).toBe(true);
    expect(isJourneyActiveAtTime(scheduleJourney, 8 * 3600)).toBe(false);
    expect(isJourneyActiveAtTime(scheduleJourney, 12 * 3600)).toBe(false);
  });

  it("does not create ghosts before scheduled start or after scheduled end", () => {
    const before = getScheduledGhostCandidates({
      routeId: "337",
      now: new Date("2026-06-13T08:00:00.000Z"),
      liveVehicles: [],
      scheduledJourneys: [scheduleJourney],
      route: sampleRoute,
      layout: LOOP_LAYOUT,
      scheduleBaseVersion: "20260606",
    });
    const after = getScheduledGhostCandidates({
      routeId: "337",
      now: new Date("2026-06-13T12:30:00.000Z"),
      liveVehicles: [],
      scheduledJourneys: [scheduleJourney],
      route: sampleRoute,
      layout: LOOP_LAYOUT,
      scheduleBaseVersion: "20260606",
    });
    expect(before).toHaveLength(0);
    expect(after).toHaveLength(0);
  });

  it("suppresses ghosts when tripId matches a live vehicle", () => {
    const candidates = getScheduledGhostCandidates({
      routeId: "337",
      now: new Date("2026-06-13T09:04:00.000Z"),
      liveVehicles: [
        liveVehicle({
          vehicleId: "BUS1",
          tripId: "9001",
          baseVersion: "20260606",
        }),
      ],
      scheduledJourneys: [scheduleJourney],
      route: sampleRoute,
      layout: LOOP_LAYOUT,
      scheduleBaseVersion: "20260606",
      liveBaseVersion: "20260606",
    });
    expect(candidates).toHaveLength(0);
  });

  it("suppresses ghosts when running/block matches live enrichment", () => {
    expect(
      hasPlausibleLiveMatch(
        scheduleJourney,
        {
          routeId: "337",
          direction: "outbound",
          destinationName: "Richmond",
          runningNo: "568",
          blockNo: "123568",
        },
        scheduleJourney.stops[1] ?? null,
        new Date("2026-06-13T10:04:00.000Z"),
        sampleRoute,
        "20260606",
      ),
    ).toBe(true);
  });

  it("suppresses ghosts when same route has the same normalized running number", () => {
    expect(
      hasPlausibleLiveMatch(
        { ...scheduleJourney, runningNo: "136" },
        {
          routeId: "156",
          direction: "inbound",
          destinationName: "Wimbledon",
          runningNo: "0136",
        },
        scheduleJourney.stops[0] ?? null,
        new Date("2026-06-13T10:04:00.000Z"),
        { ...sampleRoute, routeId: "156", routeName: "156" },
        "20260606",
      ),
    ).toBe(true);
  });

  it("does not suppress ghosts when the same running number is on a different route", () => {
    expect(
      hasPlausibleLiveMatch(
        { ...scheduleJourney, runningNo: "136" },
        {
          routeId: "337",
          direction: "outbound",
          destinationName: "Richmond",
          runningNo: "136",
        },
        scheduleJourney.stops[0] ?? null,
        new Date("2026-06-13T10:04:00.000Z"),
        { ...sampleRoute, routeId: "156", routeName: "156" },
        "20260606",
      ),
    ).toBe(false);
  });

  it("suppresses route 156 ghosts when a live bus has iBus running number 136", () => {
    const route156 = { ...sampleRoute, routeId: "156", routeName: "156" };
    const journey136 = { ...scheduleJourney, runningNo: "136", blockNo: "136001" };
    const activeTime = new Date("2026-06-12T09:04:00.000Z");

    const candidates = getScheduledGhostCandidates({
      routeId: "156",
      now: activeTime,
      liveVehicles: [
        liveVehicle({
          vehicleId: "BUS-136",
          routeNumber: "156",
          ibusRunningNo: "136",
          ibusBlockNo: "136001",
        }),
      ],
      scheduledJourneys: [journey136],
      route: route156,
      layout: LOOP_LAYOUT,
      scheduleBaseVersion: "20260606",
    });

    expect(candidates).toHaveLength(0);
  });

  it("dedupes duplicate schedule ghosts and suppresses live running-number duplicates", () => {
    const duplicateCandidates = [
      {
        kind: "scheduled-ghost-candidate" as const,
        routeId: "156",
        direction: "outbound" as const,
        tripId: "9001",
        baseVersion: "20260606",
        runningNo: "136",
        blockNo: "136001",
        garageNo: null,
        operatorCode: null,
        destination: "towards Stop B",
        expectedStopName: "Stop B",
        expectedStopCode: "B1",
        expectedScheduledTime: "10:04",
        progress: 0.2,
        x: 10,
        y: 20,
        confidence: "high" as const,
        reason: "scheduled-journey-active-but-no-live-match",
      },
      {
        kind: "scheduled-ghost-candidate" as const,
        routeId: "156",
        direction: "outbound" as const,
        tripId: "9001",
        baseVersion: "20260606",
        runningNo: "136",
        blockNo: "136001",
        garageNo: null,
        operatorCode: null,
        destination: "towards Stop B",
        expectedStopName: "Stop B",
        expectedStopCode: "B1",
        expectedScheduledTime: "10:04",
        progress: 0.2,
        x: 10,
        y: 20,
        confidence: "high" as const,
        reason: "scheduled-journey-active-but-no-live-match",
      },
    ];

    const liveSuppressed = applyScheduleGhostDuplicateGuard(
      "156",
      [
        liveVehicle({
          vehicleId: "BUS-136",
          routeNumber: "156",
          ibusRunningNo: "136",
        }),
      ],
      duplicateCandidates,
      true,
    );

    expect(liveSuppressed.candidates).toHaveLength(0);
    expect(liveSuppressed.diagnostics[0]).toContain("Suppressed schedule ghost 136");

    const deduped = applyScheduleGhostDuplicateGuard(
      "156",
      [],
      duplicateCandidates,
    );

    expect(deduped.candidates).toHaveLength(1);
  });

  it("shows only live buses when live and ghost would share running number 136", () => {
    const route156 = { ...sampleRoute, routeId: "156", routeName: "156" };
    const journey136 = { ...scheduleJourney, runningNo: "136", blockNo: "136001" };
    const activeTime = new Date("2026-06-12T09:04:00.000Z");
    const live = liveVehicle({
      vehicleId: "BUS-136",
      routeNumber: "156",
      ibusRunningNo: "136",
    });

    const candidates = getScheduledGhostCandidates({
      routeId: "156",
      now: activeTime,
      liveVehicles: [live],
      scheduledJourneys: [journey136],
      route: route156,
      layout: LOOP_LAYOUT,
      scheduleBaseVersion: "20260606",
    });
    const guarded = applyScheduleGhostDuplicateGuard("156", [live], candidates);

    expect(guarded.candidates).toHaveLength(0);
    expect(
      [live, ...guarded.candidates.map(scheduledGhostToVehiclePosition)].filter(
        (vehicle) => vehicle.isScheduledGhostCandidate,
      ),
    ).toHaveLength(0);
  });

  it("creates a possible ghost for unmatched active scheduled journeys", () => {
    const fridayLondonTenOhFour = new Date("2026-06-12T09:04:00.000Z");
    expect(isJourneyScheduledForToday(scheduleJourney, fridayLondonTenOhFour)).toBe(true);

    const candidates = getScheduledGhostCandidates({
      routeId: "337",
      now: fridayLondonTenOhFour,
      liveVehicles: [],
      scheduledJourneys: [scheduleJourney],
      route: sampleRoute,
      layout: LOOP_LAYOUT,
      scheduleBaseVersion: "20260606",
    });

    expect(candidates).toHaveLength(1);
    expect(candidates[0]?.runningNo).toBe("568");
    expect(candidates[0]?.confidence).toBe("high");
  });

  it("hides low-confidence ghosts unless advanced diagnostics are enabled", () => {
    const lowConfidenceJourney = {
      ...scheduleJourney,
      runningNo: "",
      blockNo: "",
    };

    const activeTime = new Date("2026-06-12T09:04:00.000Z");

    const hidden = getScheduledGhostCandidates({
      routeId: "337",
      now: activeTime,
      liveVehicles: [],
      scheduledJourneys: [lowConfidenceJourney],
      route: sampleRoute,
      layout: LOOP_LAYOUT,
      scheduleBaseVersion: "20260606",
    });
    const shown = getScheduledGhostCandidates({
      routeId: "337",
      now: activeTime,
      liveVehicles: [],
      scheduledJourneys: [lowConfidenceJourney],
      route: sampleRoute,
      layout: LOOP_LAYOUT,
      scheduleBaseVersion: "20260606",
      includeLowConfidence: true,
    });

    expect(hidden).toHaveLength(0);
    expect(shown).toHaveLength(1);
    expect(shown[0]?.confidence).toBe("low");
  });

  it("does not mutate live prediction data when converting to display vehicles", () => {
    const candidate = getScheduledGhostCandidates({
      routeId: "337",
      now: new Date("2026-06-12T09:04:00.000Z"),
      liveVehicles: [],
      scheduledJourneys: [scheduleJourney],
      route: sampleRoute,
      layout: LOOP_LAYOUT,
      scheduleBaseVersion: "20260606",
    })[0]!;
    const vehicle = scheduledGhostToVehiclePosition(candidate);
    expect(vehicle.isScheduledGhostCandidate).toBe(true);
    expect(vehicle.nextPrediction.tripId).toBe("9001");
    expect(scheduleJourney.tripId).toBe("9001");
  });

  it("snaps scheduled ghost markers instead of animating them", () => {
    const ghost = scheduledGhostToVehiclePosition({
      kind: "scheduled-ghost-candidate",
      routeId: "337",
      direction: "outbound",
      tripId: "9001",
      baseVersion: "20260606",
      runningNo: "568",
      blockNo: "123568",
      garageNo: "123",
      operatorCode: "CX",
      destination: null,
      expectedStopName: "Stop B",
      expectedStopCode: "B1",
      expectedScheduledTime: "10:05",
      progress: 0.3,
      x: 120,
      y: 220,
      confidence: "high",
      reason: "scheduled-journey-active-but-no-live-match",
    });

    const decision = decideMarkerMovement(
      ghost,
      {
        routeId: "337",
        vehicleId: ghost.vehicleId,
        direction: "outbound",
        progress: 0.2,
        x: 100,
        y: 200,
      },
      "337",
      null,
      { smoothBusMovementEnabled: true, prefersReducedMotion: false },
    );

    expect(decision.mode).toBe("snap");
  });
});

describe("computeJourneyStops", () => {
  it("does not move beyond the final scheduled stop target", () => {
    const journey = parseJourneyDetailXml(journeyXml)[0]!;
    const stops = computeJourneyStops(
      journey,
      parseStopInPatternXml(stopInPatternXml),
      {
        "1": {
          stopPointIdx: "1",
          stopCode: "A1",
          stopName: "Stop A",
          naptanId: "490000001A",
        },
        "2": {
          stopPointIdx: "2",
          stopCode: "B1",
          stopName: "Stop B",
          naptanId: "490000002B",
        },
      },
      new Map([["501", 60]]),
      new Map([
        [
          "501",
          { toStopInPatternIdx: "502", driveSeconds: 300 },
        ],
      ]),
    );

    expect(stops.at(-1)?.scheduledSeconds).toBe(36000 + 60 + 300);
  });
});
