const UK_CURRENT_STYLE =
  /^[A-HJ-PR-ST-WY]{2}\d{2}[A-HJ-PR-ST-WY]{3}$/;
const UK_PREFIX_STYLE =
  /^[A-HJ-PR-ST-WY]\d{1,3}[A-HJ-PR-ST-WY]{3}$/;
const UK_SUFFIX_STYLE =
  /^[A-HJ-PR-ST-WY]{1,3}\d{1,3}[A-HJ-PR-ST-WY]$/;

export function normalizeRegistration(value: string): string {
  return value.trim().replace(/\s+/g, "").toUpperCase();
}

export function isUkRegistrationPlate(value: string): boolean {
  const normalized = normalizeRegistration(value);
  if (!normalized || normalized.length < 5 || normalized.length > 8) {
    return false;
  }

  return (
    UK_CURRENT_STYLE.test(normalized) ||
    UK_PREFIX_STYLE.test(normalized) ||
    UK_SUFFIX_STYLE.test(normalized)
  );
}

export function extractVehicleRegistration(
  vehicleId?: string,
): string | undefined {
  if (!vehicleId) {
    return undefined;
  }

  const normalized = normalizeRegistration(vehicleId);
  if (!isUkRegistrationPlate(normalized)) {
    return undefined;
  }

  return normalized;
}
