import {
  getGhostMarkerIconText,
  isPossibleGhostBus,
  POSSIBLE_GHOST_SHORT_LABEL,
} from "@/lib/ghostDisplay";
import { isRouteMapMarkerFaded } from "@/lib/routeMapMarkerStyles";
import type { EstimatedVehiclePosition } from "@/lib/tfl/types";
import { resolveDisplayFleetNumber } from "@/lib/vehicleLabels";

export type MapVehicleTone =
  | "onTime"
  | "late"
  | "early"
  | "unknown"
  | "ghost"
  | "layover"
  | "stale";

function isStaleVehicle(vehicle: EstimatedVehiclePosition): boolean {
  return (
    vehicle.predictionConfidence === "stale" ||
    isRouteMapMarkerFaded(vehicle)
  );
}

function runningNumber(vehicle: EstimatedVehiclePosition): string | undefined {
  if (isPossibleGhostBus(vehicle)) {
    const ghostRun = getGhostMarkerIconText(vehicle);
    return ghostRun && ghostRun !== vehicle.routeNumber ? ghostRun : undefined;
  }

  return vehicle.ibusRunningNo ?? vehicle.scheduledGhostRunningNo ?? undefined;
}

export function getMapVehicleTone(
  vehicle: EstimatedVehiclePosition,
): MapVehicleTone {
  if (isPossibleGhostBus(vehicle)) {
    return "ghost";
  }

  if (vehicle.markerState === "terminus-layover") {
    return "layover";
  }

  if (isStaleVehicle(vehicle)) {
    return "stale";
  }

  if (vehicle.adherence === "onTime") {
    return "onTime";
  }
  if (vehicle.adherence === "late") {
    return "late";
  }
  if (vehicle.adherence === "early") {
    return "early";
  }

  return "unknown";
}

export function formatMapVehicleBadgeLabel(
  vehicle: EstimatedVehiclePosition,
): string {
  if (isPossibleGhostBus(vehicle)) {
    return "Ghost";
  }

  if (vehicle.markerState === "terminus-layover") {
    return "Layover";
  }

  if (isStaleVehicle(vehicle)) {
    return "Stale";
  }

  if (vehicle.scheduleStatus === "onTime") {
    return "On time";
  }

  if (
    vehicle.scheduleStatus === "late" &&
    vehicle.scheduleDeviationMinutes !== null
  ) {
    return `Late +${vehicle.scheduleDeviationMinutes}`;
  }

  if (
    vehicle.scheduleStatus === "early" &&
    vehicle.scheduleDeviationMinutes !== null
  ) {
    return `Early ${vehicle.scheduleDeviationMinutes}`;
  }

  if (vehicle.scheduleStatus === "late") {
    return "Late";
  }

  if (vehicle.scheduleStatus === "early") {
    return "Early";
  }

  return "Unknown";
}

export function formatMapVehicleTimingLabel(
  vehicle: EstimatedVehiclePosition,
): string {
  if (isPossibleGhostBus(vehicle)) {
    return (
      vehicle.scheduleExplanation ??
      vehicle.ghostReason ??
      "Scheduled but no matching live bus"
    );
  }

  if (vehicle.markerState === "terminus-layover") {
    return vehicle.terminusLayoverLabel ?? "Layover";
  }

  if (isStaleVehicle(vehicle)) {
    return "Stale";
  }

  if (
    vehicle.scheduleStatusLabel &&
    vehicle.scheduleStatusLabel !== "Schedule ?"
  ) {
    return vehicle.scheduleStatusLabel;
  }

  const badge = formatMapVehicleBadgeLabel(vehicle);
  return badge === "Unknown" ? "Unknown timing" : badge;
}

export function formatMapVehiclePrimaryLine(
  vehicle: EstimatedVehiclePosition,
): string {
  if (isPossibleGhostBus(vehicle)) {
    const run = runningNumber(vehicle);
    return run
      ? `${POSSIBLE_GHOST_SHORT_LABEL} · Run ${run}`
      : POSSIBLE_GHOST_SHORT_LABEL;
  }

  const parts: string[] = [];
  const run = runningNumber(vehicle);
  if (run) {
    parts.push(`Run ${run}`);
  }

  if (vehicle.vehicleRegistration) {
    parts.push(vehicle.vehicleRegistration);
  }

  const fleetNo = resolveDisplayFleetNumber(vehicle);
  if (fleetNo) {
    parts.push(`Fleet ${fleetNo}`);
  }

  return parts.length > 0 ? parts.join(" · ") : "Live bus";
}

