import { z } from "zod";

export const lineSearchQuerySchema = z.object({
  query: z.string().trim().min(1).max(40),
});

export const stopSearchQuerySchema = z.object({
  query: z.string().trim().min(2).max(60),
});

export const nearbyStopsQuerySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lon: z.coerce.number().min(-180).max(180),
  radius: z.coerce.number().min(100).max(2000).default(1000),
});

export const routeIdQuerySchema = z.object({
  routeId: z.string().trim().min(1).max(20),
});

export const stopPointIdQuerySchema = z.object({
  stopPointId: z.string().trim().min(1).max(30),
});

export const timetableQuerySchema = z.object({
  routeId: z.string().trim().min(1).max(20),
  fromStopPointId: z.string().trim().min(1).max(30),
  direction: z.enum(["inbound", "outbound"]),
  toStopPointId: z.string().trim().min(1).max(30).optional(),
});

const rawStopPointSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    lat: z.number().optional(),
    lon: z.number().optional(),
    towards: z.string().optional(),
    stopLetter: z.string().optional(),
    indicator: z.string().optional(),
    naptanId: z.string().optional(),
    modes: z.array(z.string()).optional(),
    stopType: z.string().optional(),
    parentId: z.string().optional(),
  })
  .passthrough();

const rawRouteSequenceSchema = z
  .object({
    lineId: z.string().optional(),
    lineName: z.string().optional(),
    lineStrings: z.array(z.string()).optional(),
    stopPointSequences: z
      .array(
        z.object({
          lineId: z.string().optional(),
          lineName: z.string().optional(),
          direction: z.string(),
          branchIds: z.array(z.string()).optional(),
          serviceType: z.string().optional(),
          stopPoint: z.array(rawStopPointSchema).optional(),
        }),
      )
      .optional(),
  })
  .passthrough();

export const rawRouteSequenceResponseSchema = z.union([
  rawRouteSequenceSchema,
  z.array(rawRouteSequenceSchema),
]);

const rawPredictionSchema = z
  .object({
    id: z.string(),
    lineId: z.string(),
    lineName: z.string(),
    naptanId: z.string(),
    stationName: z.string(),
    destinationName: z.string(),
    direction: z.string(),
    timeToStation: z.number(),
    expectedArrival: z.string(),
    vehicleId: z.string().optional(),
    currentLocation: z.string().optional(),
    towards: z.string().optional(),
    modeName: z.string(),
    timestamp: z.string(),
  })
  .passthrough();

export const rawArrivalsResponseSchema = z.array(rawPredictionSchema);

const rawLineSearchMatchSchema = z
  .object({
    lineId: z.string(),
    lineName: z.string(),
    mode: z.string(),
    lineRouteSection: z.array(z.unknown()).optional(),
    matchedRouteSections: z.array(z.unknown()).optional(),
    matchedStops: z.array(z.unknown()).optional(),
  })
  .passthrough();

export const rawLineSearchResponseSchema = z
  .object({
    input: z.string().optional(),
    searchMatches: z.array(rawLineSearchMatchSchema),
  })
  .passthrough();

const rawValidityPeriodSchema = z
  .object({
    fromDate: z.string().optional(),
    toDate: z.string().optional(),
    isNow: z.boolean().optional(),
  })
  .passthrough();

const rawLineDisruptionSchema = z
  .object({
    categoryDescription: z.string().optional(),
    description: z.string().optional(),
    summary: z.string().optional(),
  })
  .passthrough();

const rawLineStatusItemSchema = z
  .object({
    statusSeverity: z.number(),
    statusSeverityDescription: z.string(),
    reason: z.string().optional(),
    validityPeriods: z.array(rawValidityPeriodSchema).optional(),
    disruption: rawLineDisruptionSchema.optional(),
  })
  .passthrough();

const rawLineObjectSchema = z
  .object({
    id: z.string().optional(),
    lineId: z.string().optional(),
    lineStatuses: z.array(rawLineStatusItemSchema).optional(),
    disruptions: z.array(rawLineDisruptionSchema).optional(),
  })
  .passthrough();

export const rawLineStatusResponseSchema = z.array(rawLineObjectSchema);

const rawDisruptedPointSchema = z
  .object({
    atcoCode: z.string(),
    fromDate: z.string().optional(),
    toDate: z.string().optional(),
    description: z.string().optional(),
    commonName: z.string().optional(),
    type: z.string().optional(),
    mode: z.string().optional(),
    appearance: z.string().optional(),
  })
  .passthrough();

export const rawStopDisruptionsResponseSchema = z.array(rawDisruptedPointSchema);

export const stopDisruptionsQuerySchema = z.object({
  stopPointIds: z
    .string()
    .trim()
    .min(1)
    .transform((value) =>
      value
        .split(",")
        .map((id) => id.trim())
        .filter(Boolean),
    )
    .pipe(z.array(z.string().min(1).max(30)).min(1).max(120)),
});

const rawStopSearchItemSchema = z
  .object({
    id: z.string().optional(),
    naptanId: z.string().optional(),
    name: z.string().optional(),
    commonName: z.string().optional(),
    indicator: z.string().optional(),
    stopLetter: z.string().optional(),
    towards: z.string().optional(),
    modes: z.array(z.string()).optional(),
    lines: z.array(z.union([z.string(), z.object({ id: z.string().optional() }).passthrough()])).optional(),
    children: z.array(z.unknown()).optional(),
    lat: z.number().optional(),
    lon: z.number().optional(),
    distance: z.number().optional(),
  })
  .passthrough();

const rawStopSearchMatchesSchema = z.object({
  matches: z.array(rawStopSearchItemSchema),
});

const rawNearbyStopsResponseSchema = z.object({
  stopPoints: z.array(rawStopSearchItemSchema),
});

export const rawStopSearchResponseSchema = z.union([
  z.array(rawStopSearchItemSchema),
  rawStopSearchMatchesSchema,
  rawNearbyStopsResponseSchema,
]);

export function extractStopSearchItems(
  raw: z.infer<typeof rawStopSearchResponseSchema>,
): z.infer<typeof rawStopSearchItemSchema>[] {
  if (Array.isArray(raw)) {
    return raw;
  }

  if ("matches" in raw) {
    return raw.matches;
  }

  return raw.stopPoints;
}
