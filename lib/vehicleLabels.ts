export const RUNNING_NUMBER_LABEL = "Running number";
export const RUNNING_NUMBER_SHORT_LABEL = "Running no";

export const FLEET_NUMBER_LABEL = "Fleet number";
export const FLEET_NUMBER_SHORT_LABEL = "Fleet no";

export function formatRunningNumberLabel(
  value: string,
  options?: { short?: boolean },
): string {
  const prefix = options?.short
    ? RUNNING_NUMBER_SHORT_LABEL
    : RUNNING_NUMBER_LABEL;
  return `${prefix}: ${value}`;
}

export function formatFleetNumberLabel(
  value: string,
  options?: { short?: boolean },
): string {
  const prefix = options?.short ? FLEET_NUMBER_SHORT_LABEL : FLEET_NUMBER_LABEL;
  return `${prefix}: ${value}`;
}

export function resolveDisplayFleetNumber(
  vehicle: {
    ibusFleetNo?: string;
    vehicleFleetReference?: string;
  },
): string | undefined {
  return vehicle.ibusFleetNo ?? vehicle.vehicleFleetReference ?? undefined;
}
