import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { TflApiError } from "@/lib/tfl/client";

export function jsonError(
  message: string,
  status = 500,
  details?: unknown,
): NextResponse {
  return NextResponse.json(
    {
      error: message,
      details,
    },
    { status },
  );
}

export function handleApiError(error: unknown): NextResponse {
  if (error instanceof ZodError) {
    return jsonError("Invalid request parameters", 400, error.flatten());
  }

  if (error instanceof TflApiError) {
    return jsonError(error.message, error.status);
  }

  if (error instanceof Error) {
    if (error.message.includes("TFL_API_KEY")) {
      return jsonError(
        "Server configuration error: TFL_API_KEY is missing or invalid",
        500,
      );
    }
    return jsonError(error.message, 500);
  }

  return jsonError("Unexpected server error", 500);
}
