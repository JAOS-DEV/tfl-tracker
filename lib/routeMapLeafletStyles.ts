import { isPossibleGhostBus } from "@/lib/ghostDisplay";
import { scheduleLoopBadgeLabel } from "@/lib/scheduleDeviation";
import type { EstimatedVehiclePosition } from "@/lib/tfl/types";
import { isRouteMapMarkerFaded } from "@/lib/routeMapMarkerStyles";

export interface LeafletMarkerColors {
  fill: string;
  stroke: string;
  dashed?: boolean;
}

const adherenceColors: Record<
  EstimatedVehiclePosition["adherence"],
  LeafletMarkerColors
> = {
  onTime: { fill: "rgba(16, 185, 129, 0.25)", stroke: "#10b981" },
  late: { fill: "rgba(239, 68, 68, 0.25)", stroke: "#ef4444" },
  early: { fill: "rgba(251, 191, 36, 0.3)", stroke: "#f59e0b" },
  unknown: { fill: "rgba(14, 165, 233, 0.2)", stroke: "#0ea5e9" },
};

const ghostColors: LeafletMarkerColors = {
  fill: "rgba(167, 139, 250, 0.15)",
  stroke: "#a78bfa",
  dashed: true,
};

const terminusColors: LeafletMarkerColors = {
  fill: "rgba(161, 161, 170, 0.2)",
  stroke: "#71717a",
  dashed: true,
};

export function getLeafletMarkerColors(
  vehicle: EstimatedVehiclePosition,
): LeafletMarkerColors {
  if (isPossibleGhostBus(vehicle)) {
    return ghostColors;
  }

  if (vehicle.markerState === "terminus-layover") {
    return terminusColors;
  }

  return adherenceColors[vehicle.adherence];
}

export function getLeafletMarkerOpacity(
  vehicle: EstimatedVehiclePosition,
): number {
  return isRouteMapMarkerFaded(vehicle) ? 0.65 : 1;
}

export interface MapVehicleBadge {
  label: string;
  variant: "onTime" | "early" | "late" | "waiting" | "ghost";
}

export function getMapVehicleBadge(
  vehicle: EstimatedVehiclePosition,
): MapVehicleBadge | null {
  if (isPossibleGhostBus(vehicle)) {
    return { label: "Ghost", variant: "ghost" };
  }
  if (vehicle.markerState === "terminus-layover") {
    return { label: "Waiting", variant: "waiting" };
  }
  if (vehicle.scheduleStatus === "unknown") {
    return null;
  }

  const label = scheduleLoopBadgeLabel(
    vehicle.scheduleStatus,
    vehicle.scheduleDeviationMinutes,
    vehicle.scheduleMatchConfidence,
  );
  return label ? { label, variant: vehicle.scheduleStatus } : null;
}

export function buildBusMarkerHtml(
  label: string,
  colors: LeafletMarkerColors,
  opacity: number,
  badge: MapVehicleBadge | null = null,
): string {
  const borderStyle = colors.dashed ? "dashed" : "solid";
  const escapedLabel = label
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
  const routeLabel = label.length <= 4 ? escapedLabel : "";
  const bodyColor = colors.dashed ? "#9ca3af" : "#dc2626";
  const roofColor = colors.dashed ? "#6b7280" : "#b91c1c";
  const badgeHtml = badge
    ? `<span class="route-map-marker-badge route-map-marker-badge-${badge.variant}">${badge.label}</span>`
    : "";

  return `<div class="route-map-leaflet-bus-marker" style="opacity:${opacity};background:${colors.fill};border:2px ${borderStyle} ${colors.stroke};"><svg class="route-map-bus-pictogram" viewBox="0 0 32 32" aria-hidden="true"><rect x="4" y="8" width="24" height="16" rx="3" fill="${bodyColor}"/><rect x="6" y="10" width="8" height="6" rx="1" fill="#fee2e2"/><rect x="18" y="10" width="8" height="6" rx="1" fill="#fee2e2"/><circle cx="10" cy="26" r="3" fill="#1f2937"/><circle cx="22" cy="26" r="3" fill="#1f2937"/><rect x="14" y="6" width="4" height="3" rx="1" fill="${roofColor}"/>${routeLabel ? `<text x="16" y="19" text-anchor="middle" font-size="7" font-weight="700" fill="#fff" font-family="Arial, sans-serif">${routeLabel}</text>` : ""}</svg>${badgeHtml}</div>`;
}

export function buildDirectionArrowHtml(bearing: number): string {
  const safeBearing = Number.isFinite(bearing) ? Math.round(bearing) : 0;
  return `<div class="route-map-direction-arrow" style="transform:rotate(${safeBearing}deg)" aria-hidden="true"><svg viewBox="0 0 20 20"><path d="M4 12 L10 6 L16 12" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg></div>`;
}

export function buildStopMarkerHtml(isTerminal: boolean): string {
  const size = isTerminal ? 10 : 7;
  const border = isTerminal ? "2px solid #ffffff" : "1.5px solid #71717a";

  return `<div class="route-map-leaflet-stop-marker" style="width:${size}px;height:${size}px;border:${border};"></div>`;
}
