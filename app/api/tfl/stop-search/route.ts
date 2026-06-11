import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/api";
import { tflFetch } from "@/lib/tfl/client";
import { normalizeStopSearch } from "@/lib/tfl/normalizers";
import {
  rawStopSearchResponseSchema,
  stopSearchQuerySchema,
} from "@/lib/tfl/schemas";

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { query } = stopSearchQuerySchema.parse({
      query: request.nextUrl.searchParams.get("query"),
    });

    const raw = await tflFetch(
      `/StopPoint/Search/${encodeURIComponent(query)}?modes=bus`,
      { cacheTtlMs: 60_000 },
    );

    const parsed = rawStopSearchResponseSchema.parse(raw);
    const results = normalizeStopSearch(parsed);

    return NextResponse.json({ results });
  } catch (error) {
    return handleApiError(error);
  }
}
