import { describe, expect, it } from "vitest";
import { getLoopLayout } from "@/lib/constants";
import { groupPredictionsByVehicle } from "@/lib/tfl/normalizers";
import {
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

  it("maps inbound stops from right to left along the bottom half", () => {
    expect(stopProgress("inbound", 0, 2)).toBeGreaterThan(
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
    expect(endpoints.inboundStart.y).toBeLessThan(endpoints.inboundEnd.y);

    const path = buildLoopPath(sampleRoute, mobileLayout);
    expect(path).toContain(
      `${endpoints.outboundEnd.x} ${endpoints.outboundEnd.y} L ${endpoints.inboundEnd.x} ${endpoints.inboundEnd.y}`,
    );
    expect(path).not.toContain(
      `${endpoints.outboundEnd.x} ${endpoints.outboundEnd.y} L ${endpoints.inboundStart.x} ${endpoints.inboundStart.y}`,
    );
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
