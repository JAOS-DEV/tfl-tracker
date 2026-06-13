import { describe, expect, it } from "vitest";
import { LOOP_LAYOUT, LOOP_LAYOUT_MOBILE_BASE } from "@/lib/constants";
import {
  getBusMarkerCenterY,
  getBusMarkerGroupOffsetY,
  getLoopInfoBadgePlacement,
  getRouteBadgeCenter,
  isTerminusConnectorMarker,
  measureLoopInfoBadgeHeight,
} from "@/lib/loopMarkerLayout";

const portraitLayout = {
  viewBoxWidth: 520,
  viewBoxHeight: 400,
  leftX: 178,
  rightX: 342,
  topY: 72,
  bottomY: 320,
  orientation: "portrait" as const,
};

describe("loopMarkerLayout", () => {
  it("places loop labels centered below the bus marker", () => {
    const placement = getLoopInfoBadgePlacement(40);

    expect(placement).toEqual({
      anchorX: 20,
      anchorY: 44,
      align: "center",
    });
  });

  it("uses the same below-center placement for inbound buses", () => {
    const placement = getLoopInfoBadgePlacement(40);

    expect(placement.align).toBe("center");
    expect(placement.anchorY).toBeGreaterThan(40);
  });

  it("lifts the portrait route badge above the top connector", () => {
    const badge = getRouteBadgeCenter(
      {
        ...portraitLayout,
        topY: LOOP_LAYOUT_MOBILE_BASE.topY,
      },
      true,
    );

    expect(badge.y).toBeLessThan(LOOP_LAYOUT_MOBILE_BASE.topY);
    expect(badge.x).toBe(260);
  });

  it("keeps the landscape route badge in the loop centre", () => {
    const badge = getRouteBadgeCenter(LOOP_LAYOUT, false);

    expect(badge).toEqual({ x: 500, y: 260 });
  });

  it("uses the status-badge offset for buses on vertical legs", () => {
    expect(getBusMarkerGroupOffsetY()).toBe(-8);
  });

  it("centres waiting buses directly on horizontal connectors", () => {
    expect(getBusMarkerGroupOffsetY({ alignToConnector: true })).toBe(0);
    expect(getBusMarkerCenterY(320, true)).toBe(320);
  });

  it("detects portrait terminus markers on top and bottom connectors", () => {
    expect(
      isTerminusConnectorMarker(
        {
          markerState: "terminus-layover",
          terminusLayoverKind: "leg-end",
        },
      ),
    ).toBe(true);
  });

  it("sizes stacked badge cards from label count", () => {
    expect(measureLoopInfoBadgeHeight(3)).toBeGreaterThan(
      measureLoopInfoBadgeHeight(1),
    );
  });
});
