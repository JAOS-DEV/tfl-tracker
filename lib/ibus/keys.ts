import { normalizeRegistration } from "@/lib/vehicles/registration";

export function normalizeIbusRegistration(value: string): string {
  return normalizeRegistration(value);
}

export function createRunningLookupKey(
  baseVersion: string,
  tripId: string,
): string {
  return `${baseVersion.trim()}:${tripId.trim()}`;
}

export function runningShardForTripId(tripId: string): string {
  const numeric = Number(tripId);
  if (Number.isFinite(numeric)) {
    return String(numeric % 256).padStart(3, "0");
  }

  let hash = 0;
  for (let index = 0; index < tripId.length; index += 1) {
    hash = (hash * 31 + tripId.charCodeAt(index)) % 256;
  }

  return String(hash).padStart(3, "0");
}

export function deriveGarageNoFromBlock(
  blockNo: string,
  runningNo: string,
  garageNoFromXml?: string | null,
): string | null {
  const garageFromXml = garageNoFromXml?.trim();
  if (garageFromXml) {
    return garageFromXml;
  }

  const block = blockNo.trim();
  const running = runningNo.trim();

  if (!block || !running) {
    return null;
  }

  if (/^\d{6}$/.test(block) && /^\d{3}$/.test(running)) {
    return block.slice(0, 3);
  }

  if (block.endsWith(running) && block.length > running.length) {
    return block.slice(0, -running.length);
  }

  return null;
}
