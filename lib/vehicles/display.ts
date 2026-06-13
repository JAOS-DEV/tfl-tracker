export function preferFleetDisplay(
  fleetCode: string | null | undefined,
  fleetNumber: string | null | number | undefined,
): string | null {
  const code = fleetCode?.trim() ?? "";
  const number =
    fleetNumber === null || fleetNumber === undefined
      ? ""
      : String(fleetNumber).trim();

  if (code && looksLikeOperatorFleetCode(code)) {
    return code;
  }

  if (code) {
    return code;
  }

  return number || null;
}

function looksLikeOperatorFleetCode(value: string): boolean {
  return /^[A-Z]{2,4}\d{1,4}$/i.test(value);
}
