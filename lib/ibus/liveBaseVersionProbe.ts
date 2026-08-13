export interface LiveBaseVersionProbeResult {
  routeId: string;
  liveBaseVersion: string | null;
  predictionCount: number;
  source: "local-api" | "tfl-api" | "unavailable";
  detail?: string;
}

function majorityBaseVersion(
  predictions: Array<{ baseVersion?: string | null }>,
): { liveBaseVersion: string | null; predictionCount: number } {
  const counts = new Map<string, number>();
  for (const prediction of predictions) {
    const version = prediction.baseVersion?.trim();
    if (!version) {
      continue;
    }
    counts.set(version, (counts.get(version) ?? 0) + 1);
  }

  let best: string | null = null;
  let bestCount = 0;
  for (const [version, count] of counts) {
    if (count > bestCount) {
      best = version;
      bestCount = count;
    }
  }

  return {
    liveBaseVersion: best,
    predictionCount: predictions.length,
  };
}

async function probeLocalApi(
  routeId: string,
): Promise<LiveBaseVersionProbeResult | null> {
  try {
    const response = await fetch(
      `http://localhost:3000/api/tfl/line-arrivals?routeId=${encodeURIComponent(routeId)}`,
      { signal: AbortSignal.timeout(8_000) },
    );
    if (!response.ok) {
      return null;
    }
    const payload = (await response.json()) as {
      predictions?: Array<{ baseVersion?: string | null }>;
    };
    const summary = majorityBaseVersion(payload.predictions ?? []);
    return {
      routeId,
      ...summary,
      source: "local-api",
    };
  } catch {
    return null;
  }
}

async function probeTflApi(
  routeId: string,
): Promise<LiveBaseVersionProbeResult | null> {
  const apiKey = process.env.TFL_API_KEY?.trim();
  if (!apiKey) {
    return null;
  }

  try {
    const url = new URL(
      `https://api.tfl.gov.uk/Line/${encodeURIComponent(routeId)}/Arrivals`,
    );
    url.searchParams.set("app_key", apiKey);
    const response = await fetch(url, {
      signal: AbortSignal.timeout(12_000),
    });
    if (!response.ok) {
      return {
        routeId,
        liveBaseVersion: null,
        predictionCount: 0,
        source: "unavailable",
        detail: `TfL arrivals HTTP ${response.status}`,
      };
    }
    const predictions = (await response.json()) as Array<{
      baseVersion?: string | null;
    }>;
    const summary = majorityBaseVersion(predictions);
    return {
      routeId,
      ...summary,
      source: "tfl-api",
    };
  } catch (error) {
    return {
      routeId,
      liveBaseVersion: null,
      predictionCount: 0,
      source: "unavailable",
      detail: error instanceof Error ? error.message : "TfL probe failed",
    };
  }
}

/** Sample live prediction baseVersion for one route (dev API or TfL). */
export async function probeLiveBaseVersion(
  routeId = "337",
): Promise<LiveBaseVersionProbeResult> {
  const local = await probeLocalApi(routeId);
  if (local?.liveBaseVersion) {
    return local;
  }

  const remote = await probeTflApi(routeId);
  if (remote) {
    return remote;
  }

  return {
    routeId,
    liveBaseVersion: null,
    predictionCount: 0,
    source: "unavailable",
    detail:
      "Could not sample live arrivals (start npm run dev, or set TFL_API_KEY).",
  };
}
