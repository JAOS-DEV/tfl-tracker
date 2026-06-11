import { SCHEDULE_ADHERENCE_THRESHOLDS } from "@/lib/constants";
import type {
  EstimatedVehiclePosition,
  ScheduleAdherence,
} from "@/lib/tfl/types";

function compareToPeer(
  vehicle: EstimatedVehiclePosition,
  peer: EstimatedVehiclePosition,
): ScheduleAdherence | null {
  const stopGap = peer.stopIndex - vehicle.stopIndex;
  if (stopGap === 0) {
    if (
      vehicle.timeToStation >
      peer.timeToStation + SCHEDULE_ADHERENCE_THRESHOLDS.lateSeconds
    ) {
      return "late";
    }
    if (
      vehicle.timeToStation <
      peer.timeToStation - SCHEDULE_ADHERENCE_THRESHOLDS.earlySeconds
    ) {
      return "early";
    }
    return "onTime";
  }

  const expectedVehicleTime =
    peer.timeToStation +
    stopGap * SCHEDULE_ADHERENCE_THRESHOLDS.secondsPerStopEstimate;
  const delta = expectedVehicleTime - vehicle.timeToStation;

  if (delta < -SCHEDULE_ADHERENCE_THRESHOLDS.lateSeconds) {
    return "late";
  }

  if (delta > SCHEDULE_ADHERENCE_THRESHOLDS.earlySeconds) {
    return "early";
  }

  return "onTime";
}

export function estimateScheduleAdherence(
  vehicle: EstimatedVehiclePosition,
  allVehicles: EstimatedVehiclePosition[],
): ScheduleAdherence {
  if (!vehicle.matched) {
    return "onTime";
  }

  const peers = allVehicles.filter(
    (candidate) =>
      candidate.matched &&
      candidate.direction === vehicle.direction &&
      candidate.vehicleId !== vehicle.vehicleId,
  );

  if (peers.length === 0) {
    return "onTime";
  }

  let lateCount = 0;
  let earlyCount = 0;
  let onTimeCount = 0;

  for (const peer of peers) {
    const result = compareToPeer(vehicle, peer);
    if (!result) {
      continue;
    }
    if (result === "late") {
      lateCount += 1;
    } else if (result === "early") {
      earlyCount += 1;
    } else {
      onTimeCount += 1;
    }
  }

  if (lateCount > earlyCount && lateCount >= onTimeCount) {
    return "late";
  }
  if (earlyCount > lateCount && earlyCount >= onTimeCount) {
    return "early";
  }
  return "onTime";
}

export function applyScheduleAdherence(
  vehicles: EstimatedVehiclePosition[],
): EstimatedVehiclePosition[] {
  return vehicles.map((vehicle) => ({
    ...vehicle,
    adherence: estimateScheduleAdherence(vehicle, vehicles),
  }));
}

export function adherenceLabel(adherence: ScheduleAdherence): string {
  switch (adherence) {
    case "late":
      return "Running late (estimated)";
    case "early":
      return "Running early (estimated)";
    default:
      return "On time (estimated)";
  }
}
