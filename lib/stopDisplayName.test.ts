import { describe, expect, it } from "vitest";
import {
  formatMatchedStopDisplayName,
  isStopIdLike,
  resolveStopDisplayName,
} from "@/lib/stopDisplayName";
import type { NormalizedRoute } from "@/lib/tfl/types";

const route: NormalizedRoute = {
  routeId: "337",
  routeName: "337",
  outbound: [
    {
      id: "1",
      naptanId: "490014195N",
      name: "Wandsworth Town Hall",
      isTimingPoint: true,
    },
  ],
  inbound: [],
};

describe("stopDisplayName", () => {
  it("detects stop-id-like strings", () => {
    expect(isStopIdLike("490014195N")).toBe(true);
    expect(isStopIdLike("Wandsworth Town Hall")).toBe(false);
  });

  it("resolves stop names from the route sequence", () => {
    expect(resolveStopDisplayName("490014195N", route, "outbound")).toBe(
      "Wandsworth Town Hall",
    );
  });

  it("prefers route stop names over timetable ids", () => {
    const name = formatMatchedStopDisplayName(
      {
        direction: "outbound",
        nextStop: {
          id: "1",
          naptanId: "490014195N",
          name: "Wandsworth Town Hall",
          isTimingPoint: true,
        },
      },
      {
        stopId: "490014195N",
        naptanId: "490014195N",
        stopName: "490014195N",
      },
      route,
    );

    expect(name).toBe("Wandsworth Town Hall");
  });
});