export function formatMapVehicleStatusLine(
  vehicle: EstimatedVehiclePosition,
): string {
  if (isPossibleGhostBus(vehicle)) {
    return formatMapVehicleTimingLabel(vehicle);
  }

  const timing = formatMapVehicleTimingLabel(vehicle);
  const near =
    vehicle.matchedStopName ?? vehicle.nextStop?.name ?? undefined;

  return near ? `${timing} · near ${near}` : timing;
}

export function buildMapVehicleAriaLabel(
  vehicle: EstimatedVehiclePosition,
): string {
  if (isPossibleGhostBus(vehicle)) {
    const run = runningNumber(vehicle);
    const reason = formatMapVehicleTimingLabel(vehicle);
    return run
      ? `${POSSIBLE_GHOST_SHORT_LABEL}, run ${run}, ${reason}`
      : `${POSSIBLE_GHOST_SHORT_LABEL}, ${reason}`;
  }

  const parts: string[] = [];
  const run = runningNumber(vehicle);
  if (run) {
    parts.push(`Run ${run}`);
  }
  if (vehicle.vehicleRegistration) {
    parts.push(vehicle.vehicleRegistration);
  }
  const fleetNo = resolveDisplayFleetNumber(vehicle);
  if (fleetNo) {
    parts.push(`fleet ${fleetNo}`);
  }

  if (parts.length === 0) {
    parts.push("Live bus");
  }

  const tone = getMapVehicleTone(vehicle);
  if (tone === "layover") {
    parts.push(vehicle.terminusLayoverLabel ?? "layover");
  } else if (tone === "stale") {
    parts.push("stale");
  } else if (
    vehicle.scheduleStatus === "late" &&
    vehicle.scheduleDeviationMinutes !== null
  ) {
    parts.push(`late by ${vehicle.scheduleDeviationMinutes} minutes`);
  } else if (
    vehicle.scheduleStatus === "early" &&
    vehicle.scheduleDeviationMinutes !== null
  ) {
    parts.push(
      `early by ${Math.abs(vehicle.scheduleDeviationMinutes)} minutes`,
    );
  } else if (vehicle.scheduleStatus === "onTime") {
    parts.push("on time");
  } else {
    parts.push("unknown timing");
  }

  const near = vehicle.matchedStopName ?? vehicle.nextStop?.name;
  if (near) {
    parts.push(`near ${near}`);
  }

  return parts.join(", ");
}

export const MAP_VEHICLE_TONE_DOT_CLASS: Record<MapVehicleTone, string> = {
  onTime: "bg-emerald-500",
  late: "bg-rose-500",
  early: "bg-amber-500",
  unknown: "bg-sky-500",
  ghost: "bg-violet-400",
  layover: "bg-zinc-500",
  stale: "bg-zinc-400 opacity-70",
};

export const MAP_VEHICLE_TONE_BORDER_CLASS: Record<MapVehicleTone, string> = {
  onTime: "border-l-emerald-500",
  late: "border-l-rose-500",
  early: "border-l-amber-500",
  unknown: "border-l-sky-500",
  ghost: "border-l-violet-400",
  layover: "border-l-zinc-500",
  stale: "border-l-zinc-400",
};

export const MAP_VEHICLE_BADGE_CLASS: Record<MapVehicleTone, string> = {
  onTime:
    "bg-emerald-600 text-white dark:bg-emerald-500",
  late: "bg-rose-600 text-white dark:bg-rose-500",
  early: "bg-amber-500 text-white dark:bg-amber-400 dark:text-zinc-900",
  unknown:
    "bg-sky-600 text-white dark:bg-sky-500",
  ghost:
    "bg-violet-600 text-white dark:bg-violet-500",
  layover:
    "bg-zinc-500 text-white dark:bg-zinc-600",
  stale:
    "bg-zinc-300 text-zinc-800 dark:bg-zinc-700 dark:text-zinc-100",
};
