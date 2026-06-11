import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/api";
import { tflFetch } from "@/lib/tfl/client";
import { normalizePredictions } from "@/lib/tfl/normalizers";
import {
  rawArrivalsResponseSchema,
  stopPointIdQuerySchema,
} from "@/lib/tfl/schemas";

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { stopPointId } = stopPointIdQuerySchema.parse({
      stopPointId: request.nextUrl.searchParams.get("stopPointId"),
    });

    const raw = await tflFetch(
      `/StopPoint/${encodeURIComponent(stopPointId)}/Arrivals`,
      { cacheTtlMs: 5_000 },
    );

    const parsed = rawArrivalsResponseSchema.parse(raw);
    const predictions = normalizePredictions(parsed);

    return NextResponse.json({
      stopPointId,
      predictions,
      fetchedAt: new Date().toISOString(),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
