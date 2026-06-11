import { handleApiErrorResponse, jsonResponse } from "@/lib/api";
import { TIMETABLE_CACHE_TTL_MS } from "@/lib/constants";
import {
  filterStopDisruptionsForIds,
  normalizeStopDisruptions,
} from "@/lib/tfl/disruptions";
import { tflFetch } from "@/lib/tfl/client";
import { normalizeTimetable } from "@/lib/tfl/timetableNormalizers";
import {
  normalizeLineSearch,
  normalizeLineStatus,
  normalizeNearbyStops,
  normalizePredictions,
  normalizeRouteSequence,
  normalizeStopSearch,
} from "@/lib/tfl/normalizers";
import {
  extractStopSearchItems,
  lineSearchQuerySchema,
  nearbyStopsQuerySchema,
  rawArrivalsResponseSchema,
  rawLineSearchResponseSchema,
  rawLineStatusResponseSchema,
  rawRouteSequenceResponseSchema,
  rawStopDisruptionsResponseSchema,
  rawStopSearchResponseSchema,
  routeIdQuerySchema,
  stopDisruptionsQuerySchema,
  stopPointIdQuerySchema,
  stopSearchQuerySchema,
  timetableQuerySchema,
} from "@/lib/tfl/schemas";

function getRouteName(pathname: string): string | null {
  const match = pathname.match(/\/api\/tfl\/([^/]+)\/?$/);
  return match?.[1] ?? null;
}

async function handleLineArrivals(
  searchParams: URLSearchParams,
): Promise<Response> {
  const { routeId } = routeIdQuerySchema.parse({
    routeId: searchParams.get("routeId"),
  });

  const raw = await tflFetch(`/Line/${encodeURIComponent(routeId)}/Arrivals`, {
    cacheTtlMs: 5_000,
  });

  const parsed = rawArrivalsResponseSchema.parse(raw);
  const predictions = normalizePredictions(parsed);

  return jsonResponse({
    routeId,
    predictions,
    fetchedAt: new Date().toISOString(),
  });
}

async function handleLineSearch(
  searchParams: URLSearchParams,
): Promise<Response> {
  const { query } = lineSearchQuerySchema.parse({
    query: searchParams.get("query"),
  });

  const raw = await tflFetch(
    `/Line/Search/${encodeURIComponent(query)}?modes=bus`,
    { cacheTtlMs: 60_000 },
  );

  const parsed = rawLineSearchResponseSchema.parse(raw);
  const results = normalizeLineSearch(parsed);

  return jsonResponse({ results });
}

async function handleLineStatus(
  searchParams: URLSearchParams,
): Promise<Response> {
  const { routeId } = routeIdQuerySchema.parse({
    routeId: searchParams.get("routeId"),
  });

  const raw = await tflFetch(`/Line/${encodeURIComponent(routeId)}/Status`, {
    cacheTtlMs: 120_000,
  });

  const parsed = rawLineStatusResponseSchema.parse(raw);
  const status = normalizeLineStatus(routeId, parsed);

  return jsonResponse({ status });
}

async function handleNearbyStops(
  searchParams: URLSearchParams,
): Promise<Response> {
  const { lat, lon, radius } = nearbyStopsQuerySchema.parse({
    lat: searchParams.get("lat"),
    lon: searchParams.get("lon"),
    radius: searchParams.get("radius") ?? undefined,
  });

  const raw = await tflFetch(
    `/StopPoint?lat=${lat}&lon=${lon}&stopTypes=NaptanPublicBusCoachTram&radius=${radius}&modes=bus`,
    { cacheTtlMs: 30_000 },
  );

  const parsed = rawStopSearchResponseSchema.parse(raw);
  const results = normalizeNearbyStops(extractStopSearchItems(parsed));

  return jsonResponse({ results });
}

async function handleRouteSequence(
  searchParams: URLSearchParams,
): Promise<Response> {
  const { routeId } = routeIdQuerySchema.parse({
    routeId: searchParams.get("routeId"),
  });

  const raw = await tflFetch(
    `/Line/${encodeURIComponent(routeId)}/Route/Sequence/all`,
    { cacheTtlMs: 300_000 },
  );

  const parsed = rawRouteSequenceResponseSchema.parse(raw);
  const route = normalizeRouteSequence(
    routeId,
    parsed as Parameters<typeof normalizeRouteSequence>[1],
  );

  return jsonResponse({ route });
}

