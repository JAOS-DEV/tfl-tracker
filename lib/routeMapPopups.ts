import {
  buildLoopMarkerLabels,
  type LoopMarkerLabelSettings,
} from "@/components/LoopMarkerInfoBadges";
import {
  getGhostMarkerIconText,
  isPossibleGhostBus,
  POSSIBLE_GHOST_LABEL,
} from "@/lib/ghostDisplay";
import type { GeographicStop } from "@/lib/routeMapGeometry";
import type {
  EstimatedVehiclePosition,
  NormalizedRoute,
  RouteDirection,
} from "@/lib/tfl/types";
import {
  formatFleetNumberLabel,
  formatRunningNumberLabel,
  resolveDisplayFleetNumber,
} from "@/lib/vehicleLabels";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function popupTitle(text: string): string {
  return `<div class="route-map-popup-title"><strong>${text}</strong></div>`;
}

function popupRow(text: string): string {
  return `<div class="route-map-popup-row">${text}</div>`;
}

function buildTimingLine(vehicle: EstimatedVehiclePosition): string | null {
  if (isPossibleGhostBus(vehicle)) {
    return null;
  }

  if (
    vehicle.scheduleStatusLabel &&
    vehicle.scheduleStatusLabel !== "Schedule ?"
  ) {
    return vehicle.scheduleStatusLabel;
  }

  return null;
}

export function buildBusPopupHtml(
  vehicle: EstimatedVehiclePosition,
  loopLabelSettings: LoopMarkerLabelSettings,
): string {
  if (isPossibleGhostBus(vehicle)) {
    const run = getGhostMarkerIconText(vehicle);
    const reason =
      vehicle.scheduleExplanation ??
      vehicle.ghostReason ??
      "Scheduled but no matching live vehicle";

    const rows = [
      popupTitle(escapeHtml(POSSIBLE_GHOST_LABEL)),
      run ? popupRow(formatRunningNumberLabel(run)) : null,
      popupRow(`Reason: ${escapeHtml(reason)}`),
    ].filter(Boolean);

    return `<div class="route-map-bus-popup-content">${rows.join("")}</div>`;
  }

  const rows: string[] = [
    popupTitle(`Route ${escapeHtml(vehicle.routeNumber)}`),
  ];

  if (loopLabelSettings.showRegistration && vehicle.vehicleRegistration) {
    rows.push(popupRow(`Reg: ${escapeHtml(vehicle.vehicleRegistration)}`));
  }

  const fleetNo = resolveDisplayFleetNumber(vehicle);

  if (loopLabelSettings.showFleetNumber && fleetNo) {
    rows.push(popupRow(escapeHtml(formatFleetNumberLabel(fleetNo))));
  }

  const runningNo =
    vehicle.ibusRunningNo ?? vehicle.scheduledGhostRunningNo ?? undefined;

  if (loopLabelSettings.showRunningNumber && runningNo) {
    rows.push(popupRow(escapeHtml(formatRunningNumberLabel(runningNo))));
  }

  const timing = buildTimingLine(vehicle);
  if (timing) {
    rows.push(popupRow(escapeHtml(timing)));
  }

  if (vehicle.nextStop?.name) {
    rows.push(popupRow(`Next stop: ${escapeHtml(vehicle.nextStop.name)}`));
  }

  if (vehicle.destinationName) {
    rows.push(popupRow(`Towards ${escapeHtml(vehicle.destinationName)}`));
  }

  return `<div class="route-map-bus-popup-content">${rows.join("")}</div>`;
}

export function buildBusPopupWithActionHtml(
  vehicle: EstimatedVehiclePosition,
  loopLabelSettings: LoopMarkerLabelSettings,
): string {
  return `${buildBusPopupHtml(vehicle, loopLabelSettings)}<div class="route-map-leaflet-popup-action"><button type="button" data-vehicle-id="${escapeHtml(vehicle.vehicleId)}" data-vehicle-action="full-info" class="route-map-stop-action">Full info</button></div>`;
}

export function buildVehicleMapLabelHtml(
  vehicle: EstimatedVehiclePosition,
  loopLabelSettings: LoopMarkerLabelSettings,
): string {
  const labels = buildLoopMarkerLabels(vehicle, loopLabelSettings);
  const rows =
    labels.length > 0
      ? labels.map((label) => label.text)
      : [`Route ${vehicle.routeNumber}`];
  const inner = rows.map((row) => `<div>${escapeHtml(row)}</div>`).join("");

  return `<button type="button" class="route-map-vehicle-label-button" data-vehicle-popup-id="${escapeHtml(vehicle.vehicleId)}">${inner}</button>`;
}

export function buildStopMapLabelHtml(
  stop: Pick<GeographicStop, "name" | "naptanId">,
): string {
  return `<button type="button" class="route-map-stop-label-button" data-stop-popup-id="${escapeHtml(stop.naptanId)}">${escapeHtml(stop.name)}</button>`;
}

export function buildStopPopupHtml(
  stop: GeographicStop,
  route: NormalizedRoute,
  direction: RouteDirection,
): string {
  const terminus =
    direction === "outbound"
      ? route.outbound.at(-1)?.name
      : route.inbound.at(-1)?.name;

  const rows = [
    popupTitle(escapeHtml(stop.name)),
    stop.stopLetter ? popupRow(`Stop ${escapeHtml(stop.stopLetter)}`) : null,
    terminus ? popupRow(`Towards ${escapeHtml(terminus)}`) : null,
  ].filter(Boolean);

  return `<div class="route-map-stop-popup-content">${rows.join("")}</div>`;
}

export function buildStopPopupWithActionHtml(
  stop: GeographicStop,
  route: NormalizedRoute,
  direction: RouteDirection,
): string {
  return `${buildStopPopupHtml(stop, route, direction)}<div class="route-map-leaflet-popup-action"><button type="button" data-stop-naptan="${escapeHtml(stop.naptanId)}" data-stop-action="view-arrivals" class="route-map-stop-action">View arrivals</button></div>`;
}

export function buildBusAriaLabel(vehicle: EstimatedVehiclePosition): string {
  if (isPossibleGhostBus(vehicle)) {
    return `${POSSIBLE_GHOST_LABEL}, running number ${getGhostMarkerIconText(vehicle)}`;
  }

  const near = vehicle.nextStop?.name ?? "route";
  const timing = buildTimingLine(vehicle);

  return timing
    ? `Bus ${vehicle.routeNumber}, ${timing}, near ${near}`
    : `Bus ${vehicle.routeNumber}, near ${near}`;
}
