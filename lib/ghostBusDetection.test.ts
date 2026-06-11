import { describe, expect, it } from "vitest";
import {
  ghostStatusLabel,
  resolveGhostStatus,
} from "@/lib/ghostBusDetection";
import type { PredictionTrackingState } from "@/lib/tfl/types";

function state(
  overrides: Partial<PredictionTrackingState>,
): PredictionTrackingState {
  return {
    key: "V1",
    vehicleId: "V1",
    missingRefreshCount: 0,
    lastSeenAt: Date.now() - 120_000,
    justReappeared: false,
    wasDueSoon: false,
    ...overrides,
  };
}

describe("resolveGhostStatus", () => {
  it("marks one missing refresh as missingLatest", () => {
    const ghost = resolveGhostStatus({
      state: state({ missingRefreshCount: 1 }),
      dataUpdatedAt: Date.now(),
      now: Date.now(),
    });
    expect(ghost.ghostStatus).toBe("missingLatest");
  });

  it("marks two missing refreshes as disappeared", () => {
    const ghost = resolveGhostStatus({
      state: state({ missingRefreshCount: 2 }),
      dataUpdatedAt: Date.now(),
      now: Date.now(),
    });
    expect(ghost.ghostStatus).toBe("disappeared");
  });

  it("marks repeated due-soon disappearance as suspectedGhost", () => {
    const ghost = resolveGhostStatus({
      state: state({
        missingRefreshCount: 3,
        wasDueSoon: true,
        lastTimeToStation: 60,
        lastSeenAt: Date.now() - 120_000,
      }),
      dataUpdatedAt: Date.now(),
      now: Date.now(),
    });
    expect(ghost.ghostStatus).toBe("suspectedGhost");
    expect(ghost.isSuspectedGhost).toBe(true);
  });

  it("briefly marks reappeared predictions", () => {
    const now = Date.now();
    const ghost = resolveGhostStatus({
      state: state({
        justReappeared: true,
        reappearedAt: now,
        missingRefreshCount: 0,
      }),
      dataUpdatedAt: now,
      now,
    });
    expect(ghost.ghostStatus).toBe("reappeared");
  });
});

describe("ghostStatusLabel", () => {
  it("uses careful public wording", () => {
    expect(ghostStatusLabel("suspectedGhost")).toBe("Possible ghost");
    expect(ghostStatusLabel("disappeared")).toBe("Prediction disappeared");
  });
});
