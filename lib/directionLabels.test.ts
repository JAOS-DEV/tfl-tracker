import { describe, expect, it } from "vitest";
import {
  getHeaderDestinationLabel,
  getLoopHeaderDestinationLabel,
  getLoopHeaderTermini,
  getRouteCardHeaderLabel,
  getShortDirectionLabel,
} from "@/lib/directionLabels";
import type { NormalizedRoute } from "@/lib/tfl/types";

const route: NormalizedRoute = {
  routeId: "337",
  routeName: "337",
  outbound: [
    {
      id: "1",
      naptanId: "1",
      name: "Northcote Road",
      towards: "Richmond",
      isTimingPoint: true,
    },
    {
      id: "2",
      naptanId: "2",
      name: "Richmond Bus Station",
      towards: "Northcote",
      isTimingPoint: true,
    },
  ],
  inbound: [
    {
      id: "2",
      naptanId: "2",
      name: "Richmond Bus Station",
      towards: "Northcote",
      isTimingPoint: true,
    },
    {
      id: "1",
      naptanId: "1",
      name: "Northcote Road",
      towards: "Richmond",
      isTimingPoint: true,
    },
  ],
};

describe("directionLabels", () => {
  it("uses short mobile labels for list view", () => {
    expect(getShortDirectionLabel(route, "outbound", "mobile")).toBe(
      "To Richmond Bus Station",
    );
    expect(getShortDirectionLabel(route, "inbound", "mobile")).toBe(
      "To Northcote Road",
    );
  });

  it("uses full desktop labels for list view", () => {
    expect(getHeaderDestinationLabel(route, "outbound", "desktop")).toBe(
      "Towards Richmond Bus Station",
    );
  });

  it("exposes loop header termini separately", () => {
    expect(getLoopHeaderTermini(route)).toEqual({
      outboundTerminus: "Richmond Bus Station",
      inboundTerminus: "Northcote Road",
      isSame: false,
    });
  });

  it("shows both termini in loop view header labels", () => {
    expect(getLoopHeaderDestinationLabel(route, "mobile")).toBe(
      "Richmond Bus Station ↔ Northcote Road",
    );
    expect(getLoopHeaderDestinationLabel(route, "desktop")).toBe(
      "Route loop · Richmond Bus Station ↔ Northcote Road",
    );
  });

  it("uses loop label in loop view and direction label in list view", () => {
    expect(
      getRouteCardHeaderLabel(route, {
        visualMode: "loop",
        selectedDirection: "outbound",
        variant: "mobile",
      }),
    ).toBe("Richmond Bus Station ↔ Northcote Road");

    expect(
      getRouteCardHeaderLabel(route, {
        visualMode: "list",
        selectedDirection: "inbound",
        variant: "mobile",
      }),
    ).toBe("To Northcote Road");
  });
});
