import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/api";
import { tflFetch } from "@/lib/tfl/client";
import { normalizeNearbyStops } from "@/lib/tfl/normalizers";
import {
  nearbyStopsQuerySchema,
  rawStopSearchResponseSchema,
} from "@/lib/tfl/schemas";

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { lat, lon, radius } = nearbyStopsQuerySchema.parse({
      lat: request.nextUrl.searchParams.get("lat"),
      lon: request.nextUrl.searchParams.get("lon"),
      radius: request.nextUrl.searchParams.get("radius") ?? undefined,
    });

    const raw = await tflFetch(
      `/StopPoint?lat=${lat}&lon=${lon}&stopTypes=NaptanPublicBusCoachTram&radius=${radius}&modes=bus`,
      { cacheTtlMs: 30_000 },
    );

    const parsed = rawStopSearchResponseSchema.parse(raw);
    const results = normalizeNearbyStops(parsed);

    return NextResponse.json({ results });
  } catch (error) {
    return handleApiError(error);
  }
}
