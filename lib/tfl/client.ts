import { getEnv } from "@/lib/env";

const TFL_BASE_URL = "https://api.tfl.gov.uk";

interface CacheEntry {
  data: unknown;
  expiresAt: number;
}

const responseCache = new Map<string, CacheEntry>();
const inflightRequests = new Map<string, Promise<unknown>>();

export class TflApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly path: string,
  ) {
    super(message);
    this.name = "TflApiError";
  }
}

function buildUrl(path: string): string {
  const env = getEnv();
  const separator = path.includes("?") ? "&" : "?";
  return `${TFL_BASE_URL}${path}${separator}app_key=${encodeURIComponent(env.TFL_API_KEY)}`;
}

export async function tflFetch<T>(
  path: string,
  options: { cacheTtlMs?: number } = {},
): Promise<T> {
  const { cacheTtlMs } = options;
  const cacheKey = path;

  if (cacheTtlMs && cacheTtlMs > 0) {
    const cached = responseCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.data as T;
    }
  }

  const existing = inflightRequests.get(cacheKey);
  if (existing) {
    return existing as Promise<T>;
  }

  const request = (async () => {
    const response = await fetch(buildUrl(path), {
      headers: { Accept: "application/json" },
      next: { revalidate: 0 },
    });

    if (!response.ok) {
      const body = await response.text();
      throw new TflApiError(
        body || `TfL API request failed with status ${response.status}`,
        response.status,
        path,
      );
    }

    const data = (await response.json()) as T;

    if (cacheTtlMs && cacheTtlMs > 0) {
      responseCache.set(cacheKey, {
        data,
        expiresAt: Date.now() + cacheTtlMs,
      });
    }

    return data;
  })();

  inflightRequests.set(cacheKey, request);

  try {
    return await request;
  } finally {
    inflightRequests.delete(cacheKey);
  }
}

export function clearTflClientCache(): void {
  responseCache.clear();
  inflightRequests.clear();
}
