import { MAX_ACTIVE_ROUTES } from "@/lib/storage";

export function parseRoutesParam(routesParam: string | null): string[] {
  if (!routesParam) {
    return [];
  }

  const seen = new Set<string>();
  const routeIds: string[] = [];

  for (const segment of routesParam.split(",")) {
    const trimmed = segment.trim();
    if (!trimmed) {
      continue;
    }

    const normalized = trimmed.toLowerCase();
    if (seen.has(normalized)) {
      continue;
    }

    seen.add(normalized);
    routeIds.push(trimmed);

    if (routeIds.length >= MAX_ACTIVE_ROUTES) {
      break;
    }
  }

  return routeIds;
}

export function serializeRoutesParam(routeIds: string[]): string | null {
  const unique: string[] = [];
  const seen = new Set<string>();

  for (const routeId of routeIds) {
    const normalized = routeId.trim().toLowerCase();
    if (!normalized || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    unique.push(routeId.trim());
    if (unique.length >= MAX_ACTIVE_ROUTES) {
      break;
    }
  }

  return unique.length > 0 ? unique.join(",") : null;
}

export function buildRoutesSearchUrl(routeIds: string[]): string {
  const serialized = serializeRoutesParam(routeIds);
  if (!serialized) {
    return "/";
  }
  return `/?routes=${encodeURIComponent(serialized)}`;
}
