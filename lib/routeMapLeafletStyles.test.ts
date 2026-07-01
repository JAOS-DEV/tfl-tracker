import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildBusMarkerHtml,
  buildDirectionArrowHtml,
  getMapVehicleBadge,
} from "@/lib/routeMapLeafletStyles";

describe("routeMapLeafletStyles", () => {
  it("keeps hidden map labels measurable for left-side Leaflet placement", () => {
    const globalStyles = readFileSync(
      resolve(process.cwd(), "app/globals.css"),
      "utf8",
    );

    expect(globalStyles).toContain(
      `.route-map-stop-label,\n.route-map-vehicle-label {\n  visibility: hidden;`,
    );
    expect(globalStyles).toContain(
      `.route-map-show-vehicle-labels .route-map-vehicle-label {\n  visibility: visible;`,
    );
    expect(globalStyles).toContain(
      `.route-map-leaflet-container .leaflet-tooltip-pane {\n  z-index: 590;`,
    );
  });

  it("renders the Loop-style bus pictogram inside a live map marker", () => {
    const html = buildBusMarkerHtml(
      "22",
      { fill: "transparent", stroke: "#ef4444" },
      1,
    );

    expect(html).toContain("route-map-bus-pictogram");
    expect(html).toContain("<svg");
    expect(html).toContain(">22</text>");
  });

  it("escapes route labels embedded in marker HTML", () => {
    const html = buildBusMarkerHtml(
      '<script>alert("x")</script>',
      { fill: "transparent", stroke: "#0ea5e9" },
      1,
    );

    expect(html).not.toContain("<script>");
  });

  it("rotates a direction chevron to the supplied bearing", () => {
    const html = buildDirectionArrowHtml(92);

    expect(html).toContain("rotate(92deg)");
    expect(html).toContain("<svg");
    expect(html).not.toContain(">▲<");
  });

  it("uses the Loop timing labels for map marker badges", () => {
    expect(
      getMapVehicleBadge({
        scheduleStatus: "early",
        scheduleDeviationMinutes: -4,
        scheduleMatchConfidence: "high",
      } as never),
    ).toEqual({ label: "-4", variant: "early" });
    expect(
      getMapVehicleBadge({
        scheduleStatus: "onTime",
        scheduleDeviationMinutes: 0,
        scheduleMatchConfidence: "high",
      } as never),
    ).toEqual({ label: "OK", variant: "onTime" });
  });

  it("renders waiting and ghost map badges", () => {
    expect(
      getMapVehicleBadge({ markerState: "terminus-layover" } as never),
    ).toEqual({ label: "Waiting", variant: "waiting" });
    expect(
      getMapVehicleBadge({ isScheduledGhostCandidate: true } as never),
    ).toEqual({ label: "Ghost", variant: "ghost" });
  });
});
