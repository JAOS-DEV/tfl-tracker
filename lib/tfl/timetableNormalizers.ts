import type {
  NormalizedTimetable,
  RouteDirection,
  ScheduledJourney,
  ScheduledStopTime,
} from "@/lib/tfl/types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function readNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function normalizeDirection(value: unknown): RouteDirection | null {
  const direction = readString(value)?.toLowerCase();
  if (!direction) {
    return null;
  }
  if (direction.includes("inbound")) {
    return "inbound";
  }
  if (direction.includes("outbound")) {
    return "outbound";
  }
  return null;
}

function buildScheduledDate(hour: string, minute: string, reference: Date): Date {
  const parsedHour = Number.parseInt(hour, 10);
  const parsedMinute = Number.parseInt(minute, 10);
  const scheduled = new Date(reference);
  scheduled.setHours(
    Number.isFinite(parsedHour) ? parsedHour : 0,
    Number.isFinite(parsedMinute) ? parsedMinute : 0,
    0,
    0,
  );

  if (scheduled.getTime() < reference.getTime() - 12 * 60 * 60 * 1000) {
    scheduled.setDate(scheduled.getDate() + 1);
  }

  return scheduled;
}

function addMinutes(base: Date, minutes: number): string {
  return new Date(base.getTime() + minutes * 60_000).toISOString();
}

function parseStationNameMap(raw: unknown): Map<string, string> {
  const names = new Map<string, string>();
  if (!isRecord(raw)) {
    return names;
  }

  const stations = raw.stations ?? raw.stops;
  if (!Array.isArray(stations)) {
    return names;
  }

  for (const station of stations) {
    if (!isRecord(station)) {
      continue;
    }
    const id = readString(station.id);
    const name = readString(station.name);
    if (id && name) {
      names.set(id, name);
    }
  }

  return names;
}

function parseKnownJourneys(schedule: Record<string, unknown>): Array<{
  hour: string;
  minute: string;
  intervalId: string;
}> {
  const journeys: Array<{ hour: string; minute: string; intervalId: string }> =
    [];

  const pushJourney = (value: unknown) => {
    if (!isRecord(value)) {
      return;
    }
    const hour = readString(value.hour);
    const minute = readString(value.minute);
    const intervalId =
      readString(value.intervalId) ??
      (value.intervalId !== undefined ? String(value.intervalId) : undefined);
    if (hour && minute && intervalId) {
      journeys.push({ hour, minute, intervalId });
    }
  };

  if (Array.isArray(schedule.knownJourneys)) {
    for (const journey of schedule.knownJourneys) {
      pushJourney(journey);
    }
  }

  pushJourney(schedule.firstJourney);
  pushJourney(schedule.lastJourney);

  return journeys;
}

function buildStopTimes(
  intervals: Array<{ stopId: string; timeToArrival: number }>,
  departureTime: Date,
  stationNames: Map<string, string>,
): ScheduledStopTime[] {
  return intervals.map((interval) => ({
    stopId: interval.stopId,
    naptanId: interval.stopId,
    stopName: stationNames.get(interval.stopId) ?? interval.stopId,
    scheduledArrival: addMinutes(departureTime, interval.timeToArrival),
  }));
}

function parseJourneys(
  raw: unknown,
  direction: RouteDirection,
  reference: Date,
): ScheduledJourney[] {
  if (!isRecord(raw) || !isRecord(raw.timetable)) {
    return [];
  }

  const stationNames = parseStationNameMap(raw);
  const routes = raw.timetable.routes;
  if (!Array.isArray(routes)) {
    return [];
  }

  const journeys: ScheduledJourney[] = [];

  for (const routeEntry of routes) {
    if (!isRecord(routeEntry)) {
      continue;
    }

    const intervalMap = new Map<
      string,
      Array<{ stopId: string; timeToArrival: number }>
    >();

    if (Array.isArray(routeEntry.stationIntervals)) {
      for (const stationInterval of routeEntry.stationIntervals) {
        if (!isRecord(stationInterval)) {
          continue;
        }
        const intervalId =
          readString(stationInterval.id) ??
          (stationInterval.id !== undefined
            ? String(stationInterval.id)
            : undefined);
        if (!intervalId || !Array.isArray(stationInterval.intervals)) {
          continue;
        }

        const intervals = stationInterval.intervals
          .map((interval) => {
            if (!isRecord(interval)) {
              return null;
            }
            const stopId = readString(interval.stopId);
            const timeToArrival = readNumber(interval.timeToArrival);
            if (!stopId || timeToArrival === undefined) {
              return null;
            }
            return { stopId, timeToArrival };
          })
          .filter(
            (interval): interval is { stopId: string; timeToArrival: number } =>
              interval !== null,
          );

        intervalMap.set(intervalId, intervals);
      }
    }

    if (!Array.isArray(routeEntry.schedules)) {
      continue;
    }

    for (const schedule of routeEntry.schedules) {
      if (!isRecord(schedule)) {
        continue;
      }

      const scheduleName = readString(schedule.name);
      for (const knownJourney of parseKnownJourneys(schedule)) {
        const intervals = intervalMap.get(knownJourney.intervalId);
        if (!intervals || intervals.length === 0) {
          continue;
        }

        const departureTime = buildScheduledDate(
          knownJourney.hour,
          knownJourney.minute,
          reference,
        );
        const stopTimes = buildStopTimes(intervals, departureTime, stationNames);
        const destinationStop = stopTimes[stopTimes.length - 1];

        journeys.push({
          journeyId: `${knownJourney.intervalId}-${knownJourney.hour}${knownJourney.minute}`,
          direction,
          destinationName: destinationStop?.stopName,
          departureTime: departureTime.toISOString(),
          intervalId: knownJourney.intervalId,
          stopTimes,
        });
      }

      if (scheduleName && journeys.length === 0) {
        continue;
      }
    }
  }

  return journeys;
}

export function normalizeTimetable(
  raw: unknown,
  routeId: string,
  fromStopPointId: string,
  direction: RouteDirection,
  reference = new Date(),
): NormalizedTimetable {
  if (!isRecord(raw)) {
    return {
      routeId,
      direction,
      fromStopPointId,
      available: false,
      unavailableReason: "Unexpected timetable response shape",
      journeys: [],
    };
  }

  if (readString(raw.statusErrorMessage)) {
    return {
      routeId,
      direction,
      fromStopPointId,
      available: false,
      unavailableReason: raw.statusErrorMessage as string,
      journeys: [],
    };
  }

  if (isRecord(raw.disambiguation)) {
    return {
      routeId,
      direction,
      fromStopPointId,
      available: false,
      unavailableReason: "Timetable requires disambiguation",
      journeys: [],
    };
  }

  const journeys = parseJourneys(
    raw,
    normalizeDirection(raw.direction) ?? direction,
    reference,
  );

  return {
    routeId,
    direction: normalizeDirection(raw.direction) ?? direction,
    fromStopPointId,
    available: journeys.length > 0,
    unavailableReason:
      journeys.length === 0 ? "No timetable journeys available" : undefined,
    journeys,
  };
}

export function flattenTimetableStopTimes(
  timetable: NormalizedTimetable,
): ScheduledStopTime[] {
  return timetable.journeys.flatMap((journey) => journey.stopTimes);
}
