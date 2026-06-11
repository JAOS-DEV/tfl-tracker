import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/api";
import { tflFetch } from "@/lib/tfl/client";
import { normalizeLineStatus } from "@/lib/tfl/normalizers";
import {
  rawLineStatusResponseSchema,
  routeIdQuerySchema,
} from "@/lib/tfl/schemas";

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { routeId } = routeIdQuerySchema.parse({
      routeId: request.nextUrl.searchParams.get("routeId"),
    });

    const raw = await tflFetch(
      `/Line/${encodeURIComponent(routeId)}/Status`,
      { cacheTtlMs: 120_000 },
    );

    const parsed = rawLineStatusResponseSchema.parse(raw);
    const status = normalizeLineStatus(routeId, parsed);

    return NextResponse.json({ status });
  } catch (error) {
    return handleApiError(error);
  }
}
