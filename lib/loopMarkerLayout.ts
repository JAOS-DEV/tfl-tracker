import type { LoopLayoutConfig } from "@/lib/constants";
import type { EstimatedVehiclePosition } from "@/lib/tfl/types";

export const BUS_MARKER_STATUS_OFFSET_Y = 8;

export type LoopInfoBadgeAlign = "left" | "right" | "center";

export interface LoopInfoBadgePlacement {
  anchorX: number;
  anchorY: number;
  align: LoopInfoBadgeAlign;
}

export interface LoopInfoBadgeMetrics {
  rowHeight: number;
  rowGap: number;
  paddingX: number;
  paddingY: number;
  fontSize: number;
  minWidth: number;
  charWidth: number;
}

export const LOOP_INFO_BADGE_METRICS: LoopInfoBadgeMetrics = {
  rowHeight: 12,
  rowGap: 1,
  paddingX: 7,
  paddingY: 5,
  fontSize: 8.5,
  minWidth: 78,
  charWidth: 5.2,
};

export function measureLoopInfoBadgeWidth(
  labels: Array<{ text: string }>,
  metrics: LoopInfoBadgeMetrics = LOOP_INFO_BADGE_METRICS,
): number {
  if (labels.length === 0) {
    return 0;
  }

  const widestLabel = Math.max(
    ...labels.map((label) => label.text.length * metrics.charWidth),
  );
  return Math.max(metrics.minWidth, widestLabel + metrics.paddingX * 2);
}

export function measureLoopInfoBadgeHeight(
  labelCount: number,
  metrics: LoopInfoBadgeMetrics = LOOP_INFO_BADGE_METRICS,
): number {
  if (labelCount <= 0) {
    return 0;
  }

  return (
    metrics.paddingY * 2 +
    labelCount * metrics.rowHeight +
    (labelCount - 1) * metrics.rowGap
  );
}

export function getLoopInfoBadgePlacement(
  markerSize: number,
): LoopInfoBadgePlacement {
  return {
    anchorX: markerSize / 2,
    anchorY: markerSize + 4,
    align: "center",
  };
}

export function isTerminusConnectorMarker(
  vehicle: Pick<
    EstimatedVehiclePosition,
    "markerState" | "terminusLayoverKind"
  >,
): boolean {
  return (
    vehicle.markerState === "terminus-layover" &&
    Boolean(vehicle.terminusLayoverKind)
  );
}

export function getBusMarkerGroupOffsetY(
  options?: { alignToConnector?: boolean },
): number {
  if (options?.alignToConnector) {
    return 0;
  }

  return -BUS_MARKER_STATUS_OFFSET_Y;
}

export function getBusMarkerCenterY(
  pathY: number,
  alignToConnector = false,
): number {
  return pathY + getBusMarkerGroupOffsetY({ alignToConnector });
}

export function getRouteBadgeCenter(
  layout: LoopLayoutConfig,
  isMobile: boolean,
): { x: number; y: number } {
  if (layout.orientation === "portrait") {
    const lift = isMobile ? 36 : 30;
    return {
      x: layout.viewBoxWidth / 2,
      y: layout.topY - lift,
    };
  }

  return {
    x: layout.viewBoxWidth / 2,
    y: (layout.topY + layout.bottomY) / 2,
  };
}
