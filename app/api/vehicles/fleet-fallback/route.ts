import { NextRequest } from "next/server";
import { handleApiErrorResponse, jsonResponse } from "@/lib/api";
import { lookupFleetFallback } from "@/lib/vehicles/fleetFallback";
import { fleetFallbackQuerySchema } from "@/lib/vehicles/fleetFallbackSchemas";

export async function GET(request: NextRequest): Promise<Response> {
  try {
    const { reg: registration } = fleetFallbackQuerySchema.parse({
      reg: request.nextUrl.searchParams.get("reg"),
    });

    const result = await lookupFleetFallback(registration);
    return jsonResponse(result);
  } catch (error) {
    return handleApiErrorResponse(error);
  }
}
