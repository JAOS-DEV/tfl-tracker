import { NextRequest } from "next/server";
import { handleTflApiRequest } from "@/lib/tfl/apiRouter";

export async function GET(request: NextRequest) {
  return handleTflApiRequest(request.nextUrl.pathname, request.nextUrl.searchParams);
}
