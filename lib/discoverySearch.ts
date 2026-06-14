import type { LineSearchResult } from "@/lib/tfl/types";

const ROUTE_NUMBER_PATTERN = /^[Nn]?\d{1,4}[A-Za-z]?$/;

export function looksLikeRouteNumber(query: string): boolean {
  return ROUTE_NUMBER_PATTERN.test(query.trim());
}

export function normalizeDiscoveryQuery(query: string): string {
  return query.trim().replace(/\s+/g, " ");
}

export type LineSearchMatchTier = 0 | 1 | 2 | 3;

export function getLineSearchMatchTier(
  result: LineSearchResult,
  query: string,
): LineSearchMatchTier {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) {
    return 3;
  }

  const id = result.id.toLowerCase();
  const name = result.name.toLowerCase();

  if (id === normalizedQuery || name === normalizedQuery) {
    return 0;
  }
  if (id.startsWith(normalizedQuery) || name.startsWith(normalizedQuery)) {
    return 1;
  }
  if (id.includes(normalizedQuery) || name.includes(normalizedQuery)) {
    return 2;
  }
  return 3;
}

export function sortLineSearchResults(
  results: LineSearchResult[],
  query: string,
): LineSearchResult[] {
  const normalizedQuery = query.trim();
  if (!normalizedQuery) {
    return results;
  }

  return [...results].sort((left, right) => {
    const tierDelta =
      getLineSearchMatchTier(left, normalizedQuery) -
      getLineSearchMatchTier(right, normalizedQuery);
    if (tierDelta !== 0) {
      return tierDelta;
    }

    return left.id.localeCompare(right.id, undefined, {
      numeric: true,
      sensitivity: "base",
    });
  });
}
