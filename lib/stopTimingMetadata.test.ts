import { describe, expect, it } from "vitest";
import {
  enrichRouteTimingMetadata,
  hasAnyTimingPointMetadata,
} from "@/lib/stopTimingMetadata";
import type { IbusRouteSchedule } from "@/lib/ibus/scheduleTypes";
import type { NormalizedRoute } from "@/lib/tfl/types";

const route: NormalizedRoute = {
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
  inbound: [],
};

const schedule: IbusRouteSchedule = {
  baseVersion: "20260606",
  routeId: "337",
  generatedAt: "2026-06-06T00:00:00.000Z",
  journeys: [
    {
      tripId: "trip-1",
      operatorCode: "LT",
      blockNo: "337001",
      blockIdx: "1",
      runningNo: "101",
      garageNo: "AB",
      direction: "outbound",
      destination: "Richmond",
      patternIdx: "1",
      startTime: "08:00",
      startSeconds: 28800,
      endSeconds: 29400,
      journeyType: 1,
      serviceDays: [1, 2, 3, 4, 5],
      stops: [
        {
          sequence: 1,
          stopCode: "A",
          naptanId: "490000001A",
          stopName: "Stop A",
          scheduledTime: "08:00",
          scheduledSeconds: 28800,
        },
        {
          sequence: 2,
          stopCode: "B",
          naptanId: "490000002B",
          stopName: "Stop B",
          scheduledTime: "08:05",
          scheduledSeconds: 288300,
        },
      ],
    },
  ],
};

describe("enrichRouteTimingMetadata", () => {
  it("does not mark schedule stops with stopCode alone as timing points", () => {
    const enriched = enrichRouteTimingMetadata(route);

    expect(enriched.outbound[0]?.isTimingPoint).toBe(false);
    expect(enriched.outbound[1]?.isTimingPoint).toBe(false);
    expect(enriched.outbound[0]?.isQsiPoint).toBe(false);
    expect(hasAnyTimingPointMetadata(enriched)).toBe(false);
    expect(schedule.journeys[0]?.stops[0]?.stopCode).toBe("A");
  });

  it("keeps default stop metadata false without a verified source", () => {
    const enriched = enrichRouteTimingMetadata(route);
    expect(enriched.outbound.every((stop) => !stop.isTimingPoint)).toBe(true);
    expect(enriched.outbound.every((stop) => !stop.isQsiPoint)).toBe(true);
  });

  it("only keeps timing points when a verified source is present", () => {
    const verifiedRoute: NormalizedRoute = {
      ...route,
      outbound: [
        {
          ...route.outbound[0]!,
          isTimingPoint: true,
          timingPointSource: "ibus-timing-point",
        },
      ],
    };

    const enriched = enrichRouteTimingMetadata(verifiedRoute);
    expect(enriched.outbound[0]?.isTimingPoint).toBe(true);
    expect(hasAnyTimingPointMetadata(enriched)).toBe(true);
  });

  it("only keeps QSI points when qsi-import source is present", () => {
    const verifiedRoute: NormalizedRoute = {
      ...route,
      outbound: [
        {
          ...route.outbound[0]!,
          isTimingPoint: true,
          isQsiPoint: true,
          timingPointSource: "qsi-import",
        },
      ],
    };

    const enriched = enrichRouteTimingMetadata(verifiedRoute);
    expect(enriched.outbound[0]?.isQsiPoint).toBe(true);
  });
});
