import type { StopDisruption, ValidityPeriod } from "@/lib/tfl/types";

const STOP_DISRUPTION_CHUNK_SIZE = 25;

interface RawDisruptedPoint {
  atcoCode?: string;
  fromDate?: string;
  toDate?: string;
  description?: string;
  commonName?: string;
  type?: string;
  mode?: string;
  appearance?: string;
}

export function cleanDisruptionText(text: string): string {
  return text
    .replace(/\\n/g, "\n")
    .replace(/\s+\n/g, "\n")
    .replace(/\n\s+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function formatDisruptionPeriod(
  fromDate?: string,
  toDate?: string,
): string | null {
  const from = fromDate ? new Date(fromDate) : null;
  const to = toDate ? new Date(toDate) : null;

  if (
    (from && Number.isNaN(from.getTime())) ||
    (to && Number.isNaN(to.getTime()))
  ) {
    return null;
  }

  const formatOptions: Intl.DateTimeFormatOptions = {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  };

  if (from && to) {
    return `${from.toLocaleString(undefined, formatOptions)} – ${to.toLocaleString(undefined, formatOptions)}`;
  }

  if (to) {
    return `Until ${to.toLocaleString(undefined, formatOptions)}`;
  }

  if (from) {
    return `From ${from.toLocaleString(undefined, formatOptions)}`;
  }

  return null;
}

export function formatValidityPeriods(periods: ValidityPeriod[]): string | null {
  const formatted = periods
    .map((period) => formatDisruptionPeriod(period.fromDate, period.toDate))
    .filter((value): value is string => Boolean(value));

  return formatted.length > 0 ? formatted.join(" · ") : null;
}

export function normalizeStopDisruption(raw: RawDisruptedPoint): StopDisruption | null {
  const naptanId = raw.atcoCode?.trim();
  if (!naptanId) {
    return null;
  }

  const description = raw.description
    ? cleanDisruptionText(raw.description)
    : "This stop is currently closed.";

  return {
    naptanId,
    stopName: raw.commonName?.trim() || naptanId,
    type: raw.type?.trim() || "Closure",
    description,
    fromDate: raw.fromDate,
    toDate: raw.toDate,
    appearance: raw.appearance,
  };
}

export function normalizeStopDisruptions(raw: unknown): StopDisruption[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  const seen = new Set<string>();
  const results: StopDisruption[] = [];

  for (const item of raw) {
    const disruption = normalizeStopDisruption(item as RawDisruptedPoint);
    if (!disruption || seen.has(disruption.naptanId)) {
      continue;
    }

    seen.add(disruption.naptanId);
    results.push(disruption);
  }

  return results;
}

export function indexStopDisruptions(
  disruptions: StopDisruption[],
): Map<string, StopDisruption> {
  return new Map(disruptions.map((disruption) => [disruption.naptanId, disruption]));
}

export function chunkStopPointIds(stopPointIds: string[]): string[][] {
  const uniqueIds = [...new Set(stopPointIds.map((id) => id.trim()).filter(Boolean))];
  const chunks: string[][] = [];

  for (let index = 0; index < uniqueIds.length; index += STOP_DISRUPTION_CHUNK_SIZE) {
    chunks.push(uniqueIds.slice(index, index + STOP_DISRUPTION_CHUNK_SIZE));
  }

  return chunks;
}

export async function fetchStopDisruptionsForIds(
  stopPointIds: string[],
  fetchChunk: (ids: string[]) => Promise<unknown>,
): Promise<StopDisruption[]> {
  const chunks = chunkStopPointIds(stopPointIds);
  if (chunks.length === 0) {
    return [];
  }

  const responses = await Promise.all(chunks.map((chunk) => fetchChunk(chunk)));
  return normalizeStopDisruptions(responses.flat());
}
