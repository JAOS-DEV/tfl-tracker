import { describe, expect, it } from "vitest";
import { getLoopLayout } from "@/lib/constants";
import { groupPredictionsByVehicle } from "@/lib/tfl/normalizers";
import {
  clampProgressToDirectionLeg,
  getDirectionLegProgressBounds,
  buildLoopPath,
  buildLoopStops,
  buildVehiclePositions,
  estimateVehiclePositionOnRoute,
  getLoopLegEndpoints,
  getVehicleNextPrediction,
  mapProgressToLoopCoordinates,
  stopProgress,
} from "@/lib/routePositioning";
import type {
  NormalizedRoute,
  NormalizedVehiclePrediction,
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
    {
      id: "3",
      name: "Stop C",
      naptanId: "490000003C",
      isTimingPoint: false,
    },
  ],
  inbound: [
    {
      id: "4",
      name: "Stop D",
      naptanId: "490000004D",
      isTimingPoint: false,
    },
    {
      id: "5",
      name: "Stop E",
      naptanId: "490000005E",
      isTimingPoint: false,
    },
  ],
};

const samplePrediction: NormalizedVehiclePrediction = {
  id: "pred-1",
  routeId: "337",
  routeNumber: "337",
  naptanId: "490000002B",
  stopName: "Stop B",
  destinationName: "Richmond",
  direction: "outbound",
  timeToStation: 180,
  expectedArrival: "2026-06-11T12:03:00Z",
  vehicleId: "BUS1",
};

describe("stopProgress", () => {
  it("maps outbound stops from left to right along the top half", () => {
    expect(stopProgress("outbound", 0, 3)).toBeLessThan(
      stopProgress("outbound", 2, 3),
    );
    expect(stopProgress("outbound", 2, 3)).toBeLessThan(0.5);
  });

  it("maps inbound stops from bottom to top along the return leg", () => {
    expect(stopProgress("inbound", 0, 2)).toBeLessThan(
      stopProgress("inbound", 1, 2),
    );
    expect(stopProgress("inbound", 0, 2)).toBeGreaterThan(0.5);
  });
});

describe("mapProgressToLoopCoordinates", () => {
  it("places top-half progress on the top line", () => {
    const point = mapProgressToLoopCoordinates(0.25);
    expect(point.y).toBe(130);
    expect(point.x).toBeGreaterThan(100);
    expect(point.x).toBeLessThan(900);
  });

  it("places outbound progress on the left side in portrait mode", () => {
    const mobileLayout = getLoopLayout(true, sampleRoute);
    const point = mapProgressToLoopCoordinates(0.25, mobileLayout);
    expect(point.x).toBe(mobileLayout.leftX);
    expect(point.y).toBeGreaterThan(mobileLayout.topY);
    expect(point.y).toBeLessThan(mobileLayout.bottomY);
  });
});

describe("estimateVehiclePositionOnRoute", () => {
  it("matches a prediction to an outbound stop index", () => {
    const estimate = estimateVehiclePositionOnRoute(
      samplePrediction,
      sampleRoute,
    );

    expect(estimate.matched).toBe(true);
    expect(estimate.direction).toBe("outbound");
    expect(estimate.stopIndex).toBe(1);
    expect(estimate.nextStop?.name).toBe("Stop B");
    expect(estimate.progress).toBeGreaterThan(0);
    expect(estimate.progress).toBeLessThan(0.5);
  });

  it("places inbound buses upstream of the predicted stop while still approaching", () => {
    const inboundPrediction: NormalizedVehiclePrediction = {
      ...samplePrediction,
      naptanId: "490000004D",
      stopName: "Stop D",
      direction: "inbound",
      timeToStation: 240,
    };

    const estimate = estimateVehiclePositionOnRoute(
      inboundPrediction,
      sampleRoute,
    );
    const stopProgressAtPrediction = stopProgress(
      "inbound",
      estimate.stopIndex,
      sampleRoute.inbound.length,
    );

    expect(estimate.direction).toBe("inbound");
    expect(estimate.progress).toBeLessThanOrEqual(stopProgressAtPrediction);
    expect(estimate.progress).toBeGreaterThanOrEqual(
      stopProgress("inbound", 0, sampleRoute.inbound.length),
    );
  });

  it("places outbound buses upstream of the predicted stop while still approaching", () => {
    const estimate = estimateVehiclePositionOnRoute(samplePrediction, sampleRoute);
    const stopProgressAtPrediction = stopProgress(
      "outbound",
      estimate.stopIndex,
      sampleRoute.outbound.length,
    );

    expect(estimate.progress).toBeLessThan(stopProgressAtPrediction);
  });
});

