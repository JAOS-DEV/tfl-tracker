import { NextRequest, NextResponse } from "next/server";
import { handleApiError, jsonError } from "@/lib/api";
import { TIMETABLE_CACHE_TTL_MS } from "@/lib/constants";
import { tflFetch } from "@/lib/tfl/client";
import { normalizeTimetable } from "@/lib/tfl/timetableNormalizers";
import { timetableQuerySchema } from "@/lib/tfl/schemas";

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const parsed = timetableQuerySchema.parse({
      routeId: request.nextUrl.searchParams.get("routeId"),
      fromStopPointId: request.nextUrl.searchParams.get("fromStopPointId"),
      direction: request.nextUrl.searchParams.get("direction"),
      toStopPointId: request.nextUrl.searchParams.get("toStopPointId") ?? undefined,
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

      return NextResponse.json({
        ...timetable,
        fetchedAt: new Date().toISOString(),
      });
    } catch (fetchError) {
      const message =
        fetchError instanceof Error
          ? fetchError.message
          : "Timetable unavailable";

      return NextResponse.json({
        routeId: parsed.routeId,
        direction: parsed.direction,
        fromStopPointId: parsed.fromStopPointId,
        available: false,
        unavailableReason: message,
        journeys: [],
        fetchedAt: new Date().toISOString(),
      });
    }
  } catch (error) {
    if (error instanceof Error && error.name === "ZodError") {
      return handleApiError(error);
    }
    return jsonError("Timetable request failed", 500);
  }
}
