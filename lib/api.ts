import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { TflApiError } from "@/lib/tfl/client";

export interface JsonErrorBody {
  error: string;
  details?: unknown;
}

export function jsonResponse(
  body: unknown,
  status = 200,
  extraHeaders?: HeadersInit,
): Response {
  const headers = new Headers(extraHeaders);
  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  return new Response(JSON.stringify(body), { status, headers });
}

export function jsonError(
  message: string,
  status = 500,
  details?: unknown,
): NextResponse {
  return NextResponse.json(
    {
      error: message,
      details,
    } satisfies JsonErrorBody,
    { status },
  );
}

export function jsonErrorResponse(
  message: string,
  status = 500,
  details?: unknown,
  extraHeaders?: HeadersInit,
): Response {
  return jsonResponse(
    {
      error: message,
      details,
    } satisfies JsonErrorBody,
    status,
    extraHeaders,
  );
}

export function handleApiError(error: unknown): NextResponse {
  return handleApiErrorResponse(error) as NextResponse;
}

export function handleApiErrorResponse(
  error: unknown,
  extraHeaders?: HeadersInit,
): Response {
  if (error instanceof ZodError) {
    return jsonErrorResponse(
      "Invalid request parameters",
      400,
      error.flatten(),
      extraHeaders,
    );
  }

  if (error instanceof TflApiError) {
    return jsonErrorResponse(error.message, error.status, undefined, extraHeaders);
  }

  if (error instanceof Error) {
    if (error.message.includes("TFL_API_KEY")) {
      return jsonErrorResponse(
        "Server configuration error: TFL_API_KEY is missing or invalid",
        500,
        undefined,
        extraHeaders,
      );
    }
    return jsonErrorResponse(error.message, 500, undefined, extraHeaders);
  }

  return jsonErrorResponse("Unexpected server error", 500, undefined, extraHeaders);
}
