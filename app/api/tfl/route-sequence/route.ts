import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/api";
import { tflFetch } from "@/lib/tfl/client";
import { normalizeRouteSequence } from "@/lib/tfl/normalizers";
import {
  rawRouteSequenceResponseSchema,
  routeIdQuerySchema,
} from "@/lib/tfl/schemas";

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { routeId } = routeIdQuerySchema.parse({
      routeId: request.nextUrl.searchParams.get("routeId"),
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

    return NextResponse.json({ route });
  } catch (error) {
    return handleApiError(error);
  }
}
