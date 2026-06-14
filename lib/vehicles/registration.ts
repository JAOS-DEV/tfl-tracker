const UK_CURRENT_STYLE = /^[A-Z]{2}\d{2}[A-Z]{3}$/;
const UK_PREFIX_STYLE = /^[A-Z]\d{1,3}[A-Z]{3}$/;
const UK_SUFFIX_STYLE = /^[A-Z]{1,3}\d{1,3}[A-Z]$/;
const FLEET_REFERENCE_PATTERN = /^[A-Z]{2,4}\d{1,4}$/;

const NULL_LIKE_VALUES = new Set([
  "",
  "UNKNOWN",
  "NULL",
  "N/A",
  "NA",
  "NONE",
]);

export function normalizeRegistration(value: string): string {
  return value.trim().replace(/\s+/g, "").toUpperCase();
}

function isNullLikeRegistration(value: string): boolean {
  return NULL_LIKE_VALUES.has(value);
}

function isNumericOnly(value: string): boolean {
  return /^\d+$/.test(value);
}

function looksLikeFleetReference(value: string): boolean {
  return (
    FLEET_REFERENCE_PATTERN.test(value) &&
    value.length >= 4 &&
    value.length <= 8
  );
}

function matchesUkRegistrationShape(value: string): boolean {
  return (
    UK_CURRENT_STYLE.test(value) ||
    UK_PREFIX_STYLE.test(value) ||
    UK_SUFFIX_STYLE.test(value)
  );
}

export function normalizeUkRegistrationCandidate(
  value: string,
): string | undefined {
  const normalized = normalizeRegistration(value);
  if (
    !normalized ||
    normalized.length < 5 ||
    normalized.length > 8 ||
    isNullLikeRegistration(normalized) ||
    isNumericOnly(normalized)
  ) {
    return undefined;
  }

  if (looksLikeFleetReference(normalized)) {
    return undefined;
  }

  if (!matchesUkRegistrationShape(normalized)) {
    return undefined;
  }

  return normalized;
}

export function isUkRegistrationPlate(value: string): boolean {
  return normalizeUkRegistrationCandidate(value) !== undefined;
}

export function extractVehicleRegistration(
  vehicleId?: string,
): string | undefined {
  if (!vehicleId) {
    return undefined;
  }

  return normalizeUkRegistrationCandidate(vehicleId);
}
