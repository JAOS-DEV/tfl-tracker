import type { EstimatedVehiclePosition } from "@/lib/tfl/types";
import type { LiveIbusRunningDetail } from "@/lib/ibusLookup";

export function enrichLiveVehicles(
  vehicles: EstimatedVehiclePosition[],
  details: Map<string, LiveIbusRunningDetail> | undefined,
): EstimatedVehiclePosition[] {
  if (!details || details.size === 0) {
    return vehicles;
  }

  return vehicles.map((vehicle) => {
    const detail = details.get(vehicle.vehicleId);
    if (!detail) {
      return vehicle;
    }

    return {
      ...vehicle,
      ...(detail.runningNo ? { ibusRunningNo: detail.runningNo } : {}),
      ...(detail.blockNo ? { ibusBlockNo: detail.blockNo } : {}),
      ...(detail.fleetNo ? { ibusFleetNo: detail.fleetNo } : {}),
      ...(detail.registration && !vehicle.vehicleRegistration
        ? {
            vehicleRegistration: detail.registration,
            vehicleRegistrationSource: detail.registrationSource,
          }
        : {}),
      ...(vehicle.vehicleRegistration && !vehicle.vehicleRegistrationSource
        ? { vehicleRegistrationSource: "live-tfl-prediction" as const }
        : {}),
    };
  });
}
