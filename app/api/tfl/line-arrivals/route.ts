import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/api";
import { tflFetch } from "@/lib/tfl/client";
import { normalizePredictions } from "@/lib/tfl/normalizers";
import {
  rawArrivalsResponseSchema,
  routeIdQuerySchema,
} from "@/lib/tfl/schemas";

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { routeId } = routeIdQuerySchema.parse({
      routeId: request.nextUrl.searchParams.get("routeId"),
    });

    const raw = await tflFetch(
      `/Line/${encodeURIComponent(routeId)}/Arrivals`,
      { cacheTtlMs: 5_000 },
    );

    const parsed = rawArrivalsResponseSchema.parse(raw);
    const predictions = normalizePredictions(parsed);

    return NextResponse.json({
      routeId,
      predictions,
      fetchedAt: new Date().toISOString(),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