async function handleStopArrivals(
  searchParams: URLSearchParams,
): Promise<Response> {
  const { stopPointId } = stopPointIdQuerySchema.parse({
    stopPointId: searchParams.get("stopPointId"),
  });

  const raw = await tflFetch(
    `/StopPoint/${encodeURIComponent(stopPointId)}/Arrivals`,
    { cacheTtlMs: 5_000 },
  );

  const parsed = rawArrivalsResponseSchema.parse(raw);
  const predictions = normalizePredictions(parsed);

  return jsonResponse({
    stopPointId,
    predictions,
    fetchedAt: new Date().toISOString(),
  });
}

async function handleStopDisruptions(
  searchParams: URLSearchParams,
): Promise<Response> {
  const { stopPointIds } = stopDisruptionsQuerySchema.parse({
    stopPointIds: searchParams.get("stopPointIds"),
  });

  const raw = await tflFetch("/StopPoint/Mode/bus/Disruption", {
    cacheTtlMs: 300_000,
  });
  const parsed = rawStopDisruptionsResponseSchema.parse(raw);
  const disruptions = filterStopDisruptionsForIds(
    normalizeStopDisruptions(parsed),
    stopPointIds,
  );

  return jsonResponse({ disruptions });
}

async function handleStopSearch(
  searchParams: URLSearchParams,
): Promise<Response> {
  const { query } = stopSearchQuerySchema.parse({
    query: searchParams.get("query"),
  });

  const raw = await tflFetch(
    `/StopPoint/Search/${encodeURIComponent(query)}?modes=bus`,
    { cacheTtlMs: 60_000 },
  );

  const parsed = rawStopSearchResponseSchema.parse(raw);
  const results = normalizeStopSearch(extractStopSearchItems(parsed));

  return jsonResponse({ results });
}

async function handleTimetable(
  searchParams: URLSearchParams,
): Promise<Response> {
  const parsed = timetableQuerySchema.parse({
    routeId: searchParams.get("routeId"),
    fromStopPointId: searchParams.get("fromStopPointId"),
    direction: searchParams.get("direction"),
    toStopPointId: searchParams.get("toStopPointId") ?? undefined,
  });

  const path = parsed.toStopPointId
    ? `/Line/${encodeURIComponent(parsed.routeId)}/Timetable/${encodeURIComponent(parsed.fromStopPointId)}/to/${encodeURIComponent(parsed.toStopPointId)}?direction=${parsed.direction}`
    : `/Line/${encodeURIComponent(parsed.routeId)}/Timetable/${encodeURIComponent(parsed.fromStopPointId)}?direction=${parsed.direction}`;

  try {
    const raw = await tflFetch<unknown>(path, {
      cacheTtlMs: TIMETABLE_CACHE_TTL_MS,
    });
    const timetable = normalizeTimetable(
      raw,
      parsed.routeId,
      parsed.fromStopPointId,
      parsed.direction,
    );

    return jsonResponse({
      ...timetable,
      fetchedAt: new Date().toISOString(),
    });
  } catch (fetchError) {
    const message =
      fetchError instanceof Error
        ? fetchError.message
        : "Timetable unavailable";

    return jsonResponse({
      routeId: parsed.routeId,
      direction: parsed.direction,
      fromStopPointId: parsed.fromStopPointId,
      available: false,
      unavailableReason: message,
      journeys: [],
      fetchedAt: new Date().toISOString(),
    });
  }
}

export async function handleTflApiRequest(
  pathname: string,
  searchParams: URLSearchParams,
): Promise<Response> {
  try {
    const routeName = getRouteName(pathname);
    if (!routeName) {
      return jsonResponse({ error: "Not found" }, 404);
    }

    switch (routeName) {
      case "line-arrivals":
        return handleLineArrivals(searchParams);
      case "line-search":
        return handleLineSearch(searchParams);
      case "line-status":
        return handleLineStatus(searchParams);
      case "nearby-stops":
        return handleNearbyStops(searchParams);
      case "route-sequence":
        return handleRouteSequence(searchParams);
      case "stop-arrivals":
        return handleStopArrivals(searchParams);
      case "stop-disruptions":
        return handleStopDisruptions(searchParams);
      case "stop-search":
        return handleStopSearch(searchParams);
      case "timetable":
        return handleTimetable(searchParams);
      default:
        return jsonResponse({ error: "Not found" }, 404);
    }
  } catch (error) {
    return handleApiErrorResponse(error);
  }
}
