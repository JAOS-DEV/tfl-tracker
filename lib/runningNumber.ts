export function normalizeRunningNumber(
  value: string | number | null | undefined,
): string | undefined {
  if (value === null || value === undefined) {
    return undefined;
  }

  const text = String(value).trim();
  if (!text) {
    return undefined;
  }

  const withoutLeadingZeroes = text.replace(/^0+/, "");
  return withoutLeadingZeroes || "0";
}

export function runningNumbersMatch(
  left: string | number | null | undefined,
  right: string | number | null | undefined,
): boolean {
  const normalizedLeft = normalizeRunningNumber(left);
  const normalizedRight = normalizeRunningNumber(right);
  return Boolean(
    normalizedLeft && normalizedRight && normalizedLeft === normalizedRight,
  );
}