describe("vehicle grouping and positions", () => {
  it("groups predictions by vehicle and builds loop positions", () => {
    const predictions: NormalizedVehiclePrediction[] = [
      samplePrediction,
      {
        ...samplePrediction,
        id: "pred-2",
        timeToStation: 420,
        naptanId: "490000003C",
        stopName: "Stop C",
      },
      {
        ...samplePrediction,
        id: "pred-3",
        vehicleId: "BUS2",
        naptanId: "490000004D",
        stopName: "Stop D",
        direction: "inbound",
      },
    ];

    const grouped = groupPredictionsByVehicle(predictions);
    expect(grouped.size).toBe(2);

    const next = getVehicleNextPrediction(grouped.get("BUS1") ?? []);
    expect(next?.naptanId).toBe("490000002B");

    const positions = buildVehiclePositions(predictions, sampleRoute);
    expect(positions).toHaveLength(2);
    expect(positions.every((position) => position.matched)).toBe(true);
    expect(positions.every((position) => position.adherence)).toBe(true);
  });

  it("staggers overlapping first-stop markers along the portrait route line", () => {
    const mobileLayout = getLoopLayout(true, sampleRoute);
    const predictions: NormalizedVehiclePrediction[] = [
      {
        ...samplePrediction,
        id: "first-1",
        vehicleId: "BUS1",
        naptanId: "490000001A",
        stopName: "Stop A",
        timeToStation: 10,
      },
      {
        ...samplePrediction,
        id: "first-2",
        vehicleId: "BUS2",
        naptanId: "490000001A",
        stopName: "Stop A",
        timeToStation: 10,
      },
    ];

    const positions = buildVehiclePositions(
      predictions,
      sampleRoute,
      mobileLayout,
    );

    expect(positions).toHaveLength(2);
    expect(positions[0]?.x).toBe(mobileLayout.leftX);
    expect(positions[1]?.x).toBe(mobileLayout.leftX);
    expect(positions[1]?.y).toBeGreaterThan(positions[0]?.y ?? 0);
  });

  it("keeps overlapping last-stop markers inside the portrait route line", () => {
    const mobileLayout = getLoopLayout(true, sampleRoute);
    const predictions: NormalizedVehiclePrediction[] = [
      {
        ...samplePrediction,
        id: "last-1",
        vehicleId: "BUS1",
        naptanId: "490000003C",
        stopName: "Stop C",
        timeToStation: 10,
      },
      {
        ...samplePrediction,
        id: "last-2",
        vehicleId: "BUS2",
        naptanId: "490000003C",
        stopName: "Stop C",
        timeToStation: 10,
      },
    ];

    const positions = buildVehiclePositions(
      predictions,
      sampleRoute,
      mobileLayout,
    );

    expect(positions).toHaveLength(2);
    expect(positions[0]?.x).toBe(mobileLayout.leftX);
    expect(positions[1]?.x).toBe(mobileLayout.leftX);
    expect(positions[1]?.y).toBeLessThanOrEqual(mobileLayout.bottomY);
    expect(positions[1]?.y).toBeLessThan(positions[0]?.y ?? 0);
  });
});

describe("buildLoopStops", () => {
  it("labels terminals and periodic stops", () => {
    const layout = buildLoopStops(sampleRoute, 2);
    expect(layout.outbound[0]?.shouldLabel).toBe(true);
    expect(layout.outbound.at(-1)?.shouldLabel).toBe(true);
    expect(layout.inbound).toHaveLength(2);
  });
});

describe("buildLoopPath", () => {
  it("traces a rectangle in portrait mode instead of crossing diagonals", () => {
    const mobileLayout = getLoopLayout(true, sampleRoute);
    const endpoints = getLoopLegEndpoints(sampleRoute, mobileLayout);

    expect(endpoints.outboundStart.y).toBeLessThan(endpoints.outboundEnd.y);
    expect(endpoints.inboundStart.y).toBeGreaterThan(endpoints.inboundEnd.y);

    const path = buildLoopPath(sampleRoute, mobileLayout);
    expect(path).toContain(
      `${endpoints.outboundEnd.x} ${endpoints.outboundEnd.y} L ${endpoints.inboundStart.x} ${endpoints.inboundStart.y}`,
    );
    expect(path).toContain(
      `${endpoints.inboundStart.x} ${endpoints.inboundStart.y} L ${endpoints.inboundEnd.x} ${endpoints.inboundEnd.y}`,
    );
  });
});

describe("direction leg progress clamping", () => {
  it("clamps outbound progress to the outbound leg bounds", () => {
    const { min, max } = getDirectionLegProgressBounds("outbound", 3);
    expect(clampProgressToDirectionLeg(0.99, "outbound", 3)).toBeCloseTo(max);
    expect(clampProgressToDirectionLeg(0.01, "outbound", 3)).toBeCloseTo(min);
  });

  it("snaps final outbound stop progress to the terminus point", () => {
    const prediction: NormalizedVehiclePrediction = {
      ...samplePrediction,
      naptanId: "490000003C",
      stopName: "Stop C",
      timeToStation: 600,
    };

    const estimate = estimateVehiclePositionOnRoute(prediction, sampleRoute);
    const terminalProgress = stopProgress("outbound", 2, 3);

    expect(estimate.stopIndex).toBe(2);
    expect(estimate.progress).toBeCloseTo(terminalProgress);
    expect(estimate.progress).toBeLessThan(0.5);
  });

  it("does not let a bus at the final stop drift onto the inbound leg", () => {
    const prediction: NormalizedVehiclePrediction = {
      ...samplePrediction,
      naptanId: "490000003C",
      stopName: "Stop C",
      timeToStation: 900,
    };

    const estimate = estimateVehiclePositionOnRoute(prediction, sampleRoute);
    const { max } = getDirectionLegProgressBounds("outbound", 3);

    expect(estimate.progress).toBeLessThanOrEqual(max);
    expect(estimate.progress).toBeLessThan(0.5);
  });
});

describe("getLoopLayout", () => {
  it("expands mobile height for routes with many stops", () => {
    const longRoute: NormalizedRoute = {
      ...sampleRoute,
      outbound: Array.from({ length: 20 }, (_, index) => ({
        id: `${index}`,
        name: `Stop ${index}`,
        naptanId: `4900000${index}`,
        isTimingPoint: false,
      })),
    };
    const mobileLayout = getLoopLayout(true, longRoute);
    const defaultMobile = getLoopLayout(true, sampleRoute);
    expect(mobileLayout.viewBoxHeight).toBeGreaterThan(
      defaultMobile.viewBoxHeight,
    );
  });
});
