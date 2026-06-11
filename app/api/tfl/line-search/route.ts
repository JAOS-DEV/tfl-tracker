import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/api";
import { tflFetch } from "@/lib/tfl/client";
import { normalizeLineSearch } from "@/lib/tfl/normalizers";
import {
  lineSearchQuerySchema,
  rawLineSearchResponseSchema,
} from "@/lib/tfl/schemas";

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { query } = lineSearchQuerySchema.parse({
      query: request.nextUrl.searchParams.get("query"),
    });

    const raw = await tflFetch(
      `/Line/Search/${encodeURIComponent(query)}?modes=bus`,
      { cacheTtlMs: 60_000 },
    );

    const parsed = rawLineSearchResponseSchema.parse(raw);
    const results = normalizeLineSearch(parsed);

    return NextResponse.json({ results });
  } catch (error) {
    return handleApiError(error);
  }
}
