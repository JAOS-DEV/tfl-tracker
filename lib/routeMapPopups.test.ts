import { describe, expect, it } from "vitest";
import {
  buildBusPopupHtml,
  buildBusPopupWithActionHtml,
  buildStopMapLabelHtml,
  buildStopPopupHtml,
  buildVehicleMapLabelHtml,
} from "@/lib/routeMapPopups";
import type { EstimatedVehiclePosition } from "@/lib/tfl/types";

const loopLabelSettings = {
  showRegistration: true,
  showFleetNumber: true,
  showRunningNumber: true,
};

function vehicle(
  overrides: Partial<EstimatedVehiclePosition> = {},
): EstimatedVehiclePosition {
  return {
    vehicleId: "337-562",
    routeNumber: "337",
    direction: "outbound",
    progress: 0.4,
    adherence: "onTime",
    markerState: "live",
    ghostStatus: "none",
    matched: true,
    missedRefreshCount: 0,
    scheduleStatus: "onTime",
    scheduleStatusLabel: "On time",
    scheduleDeviationMinutes: 0,
    destinationName: "Richmond Bus Station",
    vehicleRegistration: "LV24EUK",
    ibusFleetNo: "3051",
    ibusRunningNo: "562",
    nextStop: { name: "Kings Road", naptanId: "490000001A" },
    ...overrides,
  } as EstimatedVehiclePosition;
}

describe("routeMapPopups", () => {
  it("builds a compact live bus popup from available fields", () => {
    const html = buildBusPopupHtml(vehicle(), loopLabelSettings);

    expect(html).toContain("Route 337");
    expect(html).toContain("Reg: LV24EUK");
    expect(html).toContain("Fleet number: 3051");
    expect(html).toContain("Running number: 562");
    expect(html).toContain("On time");
    expect(html).toContain("Next stop: Kings Road");
    expect(html).toContain("Towards Richmond Bus Station");
    expect(html).toContain("route-map-bus-popup-content");
  });

  it("formats late buses with signed minute labels", () => {
    const html = buildBusPopupHtml(
      vehicle({ scheduleStatusLabel: "+6 late", scheduleStatus: "late" }),
      loopLabelSettings,
    );

    expect(html).toContain("+6 late");
  });

  it("builds ghost bus popup wording", () => {
    const html = buildBusPopupHtml(
      vehicle({
        vehicleId: "ghost-563",
        isScheduledGhostCandidate: true,
        scheduledGhostRunningNo: "563",
        ghostReason: "Scheduled but no matching live vehicle",
      }),
      loopLabelSettings,
    );

    expect(html).toContain("Possible ghost bus");
    expect(html).toContain("Running number: 563");
    expect(html).toContain("Scheduled but no matching live vehicle");
  });

  it("adds a full-info action styled like stop arrivals", () => {
    const html = buildBusPopupWithActionHtml(vehicle(), loopLabelSettings);

    expect(html).toContain("Full info");
    expect(html).toContain('data-vehicle-id="337-562"');
    expect(html).toContain('data-vehicle-action="full-info"');
    expect(html).toContain('class="route-map-stop-action"');
  });

  it("builds escaped compact labels for vehicles and stops", () => {
    const vehicleLabel = buildVehicleMapLabelHtml(vehicle(), loopLabelSettings);
    expect(vehicleLabel).toContain("<div>Reg: LV24EUK</div>");
    expect(vehicleLabel).toContain("<div>Fleet no: 3051</div>");
    expect(vehicleLabel).toContain("<div>Running no: 562</div>");
    expect(vehicleLabel).toContain('data-vehicle-popup-id="337-562"');
    expect(vehicleLabel).toContain("<button");

    const stopLabel = buildStopMapLabelHtml({
      name: "King's <Road>",
      naptanId: "stop-1",
    } as never);
    expect(stopLabel).toContain("King&#39;s &lt;Road&gt;");
    expect(stopLabel).toContain('data-stop-popup-id="stop-1"');
    expect(stopLabel).toContain("<button");
  });

  it("builds stop popup with name and stop code", () => {
    const html = buildStopPopupHtml(
      {
        id: "1",
        name: "Northcote Road",
        naptanId: "74123",
        stopLetter: "V",
        lat: 51.46,
        lon: -0.21,
        isTimingPoint: false,
      },
      {
        routeId: "337",
        routeName: "337",
        outbound: [
          {
            id: "1",
            name: "Northcote Road",
            naptanId: "74123",
            isTimingPoint: false,
          },
          {
            id: "2",
            name: "Richmond Bus Station",
            naptanId: "490000002B",
            isTimingPoint: false,
          },
        ],
        inbound: [],
      },
      "outbound",
    );

    expect(html).toContain("Northcote Road");
    expect(html).toContain("Stop V");
    expect(html).not.toContain("74123");
    expect(html).toContain("Towards Richmond Bus Station");
  });

  it("does not expose a long NaPTAN id when no passenger stop letter exists", () => {
    const html = buildStopPopupHtml(
      {
        id: "1",
        name: "Northcote Road",
        naptanId: "490000001A",
        lat: 51.46,
        lon: -0.21,
        isTimingPoint: false,
      },
      {
        routeId: "337",
        routeName: "337",
        outbound: [],
        inbound: [],
      },
      "outbound",
    );

    expect(html).not.toContain("490000001A");
    expect(html).not.toContain("Stop code");
  });
});
