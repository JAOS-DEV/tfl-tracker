const ROUTE_NUMBER_PATTERN = /^[Nn]?\d{1,4}[A-Za-z]?$/;

export function looksLikeRouteNumber(query: string): boolean {
  return ROUTE_NUMBER_PATTERN.test(query.trim());
}

export function normalizeDiscoveryQuery(query: string): string {
  return query.trim().replace(/\s+/g, " ");
}
