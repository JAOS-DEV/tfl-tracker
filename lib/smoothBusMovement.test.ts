import { describe, expect, it } from "vitest";
import { POLL_INTERVAL_MS } from "@/lib/storage";
import {
  BACKWARDS_JITTER_HOLD_TOLERANCE,
  buildMarkerSnapshot,
  crossesLoopWrapBoundary,
  decideMarkerMovement,
  getDefaultSmoothTransitionDurationMs,
  getReferenceProgress,
  getStableVehicleKey,
  interpolateMarkerPosition,
  interpolateMarkerProgress,
  isLargeBackwardsJump,
  isSmallBackwardsJitter,
  isValidMarkerPosition,
  markerJumpDistance,
  SMOOTH_BUS_TRANSITION_MS,
} from "@/lib/smoothBusMovement";
import type { EstimatedVehiclePosition } from "@/lib/tfl/types";

const baseOptions = {
  smoothBusMovementEnabled: true,
  prefersReducedMotion: false,
};

function vehicle(
  overrides: Partial<EstimatedVehiclePosition> & {
    vehicleId: string;
    progress: number;
    x: number;
    y: number;
  },
): EstimatedVehiclePosition {
  return {
    routeNumber: "337",
    direction: "outbound",
    destinationName: "Richmond",
    expectedArrival: "2026-06-11T12:03:00Z",
    timeToStation: 180,
    stopIndex: 2,
    matched: true,
    adherence: "onTime",
    nextPrediction: {
      id: "pred-1",
      routeId: "337",
      routeNumber: "337",
      naptanId: "490000001A",
      stopName: "Stop A",
      destinationName: "Richmond",
      direction: "outbound",
      timeToStation: 180,
      expectedArrival: "2026-06-11T12:03:00Z",
      vehicleId: overrides.vehicleId,
    },
    nextStop: null,
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

describe("smoothBusMovement", () => {
  it("defaults smooth movement setting to enabled via display settings module", async () => {
    const { DEFAULT_DISPLAY_SETTINGS } = await import("@/lib/displaySettings");
    expect(DEFAULT_DISPLAY_SETTINGS.smoothBusMovement).toBe(true);
  });

  it("builds stable vehicle keys from route and vehicle id", () => {
    expect(getStableVehicleKey("337", "BUS1")).toBe("337:BUS1");
  });

  it("rejects invalid marker positions", () => {
    expect(isValidMarkerPosition(100, 200)).toBe(true);
    expect(isValidMarkerPosition(0, 0)).toBe(false);
    expect(isValidMarkerPosition(Number.NaN, 10)).toBe(false);
  });

  it("animates normal forward movement with an explicit reason", () => {
    const previous = buildMarkerSnapshot(
      vehicle({
        vehicleId: "BUS1",
        progress: 0.2,
        x: 100,
        y: 200,
      }),
      "337",
    );
    const next = vehicle({
      vehicleId: "BUS1",
      progress: 0.25,
      x: 130,
      y: 205,
    });

    expect(decideMarkerMovement(next, previous, "337", null, baseOptions)).toEqual({
      mode: "animate",
      reason: "safe-forward-movement",
    });
  });

  it("snaps on first appearance with first-seen reason", () => {
    const next = vehicle({
      vehicleId: "BUS1",
      progress: 0.2,
      x: 100,
      y: 200,
    });

    expect(decideMarkerMovement(next, null, "337", null, baseOptions)).toEqual({
      mode: "snap",
      reason: "first-seen",
    });
  });

  it("snaps when smooth movement is disabled", () => {
    const previous = buildMarkerSnapshot(
      vehicle({
        vehicleId: "BUS1",
        progress: 0.2,
        x: 100,
        y: 200,
      }),
      "337",
    );
    const next = vehicle({
      vehicleId: "BUS1",
      progress: 0.25,
      x: 130,
      y: 205,
    });

    expect(
      decideMarkerMovement(next, previous, "337", null, {
        ...baseOptions,
        smoothBusMovementEnabled: false,
      }),
    ).toEqual({ mode: "snap", reason: "setting-disabled" });
  });

  it("snaps when reduced motion is requested", () => {
    const previous = buildMarkerSnapshot(
      vehicle({
        vehicleId: "BUS1",
        progress: 0.2,
        x: 100,
        y: 200,
      }),
      "337",
    );
    const next = vehicle({
      vehicleId: "BUS1",
      progress: 0.25,
      x: 130,
      y: 205,
    });

    expect(
      decideMarkerMovement(next, previous, "337", null, {
        ...baseOptions,
        prefersReducedMotion: true,
      }),
    ).toEqual({ mode: "snap", reason: "reduced-motion" });
  });

  it("snaps for ghost buses", () => {
    const previous = buildMarkerSnapshot(
      vehicle({
        vehicleId: "BUS1",
        progress: 0.2,
        x: 100,
        y: 200,
      }),
      "337",
    );
    const next = vehicle({
      vehicleId: "BUS1",
      progress: 0.25,
      x: 130,
      y: 205,
      isSuspectedGhost: true,
      ghostStatus: "suspectedGhost",
    });

    expect(decideMarkerMovement(next, previous, "337", null, baseOptions)).toEqual({
      mode: "snap",
      reason: "ghost",
    });
  });

  it("snaps for disappeared and stale buses", () => {
    const previous = buildMarkerSnapshot(
      vehicle({
        vehicleId: "BUS1",
        progress: 0.2,
        x: 100,
        y: 200,
      }),
      "337",
    );

    expect(
      decideMarkerMovement(
        vehicle({
          vehicleId: "BUS1",
          progress: 0.25,
          x: 130,
          y: 205,
          ghostStatus: "disappeared",
        }),
        previous,
        "337",
        null,
        baseOptions,
      ),
    ).toEqual({ mode: "snap", reason: "disappeared" });

    expect(
      decideMarkerMovement(
        vehicle({
          vehicleId: "BUS1",
          progress: 0.25,
          x: 130,
          y: 205,
          predictionConfidence: "stale",
        }),
        previous,
        "337",
        null,
        baseOptions,
      ),
    ).toEqual({ mode: "snap", reason: "stale" });
  });

  it("snaps for reappeared buses", () => {
    const previous = buildMarkerSnapshot(
      vehicle({
        vehicleId: "BUS1",
        progress: 0.2,
        x: 100,
        y: 200,
      }),
      "337",
    );

    expect(
      decideMarkerMovement(
        vehicle({
          vehicleId: "BUS1",
          progress: 0.25,
          x: 130,
          y: 205,
          ghostStatus: "reappeared",
        }),
        previous,
        "337",
        null,
        baseOptions,
      ),
    ).toEqual({ mode: "snap", reason: "reappeared" });
  });

  it("snaps for unreasonable jumps", () => {
    const previous = buildMarkerSnapshot(
      vehicle({
        vehicleId: "BUS1",
        progress: 0.2,
        x: 100,
        y: 200,
      }),
      "337",
    );

    expect(
      decideMarkerMovement(
        vehicle({
          vehicleId: "BUS1",
          progress: 0.25,
          x: 600,
          y: 500,
        }),
        previous,
        "337",
        null,
        baseOptions,
      ),
    ).toEqual({ mode: "snap", reason: "jump-too-far" });
  });

  it("holds small backwards jitter instead of animating backwards", () => {
    const previous = buildMarkerSnapshot(
      vehicle({
        vehicleId: "BUS1",
        progress: 0.3,
        x: 100,
        y: 200,
      }),
      "337",
    );

    expect(
      decideMarkerMovement(
        vehicle({
          vehicleId: "BUS1",
          progress: 0.295,
          x: 98,
          y: 198,
        }),
        previous,
        "337",
        { x: 100, y: 200, progress: 0.3 },
        baseOptions,
      ),
    ).toEqual({ mode: "hold", reason: "small-backwards-jitter" });
  });

  it("snaps for large backwards jumps", () => {
    const previous = buildMarkerSnapshot(
      vehicle({
        vehicleId: "BUS1",
        progress: 0.3,
        x: 100,
        y: 200,
      }),
      "337",
    );

    expect(
      decideMarkerMovement(
        vehicle({
          vehicleId: "BUS1",
          progress: 0.2,
          x: 90,
          y: 195,
        }),
        previous,
        "337",
        null,
        baseOptions,
      ),
    ).toEqual({ mode: "snap", reason: "backwards-jump" });
  });

  it("uses display progress ahead of committed snapshot when checking jitter", () => {
    const previous = buildMarkerSnapshot(
      vehicle({
        vehicleId: "BUS1",
        progress: 0.2,
        x: 100,
        y: 200,
      }),
      "337",
    );

    expect(
      getReferenceProgress(previous, { x: 125, y: 203, progress: 0.24 }),
    ).toBe(0.24);

    expect(
      decideMarkerMovement(
        vehicle({
          vehicleId: "BUS1",
          progress: 0.23,
          x: 124,
          y: 202,
        }),
        previous,
        "337",
        { x: 125, y: 203, progress: 0.24 },
        baseOptions,
      ),
    ).toEqual({ mode: "hold", reason: "small-backwards-jitter" });
  });

  it("snaps when crossing loop wrap boundary", () => {
    expect(crossesLoopWrapBoundary(0.45, 0.55)).toBe(true);
    expect(crossesLoopWrapBoundary(0.2, 0.25)).toBe(false);

    const previous = buildMarkerSnapshot(
      vehicle({
        vehicleId: "BUS1",
        progress: 0.45,
        x: 100,
        y: 200,
      }),
      "337",
    );

    expect(
      decideMarkerMovement(
        vehicle({
          vehicleId: "BUS1",
          progress: 0.55,
          x: 130,
          y: 205,
          direction: "outbound",
        }),
        previous,
        "337",
        null,
        baseOptions,
      ),
    ).toEqual({ mode: "snap", reason: "wrap-boundary" });
  });

  it("holds negligible forward movement instead of snapping", () => {
    const previous = buildMarkerSnapshot(
      vehicle({
        vehicleId: "BUS1",
        progress: 0.2,
        x: 100,
        y: 200,
      }),
      "337",
    );

    expect(
      decideMarkerMovement(
        vehicle({
          vehicleId: "BUS1",
          progress: 0.201,
          x: 100.2,
          y: 200.1,
        }),
        previous,
        "337",
        null,
        baseOptions,
      ),
    ).toEqual({ mode: "hold", reason: "negligible-movement" });
  });

  it("does not move beyond interpolation target", () => {
    const position = interpolateMarkerPosition(10, 20, 50, 80, 1.5);
    expect(position).toEqual({ x: 50, y: 80 });
    expect(interpolateMarkerProgress(0.2, 0.3, 1.5)).toBe(0.3);
  });

  it("keeps marker snapshots separate from vehicle prediction data", () => {
    const source = vehicle({
      vehicleId: "BUS1",
      progress: 0.2,
      x: 100,
      y: 200,
    });
    const snapshot = buildMarkerSnapshot(source, "337");
    snapshot.x = 999;
    snapshot.progress = 0.99;

    expect(source.x).toBe(100);
    expect(source.progress).toBe(0.2);
    expect(source.nextPrediction.vehicleId).toBe("BUS1");
  });

  it("uses a transition duration slightly below the TfL refresh interval", () => {
    expect(getDefaultSmoothTransitionDurationMs()).toBe(
      Math.min(SMOOTH_BUS_TRANSITION_MS, POLL_INTERVAL_MS - 2_000),
    );
    expect(markerJumpDistance(0, 0, 3, 4)).toBe(5);
    expect(isSmallBackwardsJitter(0.3, 0.29)).toBe(true);
    expect(isLargeBackwardsJump(0.3, 0.2)).toBe(true);
    expect(BACKWARDS_JITTER_HOLD_TOLERANCE).toBe(0.02);
  });

  it("snaps when route context changes", () => {
    const previous = buildMarkerSnapshot(
      vehicle({
        vehicleId: "BUS1",
        progress: 0.2,
        x: 100,
        y: 200,
      }),
      "156",
    );

    expect(
      decideMarkerMovement(
        vehicle({
          vehicleId: "BUS1",
          progress: 0.25,
          x: 130,
          y: 205,
        }),
        previous,
        "337",
        null,
        baseOptions,
      ),
    ).toEqual({ mode: "snap", reason: "route-changed" });
  });

  it("returns a reason for every decision branch", () => {
    const branches = [
      decideMarkerMovement(vehicle({ vehicleId: "", progress: 0.2, x: 1, y: 1 }), null, "337", null, baseOptions),
      decideMarkerMovement(vehicle({ vehicleId: "BUS1", progress: 0.2, x: 1, y: 1 }), null, "337", null, baseOptions),
      decideMarkerMovement(vehicle({ vehicleId: "BUS1", progress: 0.2, x: 1, y: 1, isSuspectedGhost: true, ghostStatus: "suspectedGhost" }), buildMarkerSnapshot(vehicle({ vehicleId: "BUS1", progress: 0.1, x: 1, y: 1 }), "337"), "337", null, baseOptions),
    ];

    for (const decision of branches) {
      expect(decision.reason).toBeTruthy();
      expect(["animate", "snap", "hold"]).toContain(decision.mode);
    }
  });
});
